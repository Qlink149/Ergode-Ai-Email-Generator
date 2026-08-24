"""
api.py
------
A small FastAPI service that exposes the pipeline's building blocks over
HTTP: generate a draft on demand, analyze it, and read/update the live
system prompt. The Node/Express server calls this internally - the browser
never talks to this service directly (see server/routes/generate.js and
server/routes/systemPrompt.js).

Run with:
    uvicorn api:app --port 8001 --reload
"""

import sys
from pathlib import Path
from typing import List, Optional

# Vercel's Python runtime loads this file as the entry point but does not
# add its own directory to sys.path, so the plain sibling imports below
# (from config import ..., from draft_generator import ...) fail with
# "ModuleNotFoundError: No module named 'config'" once deployed, even
# though they work fine locally (where we always run from inside
# pipeline/, so the directory is on sys.path implicitly). This makes that
# true in both places.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from openai import OpenAI

from auth_token import verify_token
from config import OPENAI_API_KEY, require_openai_key
from draft_generator import generate_draft
from system_prompt_store import (
    load_system_prompt,
    save_system_prompt,
    get_system_prompt_version,
    list_system_prompt_versions,
)
from analysis import analyze_message
from draft_store import save_draft, save_draft_edit
from translator import translate_to_english
from triage_agent import run_and_persist_triage
from prompt_proposal_store import get_pending_proposals, approve_proposal, reject_proposal
from escalation_store import get_escalations, mark_escalations_seen, count_unseen_escalations

app = FastAPI(title="Ergode AI Pipeline")

# Routes are defined on this router, then mounted twice below - once
# unprefixed (for local dev, where PIPELINE_URL is a bare
# http://localhost:8001 with no path) and once under /pyapi (for
# production, where server and pipeline deploy together as one Vercel
# project - see the root vercel.json - and Vercel forwards the FULL
# incoming path, including the /pyapi prefix, to this function rather
# than stripping it). Same handlers, reachable both ways.
router = APIRouter()


def require_auth(authorization: str = Header(default="")) -> None:
    """
    In local dev, the Node server already checks this token before ever
    reaching this service (see server.js's middleware) - but in
    production, Vercel routes /pyapi/(.*) straight here (root
    vercel.json), completely bypassing Express. Without this, anyone who
    finds that path could generate OpenAI-billed drafts or overwrite the
    live system prompt with no login at all.
    """
    token = authorization[len("Bearer "):] if authorization.startswith("Bearer ") else None
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")


class ThreadHistoryEntry(BaseModel):
    direction: str  # "in" or "out"
    text: str


class OrderFacts(BaseModel):
    """Customer-safe fields. See server/services/disclosureClassifier.js."""

    recipient_name: Optional[str] = None
    product_name: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_id: Optional[str] = None
    tracking_url: Optional[str] = None
    shipped_date: Optional[str] = None
    purchase_date: Optional[str] = None
    customer_tracking_status: Optional[str] = None
    ship_method: Optional[str] = None
    promised_delivery_date: Optional[str] = None
    total_price: Optional[str] = None
    customer_refund_amount: Optional[str] = None
    refund_date: Optional[str] = None
    last_mile_carrier: Optional[str] = None
    last_mile_tracking: Optional[str] = None
    # Deprecated: proven unreliable against real threads, no longer sent by
    # the client, kept only so old callers don't hard-fail.
    internal_status_note: Optional[str] = None


class GenerateRequest(BaseModel):
    # Optional: when the CRM has no usable inbound text (a known gap - see
    # crmThreadApiClient.js), generation can still proceed as a proactive
    # status update from order_facts alone.
    customer_message: str = ""
    order_id: Optional[str] = None
    is_relay: bool = False
    thread_history: List[ThreadHistoryEntry] = []
    language: Optional[str] = None  # e.g. "Spanish" - overrides auto-detection when set
    order_facts: Optional[OrderFacts] = None  # real, verified data from the Order API
    thread_id: Optional[str] = None  # if set, this generation is saved to ai_drafts
    seq: Optional[str] = None  # a message seq (as a string) or "latest"
    # From the CRM Thread API (server/routes/tickets.js's threadMeta) - per
    # Ergode's own team, this reflects the live agent/customer transaction
    # and takes priority over order_facts when the two disagree.
    # cancellation_marked specifically means "an interception attempt with
    # the fulfillment partner is in progress", not "the order is
    # cancelled" - see the system prompt's cancellation-in-progress rule.
    cancellation_marked: Optional[bool] = None
    thread_reason: Optional[str] = None


class GenerateResponse(BaseModel):
    draft_reply: str
    analysis: dict
    context: dict  # what the model actually saw, for the UI's "AI context" panel
    system_prompt_version: int


@router.post("/generate", response_model=GenerateResponse, dependencies=[Depends(require_auth)])
def generate(payload: GenerateRequest):
    """Generate a draft reply for a customer message, right now, on demand."""
    require_openai_key()
    client = OpenAI(api_key=OPENAI_API_KEY)

    context = {
        "customer_message": payload.customer_message,
        "order_id": payload.order_id,
        "is_relay": payload.is_relay,
        "thread_history": [entry.model_dump() for entry in payload.thread_history],
        "language": payload.language,
        "order_facts": payload.order_facts.model_dump() if payload.order_facts else None,
        "cancellation_marked": payload.cancellation_marked,
        "thread_reason": payload.thread_reason,
    }

    draft = generate_draft(context, client=client)
    analysis = analyze_message(
        payload.customer_message,
        draft,
        order_facts=context["order_facts"],
        thread_history=context["thread_history"],
        client=client,
    )

    if payload.thread_id:
        save_draft(payload.thread_id, payload.seq, context, draft, analysis)

    return {
        "draft_reply": draft,
        "analysis": analysis,
        "context": context,
        "system_prompt_version": get_system_prompt_version(),
    }


class SystemPromptPayload(BaseModel):
    content: str


@router.get("/system-prompt", dependencies=[Depends(require_auth)])
def get_system_prompt():
    """Return the system prompt exactly as it is used for the next generation."""
    return {"content": load_system_prompt()}


@router.put("/system-prompt", dependencies=[Depends(require_auth)])
def update_system_prompt(payload: SystemPromptPayload):
    """
    Save the edit as a new version in MongoDB. Because draft_generator.py
    reads the latest version fresh on every call, this takes effect on the
    very next /generate request - no restart needed. Every past version
    stays in the database.
    """
    version = save_system_prompt(payload.content)
    return {"status": "saved", "version": version}


@router.get("/system-prompt/versions", dependencies=[Depends(require_auth)])
def system_prompt_versions():
    """Every past version, newest first, for the System Prompt page's Version History view."""
    return {"versions": list_system_prompt_versions()}


class DraftEditPayload(BaseModel):
    thread_id: str
    seq: str
    edited_reply: str


@router.put("/draft-edit", dependencies=[Depends(require_auth)])
def edit_draft(payload: DraftEditPayload):
    """
    Saves a human edit to a draft - the original draft_reply is left
    untouched. A manual rewrite is itself feedback (it shows exactly what
    was wrong), so this also runs it through the triage agent - best
    effort, never lets a triage failure turn a successful save into an
    error response.
    """
    result = save_draft_edit(payload.thread_id, payload.seq, payload.edited_reply)
    if result is None:
        return {"status": "not_found"}

    try:
        ctx = result.get("context") or {}
        analysis = result.get("analysis") or {}
        run_and_persist_triage(
            {
                "trigger_type": "draft_edit",
                "order_id": ctx.get("order_id"),
                "author": "unknown",  # the draft-edit form has no author field today
                "thread_id": payload.thread_id,
                "seq": payload.seq,
                "source_text": payload.edited_reply,
                "customer_message": ctx.get("customer_message"),
                "ai_draft_reply": result.get("draft_reply"),
                "ai_reasoning": analysis.get("reasoning"),
                "ai_policy_applied": analysis.get("policy_applied"),
                "order_facts": ctx.get("order_facts"),
                "thread_history": ctx.get("thread_history"),
            }
        )
    except Exception:
        pass

    return {
        "status": "saved",
        "thread_id": result["thread_id"],
        "seq": result["seq"],
        "edited_reply": result["edited_reply"],
    }


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


@router.post("/triage", dependencies=[Depends(require_auth)])
def triage(payload: TriageRequest):
    """Called by server/routes/comments.js right after a comment is inserted."""
    return run_and_persist_triage(payload.model_dump())


@router.get("/proposals", dependencies=[Depends(require_auth)])
def list_proposals():
    """Pending prompt-fix proposals, for the Pending Approvals page."""
    return {"proposals": get_pending_proposals()}


@router.post("/proposals/{proposal_id}/approve", dependencies=[Depends(require_auth)])
def approve(proposal_id: str):
    """
    Re-checks the fix against the CURRENT live prompt before applying it
    (see prompt_proposal_store.py's approve_proposal()) - the response's
    "status" reflects what actually happened: "approved" if the fix went
    live just now, "already_covered" if the live prompt turned out to
    already cover it and nothing was changed.
    """
    result = approve_proposal(proposal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Proposal not found or already reviewed")
    if result.get("needs_manual_review"):
        status = "needs_manual_review"
    elif result.get("already_covered"):
        status = "already_covered"
    else:
        status = "approved"
    return {"status": status, **result}


@router.post("/proposals/{proposal_id}/reject", dependencies=[Depends(require_auth)])
def reject(proposal_id: str):
    result = reject_proposal(proposal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Proposal not found or already reviewed")
    return {"status": "rejected", **result}


@router.get("/escalations", dependencies=[Depends(require_auth)])
def list_escalations(status: Optional[str] = None):
    return {"escalations": get_escalations(status)}


class EscalationSeenPayload(BaseModel):
    ids: List[str]


@router.post("/escalations/seen", dependencies=[Depends(require_auth)])
def escalations_seen(payload: EscalationSeenPayload):
    count = mark_escalations_seen(payload.ids)
    return {"status": "ok", "updated": count}


@router.get("/notifications/summary", dependencies=[Depends(require_auth)])
def notifications_summary():
    return {
        "pending_proposals_count": len(get_pending_proposals()),
        "unseen_escalations_count": count_unseen_escalations(),
    }


class TranslatePayload(BaseModel):
    text: str


@router.post("/translate", dependencies=[Depends(require_auth)])
def translate(payload: TranslatePayload):
    """Translates one message to English for display, if it isn't already."""
    require_openai_key()
    translated = translate_to_english(payload.text, client=OpenAI(api_key=OPENAI_API_KEY))
    return {"translated": translated}


@router.get("/health")
def health():
    return {"status": "ok"}


# Mounted twice - see the comment above router's definition.
app.include_router(router)
app.include_router(router, prefix="/pyapi")
