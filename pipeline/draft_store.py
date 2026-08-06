"""
draft_store.py
----------------
Persists every on-demand generation to the "ai_drafts" collection - the
input context and the resulting draft + analysis, kept together as one
record. This is the write side of the AI journey: generation reads its
context from the same MongoDB the zip data lives in, and every case it
produces gets written back into that same database, instead of only ever
existing in the browser's memory until the page is refreshed.

Write-once, like pipeline_runs - a new document per generation, nothing
overwritten, so past drafts stay available even if the same message gets
regenerated again later.

Best-effort by design: a save failure here should never fail the
generation the user is actually waiting on.
"""

from datetime import datetime, timezone

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
