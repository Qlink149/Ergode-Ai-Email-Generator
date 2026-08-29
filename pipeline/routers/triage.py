"""routers/triage.py - the direct entry point server/routes/comments.js calls after inserting a comment."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth_dependency import require_auth
from triage_agent import run_and_persist_triage

router = APIRouter()


class TriageRequest(BaseModel):
    trigger_type: str  # "comment" | "draft_edit"
    order_id: Optional[str] = None
    author: str
    comment_id: Optional[str] = None
    thread_id: Optional[str] = None
    seq: Optional[str] = None
    source_text: str
    customer_message: Optional[str] = None
    ai_draft_reply: Optional[str] = None
    ai_reasoning: Optional[str] = None
    ai_policy_applied: Optional[str] = None
    order_facts: Optional[dict] = None
    thread_history: Optional[List[dict]] = None
    # Same shape AiContextPanel.jsx already renders for comments - carried
    # through untouched so a human reviewing a proposal/escalation later
    # sees the AI's original draft and reasoning, not just the triage
    # agent's verdict on it.
    ai_context: Optional[dict] = None


@router.post("/triage", dependencies=[Depends(require_auth)])
def triage(payload: TriageRequest):
    """Called by server/routes/comments.js right after a comment is inserted."""
    return run_and_persist_triage(payload.model_dump())
