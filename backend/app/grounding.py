"""Evidence grounding: check that every quote the model gives really appears in the source text."""
from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz

MIN_QUOTE_CHARS = 12
FUZZY_THRESHOLD = 90


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def verify_quote(quote: str, source: str) -> bool:
    """True when the quote is an exact (normalised) or near-exact substring of the source."""
    q = normalize(quote)
    if len(q) < MIN_QUOTE_CHARS:
        return False
    src = normalize(source)
    if q in src:
        return True
    return fuzz.partial_ratio(q, src) >= FUZZY_THRESHOLD


def locate_quote(quote: str, source: str) -> tuple[int, int] | None:
    """Character span of the quote in the original source (for highlighting), if it can be found."""
    if not quote:
        return None
    idx = source.lower().find(quote.lower().strip(" .\"'"))
    if idx >= 0:
        return idx, idx + len(quote.strip(" .\"'"))
    al = fuzz.partial_ratio_alignment(quote.lower(), source.lower())
    if al and al.score >= FUZZY_THRESHOLD:
        return al.dest_start, al.dest_end
    return None
