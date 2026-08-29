"""routers/draft_edit.py - saving a human edit to a draft, and the permanent-fix guardrail into triage."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth_dependency import require_auth
from draft_store import save_draft_edit
from triage_agent import run_and_persist_triage

router = APIRouter()


class DraftEditPayload(BaseModel):
    thread_id: str
    seq: str
    edited_reply: str
    # Guardrail: a plain edit is now just saved for THIS one reply. It only
    # goes to the triage agent (and so becomes a proposal/escalation a human
    # has to review) when the editor explicitly marks it a permanent fix -
    # and the Node server only forwards permanent_fix=true from a user who
    # has the flagPermanentFix permission (see server/routes/draftEdit.js).
    permanent_fix: bool = False
    author: Optional[str] = None


@router.put("/draft-edit", dependencies=[Depends(require_auth)])
def edit_draft(payload: DraftEditPayload):
    """
    Saves a human edit to a draft - the original draft_reply is left
    untouched. When permanent_fix is set, the rewrite is also treated as
    feedback and run through the triage agent (best effort - a triage
    failure never turns a successful save into an error). Without it, the
    edit is a one-off and nothing else happens.
    """
    result = save_draft_edit(payload.thread_id, payload.seq, payload.edited_reply, edited_by=payload.author)
    if result is None:
        return {"status": "not_found"}

    triaged = False
    if payload.permanent_fix:
        try:
            ctx = result.get("context") or {}
            analysis = result.get("analysis") or {}
            # Same shape as the ai_context object GenerateWithAiPanel.jsx builds
            # and comments already carry (context/reasoning/policy_applied/
            # fields_used) - so AiContextPanel.jsx can render it identically
            # here, even though this generation was never a Comment. No
            # system_prompt_version/thread_meta on hand for a draft edit -
            # AiContextPanel.jsx handles missing threadMeta fine already.
            ai_context = {
                "context": ctx,
                "reasoning": analysis.get("reasoning"),
                "policy_applied": analysis.get("policy_applied"),
                "fields_used": analysis.get("fields_used"),
            }
            run_and_persist_triage(
                {
                    "trigger_type": "draft_edit",
                    "order_id": ctx.get("order_id"),
                    "author": payload.author or "unknown",
                    "thread_id": payload.thread_id,
                    "seq": payload.seq,
                    "source_text": payload.edited_reply,
                    "customer_message": ctx.get("customer_message"),
                    "ai_draft_reply": result.get("draft_reply"),
                    "ai_reasoning": analysis.get("reasoning"),
                    "ai_policy_applied": analysis.get("policy_applied"),
                    "order_facts": ctx.get("order_facts"),
                    "thread_history": ctx.get("thread_history"),
                    "ai_context": ai_context,
                }
            )
            triaged = True
        except Exception:
            pass

    return {
        "status": "saved",
        "triaged": triaged,
        "thread_id": result["thread_id"],
        "seq": result["seq"],
        "edited_reply": result["edited_reply"],
    }
