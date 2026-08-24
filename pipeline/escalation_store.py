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
someone views the Pending Approvals page's review section.
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
            "created_at": datetime.now(timezone.utc),
            "seen_at": None,
        }
        inserted = collection.insert_one(doc)
        return str(inserted.inserted_id)
    except PyMongoError:
        return None


def get_escalations(status: Optional[str] = None) -> list:
    collection = get_db()["escalations"]
    query = {"status": status} if status else {}
    docs = collection.find(query, sort=[("created_at", -1)])
    return [_serialize(d) for d in docs]


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
