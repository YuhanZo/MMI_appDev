"""Scoring helpers for the eval harness. Pure functions, no network calls."""

import re

# Common ways the same skill gets written. Keys and values are lowercase.
ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "react.js": "react",
    "reactjs": "react",
    "node": "node.js",
    "nodejs": "node.js",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "amazon web services": "aws",
    "rest": "rest apis",
    "rest api": "rest apis",
    "restful apis": "rest apis",
    "golang": "go",
    "ml": "machine learning",
}


def norm(skill: str) -> str:
    s = re.sub(r"\s+", " ", skill.strip().lower())
    return ALIASES.get(s, s)


def norm_set(skills) -> set[str]:
    return {norm(s) for s in skills or [] if s and s.strip()}


def prf(predicted, expected) -> dict:
    """Precision, recall and F1 of predicted skills against expected ones."""
    p, e = norm_set(predicted), norm_set(expected)
    hit = len(p & e)
    precision = hit / len(p) if p else (1.0 if not e else 0.0)
    recall = hit / len(e) if e else (1.0 if not p else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": round(precision, 2), "recall": round(recall, 2), "f1": round(f1, 2)}


def overlap(a, b) -> list[str]:
    return sorted(norm_set(a) & norm_set(b))


def ungrounded(matched, profile: dict) -> list[str]:
    """Matched skills that appear nowhere in the candidate's profile."""
    known = norm_set(profile.get("skills", []))
    text = " ".join(
        [" ".join(profile.get("skills", [])), profile.get("experience", ""), profile.get("education", "")]
    ).lower()
    return sorted(s for s in norm_set(matched) if s not in known and s not in text)


def mentions_any(texts, keywords) -> bool:
    blob = " ".join(t for t in texts if t).lower()
    return any(k.lower() in blob for k in keywords)


def differs(new, old) -> bool:
    def clean(s):
        return re.sub(r"\s+", " ", (s or "").strip().lower())

    return bool(clean(new)) and clean(new) != clean(old)


def length_ok(items, lo: int = 2, hi: int = 4) -> bool:
    return lo <= len(items or []) <= hi