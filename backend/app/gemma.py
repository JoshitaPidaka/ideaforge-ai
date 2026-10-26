"""Gemma 4 client (via the Gemini API) with JSON validation, repair, retries and a response cache."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from . import prompts, store
from .config import settings

log = logging.getLogger("ideaforge.gemma")
T = TypeVar("T", bound=BaseModel)


class GemmaUnavailable(RuntimeError):
    pass


class TokenBudget:
    """Sliding-window input-token budget per model, so we pace requests instead of hitting 429 quota errors.
    Requests go to whichever Gemma 4 model has the most headroom (each model has its own free-tier quota)."""

    def __init__(self, tpm: int):
        self.tpm = tpm
        self.win: dict[str, list[tuple[float, int]]] = {}
        self.blocked: dict[str, float] = {}
        self._lock = asyncio.Lock()

    def headroom(self, model: str, now: float) -> int:
        if self.blocked.get(model, 0) > now:
            return -1
        w = [(t, n) for t, n in self.win.get(model, []) if now - t < 60]
        self.win[model] = w
        return self.tpm - sum(n for _, n in w)

    async def acquire(self, models: list[str], tokens: int) -> str:
        if self.tpm <= 0:
            return models[0]
        tokens = min(tokens, self.tpm)
        while True:
            async with self._lock:
                now = time.monotonic()
                best = max(models, key=lambda m: self.headroom(m, now))
                if self.headroom(best, now) >= tokens:
                    self.win.setdefault(best, []).append((now, tokens))
                    return best
                waits = [self.blocked[m] - now for m in models if self.blocked.get(m, 0) > now]
                waits += [60 - (now - w[0][0]) for m in models if (w := self.win.get(m))]
            await asyncio.sleep(min(5.0, max(0.25, min(waits) if waits else 1.0)))

    def block(self, model: str, seconds: float) -> None:
        self.blocked[model] = time.monotonic() + seconds


class Gemma:
    def __init__(self) -> None:
        self._client = None
        self.model = settings.gemma_model
        self.fallbacks: list[str] = []
        self.thinking = settings.gemma_thinking
        self.error = ""
        self._sem = asyncio.Semaphore(settings.gemma_concurrency)
        self.budget = TokenBudget(settings.gemma_tpm)
        if not settings.gemini_api_key:
            self.error = "GEMINI_API_KEY is not set"
            return
        try:
            from google import genai

            self._client = genai.Client(api_key=settings.gemini_api_key)
            if not self.model:
                self.model = self._detect_model()
        except Exception as e:  # bad key, no network…
            self._client = None
            self.error = f"{type(e).__name__}: {e}"
            log.warning("Gemma unavailable: %s", self.error)

    @property
    def available(self) -> bool:
        return self._client is not None and bool(self.model)

    def _detect_model(self) -> str:
        """Pick a Gemma 4 instruction-tuned model: prefer the fast mixture-of-experts variant (e.g. 26b-a4b),
        then larger dense models. The others are kept as fallbacks for transient server errors."""
        names = [m.name.removeprefix("models/") for m in self._client.models.list()]
        gemma4 = [n for n in names if re.search(r"gemma-?4", n) and n.endswith("it")]
        if not gemma4:
            raise GemmaUnavailable(f"no Gemma 4 model visible to this key (saw {len(names)} models)")

        def size(n: str) -> float:
            m = re.search(r"(\d+(?:\.\d+)?)b", n)
            return float(m.group(1)) if m else 0.0

        gemma4.sort(key=lambda n: (bool(re.search(r"-a\d+b", n)), size(n)), reverse=True)
        self.fallbacks = gemma4[1:]
        log.info("Using Gemma model %s (fallbacks: %s)", gemma4[0], self.fallbacks)
        return gemma4[0]

    # ------------------------------------------------------------------ calls
    async def text(self, prompt: str, images: list[bytes] | None = None, temperature: float = 0.2) -> str:
        if not self.available:
            raise GemmaUnavailable(self.error or "Gemma not configured")
        from google.genai import types

        key = hashlib.sha256(f"{self.model}|{temperature}|{prompt}".encode()
                             + b"".join(hashlib.sha256(i).digest() for i in images or [])).hexdigest()
        cached = store.cache_get(key)
        if cached is not None:
            return cached

        parts: list = [types.Part.from_bytes(data=img, mime_type="image/png") for img in images or []]
        parts.append(prompt)
        last: Exception | None = None
        models = [self.model] + self.fallbacks
        est = int(len(prompt) / 3.5) + 300 * len(images or []) + 50
        attempts = 6
        for attempt in range(attempts):
            model = await self.budget.acquire(models, est)
            cfg = types.GenerateContentConfig(temperature=temperature, max_output_tokens=4096)
            if self.thinking:
                cfg.thinking_config = types.ThinkingConfig(thinking_level=self.thinking)
            try:
                async with self._sem:
                    resp = await asyncio.wait_for(
                        self._client.aio.models.generate_content(model=model, contents=parts, config=cfg), timeout=150)
                out = resp.text or ""
                if not out.strip():
                    raise RuntimeError("empty response")
                store.cache_set(key, out)
                return out
            except Exception as e:
                last = e
                msg = str(e)
                if "400" in msg and "hink" in msg and self.thinking:  # model rejects thinking config → drop it
                    log.info("Disabling thinking_level for %s: %s", model, msg[:120])
                    self.thinking = ""
                    continue
                if attempt >= attempts - 1:
                    break
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    m = re.search(r"retry in ([\d.]+)s", msg)
                    self.budget.block(model, float(m.group(1)) + 1 if m else 20)
                    log.warning("Gemma quota hit on %s; pacing and switching model", model)
                    continue
                wait = min(8.0, 1.5 * 2 ** min(attempt, 2))
                log.warning("Gemma call failed on %s (attempt %d): %s; retrying in %.1fs", model, attempt + 1, msg[:160], wait)
                await asyncio.sleep(wait)
        raise GemmaUnavailable(f"Gemma request failed: {last}")

    async def json(self, prompt: str, schema: type[T], images: list[bytes] | None = None,
                   temperature: float = 0.2) -> T:
        raw = await self.text(prompt, images, temperature)
        try:
            return schema.model_validate(extract_json(raw))
        except (ValueError, ValidationError) as e:
            log.info("Repairing JSON for %s: %s", schema.__name__, str(e)[:200])
            fixed = await self.text(prompts.json_repair(raw, schema), temperature=0.0)
            return schema.model_validate(extract_json(fixed))


def extract_json(raw: str):
    """Parse the first JSON object/array from a model response (handles ``` fences and chatter)."""
    s = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", s, re.S)
    if fence:
        s = fence.group(1).strip()
    start = min([i for i in (s.find("{"), s.find("[")) if i >= 0], default=-1)
    if start < 0:
        raise ValueError("no JSON found in model output")
    s = s[start:]
    try:
        obj, _ = json.JSONDecoder().raw_decode(s)
        return obj
    except json.JSONDecodeError:
        # common model slip: trailing commas
        s2 = re.sub(r",\s*([}\]])", r"\1", s)
        obj, _ = json.JSONDecoder().raw_decode(s2)
        return obj


gemma = Gemma()
