"""
escalation_store.py
--------------------
Read/write access to "escalations" - every comment/edit the triage agent
did NOT turn into a prompt-fix proposal: a real code gap
("code_restriction", notify Clara), a real data gap ("data_restriction",
notify Clara and Ergode), or genuinely nothing actionable ("none", notify
nobody). All three still get a record here - a human should always be
able to see what the AI decided about every piece of feedback, not just
the ones it flagged, so nothing is silently dropped. There's nothing to
approve here, only to acknowledge - status moves unseen -> seen once
someone views the Pending Approvals page's review section. A human who
disagrees with the AI's call can override it (see
prompt_proposal_store.py's create_proposal_from_override()), which sets
overridden_proposal_id here pointing at the resulting proposal.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo.errors import PyMongoError

from db import get_db

_NOTIFY_TARGETS = {
    "code_restriction": ["clara"],
    "data_restriction": ["clara", "ergode"],
    "none": [],
}


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def save_escalation(context: dict, result: dict, outcome: str) -> Optional[str]:
    """
    Records one triage outcome that isn't a prompt fix - a code/data
    restriction, or "none". Best-effort, like draft_store.py's saves.
    Stores the full ai_context blob (same shape CommentsSidebar.jsx
    already renders via AiContextPanel) so a human reviewing this later
    sees the AI's original draft and reasoning, not just the triage
    agent's verdict on it.
    """
    try:
        collection = get_db()["escalations"]
        doc = {
            "type": outcome,
            "status": "unseen",
            "notify": _NOTIFY_TARGETS.get(outcome, []),
            "trigger_type": context.get("trigger_type"),
            "comment_id": context.get("comment_id"),
            "thread_id": context.get("thread_id"),
            "seq": context.get("seq"),
            "order_id": context.get("order_id"),
            "author": context.get("author"),
            "source_text": context.get("source_text"),
            "reason": result.get("reason", ""),
            # Kept as their own top-level fields, not just nested inside
            # ai_context - shown directly on the card (like CommentsSidebar
            # already does), not buried behind the collapsed AI-context panel.
            "customer_message": context.get("customer_message"),
            "ai_draft_reply": context.get("ai_draft_reply"),
            "ai_context": context.get("ai_context"),
            "created_at": datetime.now(timezone.utc),
            "seen_at": None,
            "overridden_proposal_id": None,
        }
        inserted = collection.insert_one(doc)
        return str(inserted.inserted_id)
    except PyMongoError:
        return None


# See prompt_proposal_store.py's DEFAULT_PAGE_SIZE for the reasoning -
# same default, same "well above any real count seen live" logic.
DEFAULT_PAGE_SIZE = 200


def get_escalations(status: Optional[str] = None, page: int = 1, limit: int = DEFAULT_PAGE_SIZE) -> tuple:
    """Returns (escalations, total_count), one page at a time - see the Vercel/MongoDB audit, this had no limit at all before."""
    collection = get_db()["escalations"]
    query = {"status": status} if status else {}
    total = collection.count_documents(query)
    page = max(1, page)
    limit = max(1, min(limit, 500))
    docs = collection.find(query, sort=[("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    return [_serialize(d) for d in docs], total


def get_escalation_stats() -> dict:
    """Counts by type, computed by MongoDB - what EscalationSection's stat bar needs, without downloading every escalation to count them client-side."""
    collection = get_db()["escalations"]
    rows = list(collection.aggregate([{"$group": {"_id": "$type", "count": {"$sum": 1}}}]))
    counts = {"code_restriction": 0, "data_restriction": 0, "none": 0}
    for row in rows:
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    return {"counts": counts, "total": sum(counts.values())}


def get_escalation(escalation_id: str) -> Optional[dict]:
    collection = get_db()["escalations"]
    doc = collection.find_one({"_id": ObjectId(escalation_id)})
    return _serialize(doc) if doc else None


def mark_escalation_overridden(escalation_id: str, proposal_id: str) -> None:
    """Links an escalation to the proposal a human override created from it, for traceability."""
    collection = get_db()["escalations"]
    collection.update_one(
        {"_id": ObjectId(escalation_id)},
        {"$set": {"overridden_proposal_id": proposal_id}},
    )


def mark_escalations_seen(ids: list) -> int:
    if not ids:
        return 0
    collection = get_db()["escalations"]
    object_ids = [ObjectId(i) for i in ids]
    result = collection.update_many(
        {"_id": {"$in": object_ids}, "status": "unseen"},
        {"$set": {"status": "seen", "seen_at": datetime.now(timezone.utc)}},
    )
    return result.modified_count


def count_unseen_escalations() -> int:
    collection = get_db()["escalations"]
    return collection.count_documents({"status": "unseen"})
