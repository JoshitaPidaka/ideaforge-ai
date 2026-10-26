"""Core tests: grounding, JSON handling, retrieval, and the full pipeline with a fake Gemma."""
import asyncio
import json
import os
import tempfile
from pathlib import Path

import pytest

TMP = Path(tempfile.mkdtemp())
os.environ["DATA_DIR"] = str(TMP)
os.environ["GEMINI_API_KEY"] = ""
os.environ["EMBEDDER"] = "lsa"

from app import collection, pipeline  # noqa: E402
from app.gemma import Gemma, extract_json  # noqa: E402
from app.grounding import verify_quote  # noqa: E402
from app.retrieval import CollectionIndex  # noqa: E402
from app.schemas import Item, ProposalBrief  # noqa: E402

ITEMS = [
    Item(id="proj:a/leafscan", type="project", title="leafscan",
         text="LeafScan is an Android app that detects tomato and potato leaf diseases offline using a quantised MobileNet model. "
              "It works without internet and shows treatment tips in English."),
    Item(id="paper:W1", type="paper", title="Deep learning for plant disease detection", year=2021,
         text="We train convolutional neural networks on the PlantVillage dataset to classify 38 crop disease classes "
              "with 99% accuracy on held-out images."),
    Item(id="proj:b/campusbot", type="project", title="campus bot",
         text="A retrieval augmented chatbot that answers university admission questions from PDF handbooks with citations."),
    Item(id="proj:c/fraud", type="project", title="fraud detector",
         text="Credit card fraud detection with gradient boosting on transaction features and SMOTE for class imbalance."),
]


def test_verify_quote_exact_fuzzy_and_fake():
    src = ITEMS[0].text
    assert verify_quote("detects tomato and potato leaf diseases offline", src)
    assert verify_quote("Detects tomato & potato leaf diseases  offline!", src)  # punctuation/case/spacing
    assert not verify_quote("uses satellite imagery to forecast crop yield", src)
    assert not verify_quote("offline", src)  # too short to count as evidence


def test_extract_json_variants():
    assert extract_json('Sure! ```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('Here: {"a": [1, 2,],}') == {"a": [1, 2]}
    with pytest.raises(ValueError):
        extract_json("no json here")


def test_hybrid_retrieval_ranks_relevant_first():
    idx = CollectionIndex(ITEMS)
    hits, sims = idx.multi_search("offline plant leaf disease detection android app",
                                  ["offline tomato disease detection", "PlantVillage dataset classification"], top_k=3)
    ids = [ITEMS[h.idx].id for h in hits]
    assert ids[0] in ("proj:a/leafscan", "paper:W1")
    assert "proj:c/fraud" not in ids[:2]
    assert len(sims) == len(ITEMS)


class FakeGemma:
    """Returns schema-shaped JSON depending on which prompt it receives, including one fabricated quote."""
    available = True
    model = "gemma-4-fake"
    error = ""
    json = Gemma.json  # exercise the real parse/validate/repair path

    async def text(self, prompt, images=None, temperature=0.2):
        if "compare a project proposal with one related item" in prompt:
            lead_id = prompt.split('<source id="')[1].split('"')[0]
            good = "detects tomato and potato leaf diseases offline" if lead_id == "proj:a/leafscan" else "PlantVillage dataset"
            return "```json\n" + json.dumps({
                "lead_id": lead_id, "overlap_level": "high",
                "aspects": [{"aspect": "problem", "relation": "same", "explanation": "Both detect leaf disease.", "evidence_quote": good},
                            {"aspect": "users", "relation": "different", "explanation": "x", "evidence_quote": "made up farmers quote that is not there"}],
                "contribution_matches": [{"contribution_index": 0, "relation": "covers", "evidence_quote": good},
                                         {"contribution_index": 1, "relation": "partially_covers", "evidence_quote": "fabricated sentence about voice in Telugu"},
                                         {"contribution_index": 9, "relation": "covers", "evidence_quote": good}],
                "summary": "s", "key_difference": "k", "simple_summary": "ss"}) + "\n```"
        if "mentor helping a team" in prompt:
            return json.dumps({"contributions": [{"index": 0, "explanation": "e0", "simple": "s0"}], "headline": "h", "simple_summary": "hs",
                               "gaps": [{"title": "Voice", "detail": "d", "checked_leads": ["proj:a/leafscan", "proj:invented/x"]}],
                               "ideas": [{"title": "i", "detail": "d", "effort": "low", "linked_gap": "Voice"}], "pitch_line": "p",
                               "judge_questions": [{"question": "q", "suggested_answer": "a", "related_lead": "proj:invented/x"}]})
        raise AssertionError("unexpected prompt")


def test_full_pipeline_with_fake_gemma(monkeypatch):
    (TMP / "collection").mkdir(parents=True, exist_ok=True)
    with open(TMP / "collection" / "test.jsonl", "w") as f:
        for it in ITEMS:
            f.write(it.model_dump_json() + "\n")
    monkeypatch.setattr(pipeline, "gemma", FakeGemma())
    monkeypatch.setattr(collection.settings, "data_dir", TMP)
    brief = ProposalBrief(title="LeafDoctor", problem="crop disease", contributions=[
        "Offline tomato leaf disease detection on Android", "Voice advice in Telugu"], keywords=["plant disease", "offline"])
    pipeline.store.save_proposal("p1", "x", "text", 0)

    async def run():
        aid = await pipeline.start_analysis("p1", "test", brief)
        for _ in range(200):
            await asyncio.sleep(0.05)
            if aid not in pipeline.RUNNING:
                return aid
        raise TimeoutError

    aid = asyncio.run(run())
    r = pipeline.get_result(aid)
    assert r["status"] == "done", r["error"]
    assert r["ai_mode"] == "gemma"
    lead = next(l for l in r["leads"] if l["item"]["id"] == "proj:a/leafscan")
    asp = {a["aspect"]: a for a in lead["report"]["aspects"]}
    assert asp["problem"]["verified"] is True
    assert asp["users"]["verified"] is False          # fabricated quote rejected
    assert all(m["contribution_index"] < 2 for m in lead["report"]["contribution_matches"])  # out-of-range index dropped
    c0, c1 = r["insight"]["contributions"]
    assert c0["overlap_level"] in ("high", "medium") and c0["supporting_leads"]
    assert c1["overlap_level"] == "low" and not c1["supporting_leads"]  # only unverified evidence → no overlap
    assert r["insight"]["gaps"][0]["checked_leads"] == ["proj:a/leafscan"]  # invented id removed
    assert r["insight"]["judge_questions"][0]["related_lead"] == ""
    assert r["insight"]["pitch_line"] == "p"
    assert r["insight"]["confidence"]["level"] in ("low", "medium", "high")
