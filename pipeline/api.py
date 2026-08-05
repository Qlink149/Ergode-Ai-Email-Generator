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

from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI

from config import OPENAI_API_KEY, require_openai_key
from draft_generator import generate_draft, load_system_prompt, save_system_prompt
from analysis import analyze_message

app = FastAPI(title="Ergode AI Pipeline")


class ThreadHistoryEntry(BaseModel):
    direction: str  # "in" or "out"
    text: str


class OrderFacts(BaseModel):
    """
    Customer-safe fields, plus one reasoning-only field. See
    server/services/disclosureClassifier.js.
    """

    recipient_name: str | None = None
    product_name: str | None = None
    carrier_name: str | None = None
    tracking_id: str | None = None
    tracking_url: str | None = None
    shipped_date: str | None = None
    purchase_date: str | None = None
    customer_tracking_status: str | None = None
    # Plain-English order status (e.g. "Cancelled") for the AI's reasoning
    # only - draft_generator.py is responsible for keeping it out of output.
    internal_status_note: str | None = None


class GenerateRequest(BaseModel):
    # Optional: when the CRM has no usable inbound text (a known gap - see
    # crmThreadApiClient.js), generation can still proceed as a proactive
    # status update from order_facts alone.
    customer_message: str = ""
    order_id: str | None = None
    is_relay: bool = False
    thread_history: list[ThreadHistoryEntry] = []
    language: str | None = None  # e.g. "Spanish" - overrides auto-detection when set
    order_facts: OrderFacts | None = None  # real, verified data from the Order API


class GenerateResponse(BaseModel):
    draft_reply: str
    analysis: dict


@app.post("/generate", response_model=GenerateResponse)
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


@app.get("/system-prompt")
def get_system_prompt():
    """Return the system prompt exactly as it is used for the next generation."""
    return {"content": load_system_prompt()}


@app.put("/system-prompt")
def update_system_prompt(payload: SystemPromptPayload):
    """
    Save the edit as a new version in MongoDB. Because draft_generator.py
    reads the latest version fresh on every call, this takes effect on the
    very next /generate request - no restart needed. Every past version
    stays in the database.
    """
    version = save_system_prompt(payload.content)
    return {"status": "saved", "version": version}


@app.get("/health")
def health():
    return {"status": "ok"}
