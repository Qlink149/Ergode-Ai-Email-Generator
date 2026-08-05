"""
recompute_report.py
--------------------
Re-scores an existing report using the current comparison.py logic,
without calling OpenAI again. The real and drafted reply text are already
saved in the report - only the scoring (fact-diff, category, similarity)
needs to re-run. Use this after tweaking comparison.py, so a classifier
fix doesn't cost another full batch of API calls to verify.
"""

from comparison import compare_pair
from report_builder import build_report, save_report, load_report


def recompute() -> None:
    report = load_report()
    if not report["cases"]:
        print("No existing report in MongoDB - nothing to recompute.")
        return

    for case in report["cases"]:
        case["comparison"] = compare_pair(case["actual_reply"], case["draft_reply"])

    fresh_report = build_report(report["cases"])
    save_report(fresh_report)

    print("Recomputed.")
    print("New summary:", fresh_report["summary"])


if __name__ == "__main__":
    recompute()
