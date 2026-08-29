"""
proposal_stats.py
------------------
get_proposal_stats() - the one MongoDB aggregation behind the Pending
Approvals page's stat cards/donut/filter-tab counts, split out of
prompt_proposal_store.py purely for length. Re-exported from there
(`from prompt_proposal_store import get_proposal_stats` still works)
so no caller needed to change.
"""

from datetime import datetime, timedelta, timezone

from db import get_db

# Every bucket the UI groups a status into - see PendingApprovalsPage's
# bucketOf() on the frontend, mirrored here so the aggregation below
# produces the exact same 4 buckets without the frontend ever downloading
# a raw status list to bucket itself.
_BUCKET_EXPR = {
    "$switch": {
        "branches": [
            {"case": {"$eq": ["$status", "pending"]}, "then": "pending"},
            {"case": {"$eq": ["$status", "approved"]}, "then": "implemented"},
            {"case": {"$eq": ["$status", "rejected"]}, "then": "rejected"},
        ],
        "default": "needs_attention",  # already_covered, needs_manual_review
    }
}


def get_proposal_stats() -> dict:
    """
    The counts PendingApprovalsPage's stat cards/donut/filter-tabs need,
    computed by MongoDB instead of downloaded-then-reduced in the browser
    (see the analytics-architecture section of the Vercel/MongoDB audit).
    Returns the same shape the old client-side useMemo produced, plus
    non_override_total (every proposal NOT created by a human override -
    the frontend needs this one extra number to compute "Total Triaged"
    without double-counting an overridden escalation's own proposal record).
    """
    collection = get_db()["prompt_proposals"]
    week_cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    pipeline = [
        {
            "$facet": {
                "all_time": [
                    {"$group": {"_id": _BUCKET_EXPR, "count": {"$sum": 1}}},
                ],
                "this_week": [
                    {"$match": {"created_at": {"$gte": week_cutoff}}},
                    {"$group": {"_id": _BUCKET_EXPR, "count": {"$sum": 1}}},
                ],
                "non_override_total": [
                    {"$match": {"trigger_type": {"$ne": "override"}}},
                    {"$count": "count"},
                ],
            }
        }
    ]
    result = list(collection.aggregate(pipeline))[0]

    counts = {"pending": 0, "implemented": 0, "rejected": 0, "needs_attention": 0}
    week_counts = {"pending": 0, "implemented": 0, "rejected": 0, "needs_attention": 0}
    for row in result["all_time"]:
        counts[row["_id"]] = row["count"]
    for row in result["this_week"]:
        week_counts[row["_id"]] = row["count"]
    non_override_total = result["non_override_total"][0]["count"] if result["non_override_total"] else 0

    return {
        "counts": counts,
        "weekCounts": week_counts,
        "total": sum(counts.values()),
        "non_override_total": non_override_total,
    }
