"""
system_prompt_store.py
-----------------------
Read/write access to the "system_prompts" collection in MongoDB - the
model's tone/templates/rules, editable from the System Prompt page in the
UI. Split out of draft_generator.py, which just calls load_system_prompt()
on every generation - see that module's docstring for why it's read fresh
every call rather than cached.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from config import SYSTEM_PROMPT_SEED_PATH
from db import get_db

# How much of a version's content the collapsed History card shows before
# "Restore"/expand needs the real thing - see list_system_prompt_versions().
_PREVIEW_LENGTH = 220


def load_system_prompt() -> str:
    """
    Read the current system prompt, fresh every call.

    The first time the "system_prompts" collection is empty (a fresh
    database), this seeds it from system_prompt_seed.md as version 1, so
    a new deployment boots with the real prompt instead of an error.
    """
    collection = get_db()["system_prompts"]
    latest = collection.find_one({}, sort=[("version", -1)])

    if latest is None:
        seed_content = SYSTEM_PROMPT_SEED_PATH.read_text(encoding="utf-8")
        collection.insert_one(
            {"version": 1, "content": seed_content, "updated_at": datetime.now(timezone.utc)}
        )
        return seed_content

    return latest["content"]


def get_system_prompt_version() -> int:
    """The version number currently active - shown in the UI so a viewer can see which prompt produced a given draft."""
    collection = get_db()["system_prompts"]
    latest = collection.find_one({}, sort=[("version", -1)], projection={"version": 1})
    return latest["version"] if latest else 0


def save_system_prompt(
    content: str,
    source: str = "manual",
    source_proposal_id: str = None,
    source_comment_id: str = None,
) -> int:
    """
    Save an edit as a new version - every past version is kept, none
    overwritten. `source` distinguishes a human editing the System Prompt
    page directly ("manual") from a triage-agent proposal a human approved
    ("proposal") - see prompt_proposal_store.py's approve_proposal(), the
    only other caller that passes source="proposal".
    """
    collection = get_db()["system_prompts"]
    latest = collection.find_one({}, sort=[("version", -1)])
    next_version = (latest["version"] + 1) if latest else 1
    collection.insert_one(
        {
            "version": next_version,
            "content": content,
            "updated_at": datetime.now(timezone.utc),
            "source": source,
            "source_proposal_id": source_proposal_id,
            "source_comment_id": source_comment_id,
        }
    )
    return next_version


def list_system_prompt_versions() -> list:
    """
    Every past version, newest first, for the System Prompt page's Version
    History LIST view - deliberately NOT the full content field. That field
    is the whole prompt text (tens of KB, and this collection never shrinks -
    live data has already reached version 60+), and the list view only ever
    renders a ~220-char preview per row (see PromptVersionHistory.jsx)
    until a specific version is expanded. Fetching every version's full
    text for a list of previews was confirmed to already cost several MB
    per page load - this aggregation computes just the preview + its true
    length (so the UI can still show "…" correctly) server-side instead.
    Full text for one version is a separate, on-demand call - see
    get_system_prompt_version_content() below.
    """
    collection = get_db()["system_prompts"]
    versions = list(
        collection.aggregate(
            [
                {"$sort": {"version": -1}},
                {
                    "$project": {
                        "version": 1,
                        "updated_at": 1,
                        "source": 1,
                        "source_proposal_id": 1,
                        "source_comment_id": 1,
                        "content_preview": {"$substrCP": ["$content", 0, _PREVIEW_LENGTH]},
                        "content_length": {"$strLenCP": "$content"},
                    }
                },
            ]
        )
    )
    for v in versions:
        v["_id"] = str(v["_id"])
    return versions


def get_system_prompt_version_content(version_id: str) -> Optional[dict]:
    """One version's full text, fetched on demand - only when a History card is expanded or Restored, never for the list."""
    collection = get_db()["system_prompts"]
    doc = collection.find_one({"_id": ObjectId(version_id)}, projection={"version": 1, "content": 1})
    if not doc:
        return None
    return {"version": doc["version"], "content": doc["content"]}
