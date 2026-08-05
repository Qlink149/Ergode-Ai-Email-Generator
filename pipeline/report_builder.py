"""
report_builder.py
------------------
Takes the raw list of per-case results produced by run_pipeline.py and
turns it into one report: a summary scorecard plus every individual case.

Saved as its own document in the "pipeline_runs" MongoDB collection -
write-once, never overwritten, so every run stays available as an audit
trail instead of replacing the previous one (which is what a single
report file used to do, silently, every time the pipeline ran).
"""

from datetime import datetime, timezone

from db import get_db


def _fact_fully_matched(fact_diff: dict) -> bool:
    """True if every fact type had nothing missing from our draft."""
    return all(len(entry["missing"]) == 0 for entry in fact_diff.values())


def build_summary(cases: list[dict]) -> dict:
    """Roll up all cases into the headline numbers for the scorecard."""
    total = len(cases)
    if total == 0:
        return {"total_cases": 0}

    category_matches = sum(1 for c in cases if c["comparison"]["category_match"])
    fact_matches = sum(1 for c in cases if _fact_fully_matched(c["comparison"]["fact_diff"]))
    avg_similarity = sum(c["comparison"]["similarity"] for c in cases) / total

    return {
        "total_cases": total,
        "category_match_rate": round(category_matches / total, 3),
        "fact_match_rate": round(fact_matches / total, 3),
        "average_similarity": round(avg_similarity, 3),
    }


def build_report(cases: list[dict]) -> dict:
    """Assemble the full report object: summary + every case's detail."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": build_summary(cases),
        "cases": cases,
    }


def save_report(report: dict) -> None:
    """Insert this run as a new document - every run is kept, none overwritten."""
    get_db()["pipeline_runs"].insert_one(dict(report))


def load_report() -> dict:
    """Return the most recent run, or an empty report if none exist yet."""
    latest = get_db()["pipeline_runs"].find_one({}, sort=[("generated_at", -1)])
    if not latest:
        return {"generated_at": None, "summary": {"total_cases": 0}, "cases": []}
    latest.pop("_id", None)
    return latest
