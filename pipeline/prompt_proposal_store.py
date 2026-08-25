"""
prompt_proposal_store.py
-------------------------
Read/write access to "prompt_proposals" - system-prompt fixes the triage
agent drafted (see triage_agent.py), held pending until a human approves
or rejects them from the Pending Approvals page. Unlike system_prompts
(append-only, one "current" version), proposals are mutable: several can
be pending at once, and each one moves status exactly once - pending ->
rejected, or pending -> approved (the fix went live), pending ->
already_covered (the live prompt already covered it by the time anyone
clicked Approve), or pending -> needs_manual_review (the exact anchor
text couldn't be found in the current prompt - see approve_proposal()).

Each fix is stored and applied as an edit_type/anchor_text/new_text
triple, never a full replacement prompt. An earlier version of this store
asked the model to return the whole ~50KB prompt with the fix merged in,
and testing directly caught it silently dropping an unrelated existing
line while doing that - reproducing a large document verbatim isn't
something a model can be trusted to do 100% reliably, even when told to
preserve everything. Applying the fix as a literal, deterministic
find-and-splice in code (apply_edit(), below) removes that risk entirely:
either the anchor text is found and the edit is exact, or it isn't and
nothing is touched.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from pymongo.errors import PyMongoError

from db import get_db
from system_prompt_store import save_system_prompt, load_system_prompt


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def apply_edit(current_prompt: str, edit_type: str, anchor_text: str, new_text: str):
    """
    Deterministic, code-only splice - no model involved in this step at
    all. Returns (success: bool, content_or_none: Optional[str], note: str).
    Refuses (success=False) unless anchor_text appears in current_prompt
    exactly once, so there's never any ambiguity about where the edit goes
    and never any risk of the rest of the document being altered.
    """
    if not anchor_text or not new_text or edit_type not in ("insert_after", "replace"):
        return False, None, "Malformed edit (missing anchor/new text, or unknown edit_type)."

    count = current_prompt.count(anchor_text)
    if count == 0:
        return False, None, "The anchor text no longer appears in the current live prompt - it may have changed."
    if count > 1:
        return False, None, f"The anchor text appears {count} times in the current prompt - too ambiguous to apply safely."

    if edit_type == "insert_after":
        merged = current_prompt.replace(anchor_text, f"{anchor_text}\n{new_text}", 1)
    else:
        merged = current_prompt.replace(anchor_text, new_text, 1)

    return True, merged, "Applied cleanly."


def save_prompt_proposal(context: dict, result: dict) -> Optional[str]:
    """
    Stores one triage-agent prompt-fix proposal as pending. Best-effort,
    like draft_store.py's saves. Stores the full ai_context blob (same
    shape CommentsSidebar.jsx renders via AiContextPanel) alongside it, so
    a human reviewing this later sees the AI's original draft and
    reasoning, not just the proposed fix.
    """
    try:
        collection = get_db()["prompt_proposals"]
        doc = {
            "status": "pending",
            "trigger_type": context.get("trigger_type"),
            "comment_id": context.get("comment_id"),
            "thread_id": context.get("thread_id"),
            "seq": context.get("seq"),
            "order_id": context.get("order_id"),
            "author": context.get("author"),
            "source_text": context.get("source_text"),
            "reason": result.get("reason", ""),
            "edit_type": result.get("edit_type", ""),
            "anchor_text": result.get("anchor_text", ""),
            "new_text": result.get("new_text", ""),
            "contradiction_check": result.get("contradiction_check", ""),
            # Kept as their own top-level fields, not just nested inside
            # ai_context - shown directly on the card, not buried behind
            # the collapsed AI-context panel.
            "customer_message": context.get("customer_message"),
            "ai_draft_reply": context.get("ai_draft_reply"),
            "ai_context": context.get("ai_context"),
            "source_escalation_id": context.get("source_escalation_id"),
            "created_at": datetime.now(timezone.utc),
            "reviewed_at": None,
            "reviewed_outcome_version": None,
        }
        inserted = collection.insert_one(doc)
        return str(inserted.inserted_id)
    except PyMongoError:
        return None


def get_pending_proposals() -> list:
    collection = get_db()["prompt_proposals"]
    docs = collection.find({"status": "pending"}, sort=[("created_at", -1)])
    return [_serialize(d) for d in docs]


def count_pending_proposals() -> int:
    """Count only, no documents fetched - for the notifications bell, which polls this every 45s from every open tab."""
    return get_db()["prompt_proposals"].count_documents({"status": "pending"})


# Default page size for get_all_proposals() - well above every real
# proposal count seen live so far, so paginating in doesn't change today's
# behavior at all; it just puts a ceiling on how much a single request can
# ever return once that stops being true. See the Vercel/MongoDB audit -
# this collection had no limit at all before.
DEFAULT_PAGE_SIZE = 200


def get_all_proposals(status: Optional[str] = None, page: int = 1, limit: int = DEFAULT_PAGE_SIZE) -> tuple:
    """
    Every proposal regardless of outcome, newest first, one page at a
    time - for the Pending Approvals page's history view. Returns
    (proposals, total_count) so the caller can show "N of M" or paginate
    further without a second round trip just to know the total.
    """
    collection = get_db()["prompt_proposals"]
    query = {"status": status} if status else {}
    total = collection.count_documents(query)
    page = max(1, page)
    limit = max(1, min(limit, 500))  # hard ceiling - never let a client ask for "everything" again
    docs = collection.find(query, sort=[("created_at", -1)]).skip((page - 1) * limit).limit(limit)
    return [_serialize(d) for d in docs], total


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


def create_proposal_from_override(escalation: dict, override_note: str, author: str) -> Optional[str]:
    """
    A human disagreed with a triage verdict (see api.py's POST
    /escalations/{id}/override) and wants a real fix drafted anyway. Runs
    the same anchor-based drafting logic (triage_agent.py's
    draft_fix_from_override()) against the current live prompt, then
    stores it as a normal pending proposal - it still needs a separate
    Approve click, same as any other proposal, the override doesn't apply
    anything by itself.
    """
    from triage_agent import draft_fix_from_override

    result = draft_fix_from_override(escalation, override_note)
    if not result.get("anchor_text") or not result.get("new_text"):
        return None

    context = {
        "trigger_type": "override",
        "comment_id": escalation.get("comment_id"),
        "thread_id": escalation.get("thread_id"),
        "seq": escalation.get("seq"),
        "order_id": escalation.get("order_id"),
        "author": author,
        "source_text": override_note,
        "customer_message": escalation.get("customer_message"),
        "ai_draft_reply": escalation.get("ai_draft_reply"),
        "ai_context": escalation.get("ai_context"),
        "source_escalation_id": escalation.get("_id"),
    }
    return save_prompt_proposal(context, result)


def get_proposal(proposal_id: str) -> Optional[dict]:
    collection = get_db()["prompt_proposals"]
    doc = collection.find_one({"_id": ObjectId(proposal_id)})
    return _serialize(doc) if doc else None


def approve_proposal(proposal_id: str) -> Optional[dict]:
    """
    Applies a proposal's fix as the new live prompt version - but not
    blindly. Time may have passed since it was drafted (another proposal
    could have been approved, or someone edited the prompt by hand in the
    meantime), so this first re-checks the fix against whatever the live
    prompt actually looks like right now (see triage_agent.py's
    recheck_and_merge_proposal()), then applies it with a deterministic,
    code-only splice (apply_edit()) rather than trusting model-generated
    full-document text.
    """
    collection = get_db()["prompt_proposals"]
    doc = collection.find_one({"_id": ObjectId(proposal_id), "status": "pending"})
    if not doc:
        return None

    # Deferred import - triage_agent.py imports this module at load time
    # (for save_prompt_proposal), so importing it back at module level
    # here would be circular. Safe to import inside the function: by the
    # time this runs, both modules have already finished loading.
    from triage_agent import recheck_and_merge_proposal

    current_prompt = load_system_prompt()
    recheck = recheck_and_merge_proposal(current_prompt, doc)

    if recheck.get("already_covered"):
        collection.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "status": "already_covered",
                    "reviewed_at": datetime.now(timezone.utc),
                    "recheck_note": recheck.get("note", ""),
                }
            },
        )
        return {"proposal_id": str(doc["_id"]), "already_covered": True, "note": recheck.get("note", "")}

    edit_type = recheck.get("edit_type") or doc.get("edit_type", "")
    anchor_text = recheck.get("anchor_text") or doc.get("anchor_text", "")
    new_text = recheck.get("new_text") or doc.get("new_text", "")

    success, merged_content, note = apply_edit(current_prompt, edit_type, anchor_text, new_text)

    if not success:
        full_note = f"Not applied automatically - {note} Apply this fix by hand instead, via the System Prompt editor."
        collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": "needs_manual_review", "reviewed_at": datetime.now(timezone.utc), "recheck_note": full_note}},
        )
        return {"proposal_id": str(doc["_id"]), "already_covered": False, "needs_manual_review": True, "note": full_note}

    version = save_system_prompt(
        merged_content,
        source="proposal",
        source_proposal_id=str(doc["_id"]),
        source_comment_id=doc.get("comment_id"),
    )
    collection.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": "approved",
                "reviewed_at": datetime.now(timezone.utc),
                "reviewed_outcome_version": version,
            }
        },
    )
    return {"proposal_id": str(doc["_id"]), "already_covered": False, "version": version}


def reject_proposal(proposal_id: str) -> Optional[dict]:
    collection = get_db()["prompt_proposals"]
    doc = collection.find_one({"_id": ObjectId(proposal_id), "status": "pending"})
    if not doc:
        return None
    collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "rejected", "reviewed_at": datetime.now(timezone.utc)}},
    )
    return {"proposal_id": str(doc["_id"])}
