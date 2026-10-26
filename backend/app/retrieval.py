"""Hybrid semantic retrieval over a bounded collection: dense embeddings + BM25, RRF fusion, MMR diversity."""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field

import numpy as np
from rank_bm25 import BM25Okapi

from .config import settings
from .schemas import Item

log = logging.getLogger("ideaforge.retrieval")

STOP = set("""a an the and or of to in for on with by from at as is are be was were this that these those it its into using use
used via we our you your their they them can will may also such than then there which who what when where how not no
based approach system systems project projects paper method methods new data model models""".split())


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9+#.-]*", text.lower()) if t not in STOP and len(t) > 1]


def item_doc(it: Item) -> str:
    return f"{it.title}. {it.title}. {' '.join(it.tags)}. {it.text}"


# ------------------------------------------------------------------ embedders
class Embedder:
    name = "base"

    def fit(self, docs: list[str]) -> np.ndarray: ...

    def query(self, texts: list[str]) -> np.ndarray: ...


class EmbeddingGemmaEmbedder(Embedder):
    """Google's open-weight EmbeddingGemma via sentence-transformers."""

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model_name)
        self.name = f"EmbeddingGemma ({model_name})"

    def fit(self, docs):
        enc = getattr(self.model, "encode_document", self.model.encode)
        return np.asarray(enc(docs, normalize_embeddings=True, batch_size=32, show_progress_bar=False), dtype=np.float32)

    def query(self, texts):
        enc = getattr(self.model, "encode_query", self.model.encode)
        return np.asarray(enc(texts, normalize_embeddings=True, show_progress_bar=False), dtype=np.float32)


class LSAEmbedder(Embedder):
    """Offline fallback: TF-IDF (word + bigram) projected with truncated SVD (latent semantic analysis)."""

    name = "LSA (TF-IDF + SVD) fallback"

    def fit(self, docs):
        from sklearn.decomposition import TruncatedSVD
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1, max_df=0.6,
                                   stop_words="english", max_features=60000)
        X = self.vec.fit_transform(docs)
        k = max(2, min(256, X.shape[0] - 1, X.shape[1] - 1))
        self.svd = TruncatedSVD(n_components=k, random_state=0)
        return self._norm(self.svd.fit_transform(X))

    def query(self, texts):
        return self._norm(self.svd.transform(self.vec.transform(texts)))

    @staticmethod
    def _norm(m):
        m = np.asarray(m, dtype=np.float32)
        return m / (np.linalg.norm(m, axis=1, keepdims=True) + 1e-9)


_shared_gemma_embedder: Embedder | None = None
_gemma_embedder_failed = ""


def make_embedder() -> tuple[Embedder, str]:
    """Return an embedder and a note explaining the choice."""
    global _shared_gemma_embedder, _gemma_embedder_failed
    if settings.embedder in ("auto", "embeddinggemma") and not _gemma_embedder_failed:
        try:
            if _shared_gemma_embedder is None:
                _shared_gemma_embedder = EmbeddingGemmaEmbedder(settings.embedding_model)
            return _shared_gemma_embedder, ""
        except Exception as e:
            _gemma_embedder_failed = f"{type(e).__name__}: {str(e)[:160]}"
            log.warning("EmbeddingGemma unavailable, using LSA fallback: %s", _gemma_embedder_failed)
    return LSAEmbedder(), _gemma_embedder_failed or "LSA selected by configuration"


# ------------------------------------------------------------------ index
@dataclass
class Hit:
    idx: int
    fused: float
    dense: float
    bm25: float
    queries: set[int] = field(default_factory=set)


class CollectionIndex:
    def __init__(self, items: list[Item]):
        self.items = items
        docs = [item_doc(i) for i in items]
        self.embedder, self.embedder_note = make_embedder()
        cache = settings.data_dir / "index" / f"{hashlib.sha1(('|'.join(i.id for i in items) + self.embedder.name).encode()).hexdigest()[:16]}.npy"
        if isinstance(self.embedder, LSAEmbedder):
            self.vectors = self.embedder.fit(docs)  # cheap; must be refit to own the vocabulary anyway
        elif cache.exists():
            self.vectors = np.load(cache)
        else:
            self.vectors = self.embedder.fit(docs)
            cache.parent.mkdir(parents=True, exist_ok=True)
            np.save(cache, self.vectors)
        self.bm25 = BM25Okapi([tokenize(d) for d in docs])
        log.info("Indexed %d items with %s", len(items), self.embedder.name)

    def embed(self, texts: list[str]) -> np.ndarray:
        return self.embedder.query(texts)

    def search(self, query: str, k: int = 50, rrf_k: int = 60) -> list[Hit]:
        """Hybrid search for a single query: dense top-k + BM25 top-k fused by Reciprocal Rank Fusion."""
        qv = self.embed([query])[0]
        dense = self.vectors @ qv
        bm = np.asarray(self.bm25.get_scores(tokenize(query)), dtype=np.float32)
        d_rank = np.argsort(-dense)[:k]
        b_rank = [i for i in np.argsort(-bm)[:k] if bm[i] > 0]
        fused: dict[int, float] = {}
        for r, i in enumerate(d_rank):
            fused[int(i)] = fused.get(int(i), 0) + 1 / (rrf_k + r + 1)
        for r, i in enumerate(b_rank):
            fused[int(i)] = fused.get(int(i), 0) + 1 / (rrf_k + r + 1)
        bmax = float(bm.max()) or 1.0
        return sorted((Hit(i, s, float(dense[i]), float(bm[i] / bmax)) for i, s in fused.items()),
                      key=lambda h: -h.fused)

    def multi_search(self, main_query: str, sub_queries: list[str], top_k: int = 12, pool: int = 40,
                     mmr_lambda: float = 0.7, match_depth: int = 8) -> tuple[list[Hit], np.ndarray]:
        """Search the whole brief plus one query per contribution, merge, then pick a diverse top_k with MMR.

        Returns the hits and the dense similarity of every item to the main query.
        """
        merged: dict[int, Hit] = {}
        for qi, q in enumerate([main_query] + sub_queries):
            for rank, h in enumerate(self.search(q)):
                cur = merged.setdefault(h.idx, Hit(h.idx, 0.0, h.dense, h.bm25))
                weight = 1.0 if qi == 0 else 0.6
                cur.fused += weight * h.fused
                cur.bm25 = max(cur.bm25, h.bm25)
                if qi > 0 and rank < match_depth:
                    cur.queries.add(qi - 1)
        main_sim = self.vectors @ self.embed([main_query])[0]
        for h in merged.values():
            h.dense = float(main_sim[h.idx])
        cands = sorted(merged.values(), key=lambda h: -h.fused)[:pool]
        if not cands:
            return [], main_sim
        rel = np.array([h.fused for h in cands])
        rel = (rel - rel.min()) / (rel.max() - rel.min() + 1e-9)
        V = self.vectors[[h.idx for h in cands]]
        chosen: list[int] = []
        while len(chosen) < min(top_k, len(cands)):
            best, best_score = -1, -1e9
            for j in range(len(cands)):
                if j in chosen:
                    continue
                div = max((float(V[j] @ V[c]) for c in chosen), default=0.0)
                score = mmr_lambda * rel[j] - (1 - mmr_lambda) * div
                if score > best_score:
                    best, best_score = j, score
            chosen.append(best)
        return [cands[j] for j in chosen], main_sim


def project_2d(vectors: np.ndarray) -> np.ndarray:
    """PCA to 2-D for the similarity map."""
    X = vectors - vectors.mean(axis=0, keepdims=True)
    if X.shape[0] < 3:
        return np.zeros((X.shape[0], 2))
    _, _, vt = np.linalg.svd(X, full_matrices=False)
    P = X @ vt[:2].T
    P = P / (np.abs(P).max(axis=0, keepdims=True) + 1e-9)
    return P
