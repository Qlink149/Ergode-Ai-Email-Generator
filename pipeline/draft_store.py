"""Persists each generation (context + draft + analysis) to "ai_drafts", write-once. Best-effort - a save failure never fails the generation itself."""

from datetime import datetime, timezone
from typing import Optional

from pymongo.errors import PyMongoError

from db import get_db


def save_draft(thread_id: str, seq: str, context: dict, draft_reply: str, analysis: dict) -> None:
    try:
        get_db()["ai_drafts"].insert_one(
            {
                "thread_id": thread_id,
                "seq": seq,
                "context": context,
                "draft_reply": draft_reply,
                "analysis": analysis,
                "generated_at": datetime.now(timezone.utc),
            }
        )
    except PyMongoError:
        pass


def save_draft_edit(thread_id: str, seq: str, edited_reply: str) -> Optional[dict]:
    """
    Records a human edit on the latest generation for this thread/seq,
    without touching draft_reply. Also returns the generation's original
    context/draft_reply/analysis (already fetched as `latest` here) so a
    caller - the triage agent - has what it needs without a second query.
    """
    try:
        collection = get_db()["ai_drafts"]
        latest = collection.find_one(
            {"thread_id": thread_id, "seq": seq}, sort=[("generated_at", -1)]
        )
        if not latest:
            return None
        collection.update_one(
            {"_id": latest["_id"]},
            {"$set": {"edited_reply": edited_reply, "edited_at": datetime.now(timezone.utc)}},
        )
        return {
            "thread_id": thread_id,
            "seq": seq,
            "edited_reply": edited_reply,
            "context": latest.get("context"),
            "draft_reply": latest.get("draft_reply"),
            "analysis": latest.get("analysis"),
        }
    except PyMongoError:
        return None
