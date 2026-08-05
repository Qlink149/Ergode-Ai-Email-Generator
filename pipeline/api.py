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

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from openai import OpenAI

from config import OPENAI_API_KEY, require_openai_key
from draft_generator import generate_draft, load_system_prompt, save_system_prompt
from analysis import analyze_message

app = FastAPI(title="Ergode AI Pipeline")

# Routes are defined on this router, then mounted twice below - once
# unprefixed (for local dev, where PIPELINE_URL is a bare
# http://localhost:8001 with no path) and once under /pyapi (for
# production, where server and pipeline deploy together as one Vercel
# project - see the root vercel.json - and Vercel forwards the FULL
# incoming path, including the /pyapi prefix, to this function rather
# than stripping it). Same handlers, reachable both ways.
router = APIRouter()


class ThreadHistoryEntry(BaseModel):
    direction: str  # "in" or "out"
    text: str


class OrderFacts(BaseModel):
    """
    Customer-safe fields, plus one reasoning-only field. See
    server/services/disclosureClassifier.js.
    """

    recipient_name: Optional[str] = None
    product_name: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_id: Optional[str] = None
    tracking_url: Optional[str] = None
    shipped_date: Optional[str] = None
    purchase_date: Optional[str] = None
    customer_tracking_status: Optional[str] = None
    # Plain-English order status (e.g. "Cancelled") for the AI's reasoning
    # only - draft_generator.py is responsible for keeping it out of output.
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


class GenerateResponse(BaseModel):
    draft_reply: str
    analysis: dict


@router.post("/generate", response_model=GenerateResponse)
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
    }

    draft = generate_draft(context, client=client)
    analysis = analyze_message(payload.customer_message, draft, client=client)

    return {"draft_reply": draft, "analysis": analysis}


class SystemPromptPayload(BaseModel):
    content: str


@router.get("/system-prompt")
def get_system_prompt():
    """Return the system prompt exactly as it is used for the next generation."""
    return {"content": load_system_prompt()}


@router.put("/system-prompt")
def update_system_prompt(payload: SystemPromptPayload):
    """
    Save the edit as a new version in MongoDB. Because draft_generator.py
    reads the latest version fresh on every call, this takes effect on the
    very next /generate request - no restart needed. Every past version
    stays in the database.
    """
    version = save_system_prompt(payload.content)
    return {"status": "saved", "version": version}


@router.get("/health")
def health():
    return {"status": "ok"}


# Mounted twice - see the comment above router's definition.
app.include_router(router)
app.include_router(router, prefix="/pyapi")
