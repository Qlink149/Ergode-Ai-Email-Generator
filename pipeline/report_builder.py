"""
report_builder.py
------------------
Takes the raw list of per-case results produced by run_pipeline.py and
turns it into one report file: a summary scorecard plus every individual
case, ready for the Express server to hand to the React viewer.
"""

import json
from datetime import datetime, timezone

from config import REPORTS_DIR

REPORT_PATH = REPORTS_DIR / "full_report.json"


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
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def load_report() -> dict:
    if not REPORT_PATH.exists():
        return {"generated_at": None, "summary": {"total_cases": 0}, "cases": []}
    return json.loads(REPORT_PATH.read_text(encoding="utf-8"))
