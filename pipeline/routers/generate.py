"""routers/generate.py - draft generation, the only route that calls draft_generator.py."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from openai import OpenAI

from auth_dependency import require_auth
from config import OPENAI_API_KEY, require_openai_key
from draft_generator import generate_draft
from system_prompt_store import get_system_prompt_version
from analysis import analyze_message
from draft_store import save_draft

router = APIRouter()


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
