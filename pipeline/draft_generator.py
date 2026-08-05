"""
draft_generator.py
-------------------
Sends a context package (the "briefing note" built by context_builder.py)
to OpenAI and gets back a draft reply, written in Ergode's voice.

The system prompt (tone, templates, rules) is read fresh from MongoDB's
"system_prompts" collection on every call, not cached - so editing it from
the System Prompt page in the UI takes effect on the very next generation,
with no restart needed. Only the facts specific to one reply - the
customer's message, the thread history, the order id - go into the user
turn. That split is deliberate: it is exactly what a production system
does, and it is why swapping in real order/CRM data later only changes
format_user_prompt(), not this file's structure.
"""

from datetime import datetime, timezone

from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, SYSTEM_PROMPT_SEED_PATH, require_openai_key
from db import get_db


def load_system_prompt() -> str:
    """
    Read the current system prompt, fresh every call - see module docstring.

    The first time the "system_prompts" collection is empty (a fresh
    database), this seeds it from docs/ergode_email_system_prompt.md as
    version 1, so a new deployment boots with the real prompt instead of
    an error.
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


def save_system_prompt(content: str) -> int:
    """Save an edit as a new version - every past version is kept, none overwritten."""
    collection = get_db()["system_prompts"]
    latest = collection.find_one({}, sort=[("version", -1)])
    next_version = (latest["version"] + 1) if latest else 1
    collection.insert_one(
        {"version": next_version, "content": content, "updated_at": datetime.now(timezone.utc)}
    )
    return next_version


def _days_since(date_string: str | None) -> int | None:
    """Best-effort day count between a YYYY-MM-DD... date string and today."""
    if not date_string:
        return None
    try:
        parsed = datetime.strptime(date_string[:10], "%Y-%m-%d")
    except ValueError:
        return None
    return (datetime.now() - parsed).days


def format_order_facts(order_facts: dict) -> list[str]:
    """
    Turn verified, customer-safe order/shipment facts (pulled from the real
    Order API - see server/services/disclosureClassifier.js) into prompt
    lines the model can quote directly and reason from. This is the
    difference between the AI writing "we're looking into it" and writing
    "your package shipped via Ship Global on Nov 15 and last showed
    'departed facility' 9 days ago" - it can only do the second if these
    facts are actually in front of it.
    """
    lines = ["\nVerified order/shipment facts (safe to state to the customer):"]

    # A Cancelled/Refunded order fully explains why nothing shipped or
    # scanned - checked first so the "no scan yet, escalate" wording below
    # never fires for a settled order and ends up competing with (and
    # outweighing) the reasoning-only status note further down.
    status_note = order_facts.get("internal_status_note")
    order_is_settled = status_note in ("Cancelled", "Refunded")

    if order_facts.get("recipient_name"):
        lines.append(f"- Customer's name: {order_facts['recipient_name']} (use this in the salutation)")
    if order_facts.get("product_name"):
        lines.append(f"- Product: {order_facts['product_name']}")
    if order_facts.get("carrier_name") and order_facts.get("tracking_id"):
        lines.append(f"- Carrier: {order_facts['carrier_name']}, tracking #: {order_facts['tracking_id']}")
    if order_facts.get("tracking_url"):
        lines.append(f"- Tracking link: {order_facts['tracking_url']}")
    if order_facts.get("shipped_date"):
        days_shipped = _days_since(order_facts["shipped_date"])
        suffix = f" ({days_shipped} days ago)" if days_shipped is not None else ""
        lines.append(f"- Shipped date: {order_facts['shipped_date']}{suffix}")

    status = order_facts.get("customer_tracking_status")
    if status:
        lines.append(f"- Latest carrier status: \"{status}\"")
    elif order_is_settled:
        lines.append(
            "- Latest carrier status: none on file. This is expected, not a "
            "concern - see the internal order status note below, which "
            "already explains why."
        )
    else:
        lines.append(
            "- Latest carrier status: none on file - a shipping label/number "
            "exists but the carrier has not logged a first scan yet. Treat "
            "this as a fulfilment concern to escalate internally, not a "
            "normal in-transit delay - do not tell the customer to simply "
            "wait longer for tracking to update."
        )

    if status_note:
        if order_is_settled:
            lines.append(
                f"\nInternal order status (for your reasoning ONLY - never state "
                f"this code, label, or word to the customer): {status_note}. "
                f"This is the order's actual, current, final state - it "
                f"overrides every shipping/tracking fact above, including a "
                f"shipped_date (shipping labels are sometimes generated before "
                f"a cancellation lands). Do NOT describe this order as needing "
                f"fulfilment, escalation, or an apology for delay - write the "
                f"reply confirming the {status_note.lower()} outcome instead, "
                f"in the tone the system prompt already uses for that."
            )
        else:
            lines.append(
                f"\nInternal order status (for your reasoning ONLY - never state "
                f"this code, label, or word to the customer): {status_note}."
            )

    return lines


def format_user_prompt(context: dict) -> str:
    """
    Turn one context package into the plain-text user turn the model reads.
    Kept deliberately literal - just the facts the model is allowed to use,
    no hidden instructions beyond a reminder not to invent details.
    """
    lines = []

    if context["order_id"]:
        lines.append(f"Order ID: {context['order_id']}")
    else:
        lines.append("Order ID: not provided in this message.")

    order_facts = context.get("order_facts")
    if order_facts:
        lines.extend(format_order_facts(order_facts))

    if context["is_relay"]:
        lines.append(
            "Note: this message was relayed by a marketplace support "
            "representative on the customer's behalf, not written directly "
            "by the customer. Treat it as more urgent."
        )

    if context["thread_history"]:
        lines.append("\nPrior messages on this thread, oldest first:")
        for entry in context["thread_history"]:
            speaker = "Customer" if entry["direction"] == "in" else "Us (agent)"
            lines.append(f"- {speaker}: {entry['text']}")

    has_customer_message = bool((context.get("customer_message") or "").strip())

    if has_customer_message:
        lines.append("\nThe customer's current message:")
        lines.append(context["customer_message"])
    else:
        lines.append(
            "\nNo inbound customer message is available for this thread (a known "
            "gap in the CRM data pull, not a missing question - do not mention "
            "this gap to the customer). This is a PROACTIVE status update, not a "
            "reply to something the customer said - do not open with 'thank you "
            "for reaching out' or reference a message from them. Proactively "
            "inform them of their order's current status using the verified "
            "facts above."
        )

    already_acknowledged = any(
        entry["direction"] == "out" for entry in context["thread_history"]
    )

    lines.append(
        "\nWrite the reply email now, following the system prompt's tone, "
        "structure, and templates exactly. Use only the facts given above - "
        "never invent an order status, tracking number, date, or dollar "
        "amount that was not provided."
    )

    if order_facts:
        lines.append(
            "Verified order facts were provided above - use them. Give a "
            "specific, concrete reply (the actual carrier, tracking number, "
            "and latest status), not a generic 'we're looking into it' "
            "holding reply - you have real information, so use it."
        )
    elif has_customer_message:
        lines.append(
            "No verified order/shipment facts were provided. This caution is "
            "about SHIPPING/TRACKING outcomes specifically: if the customer "
            "is asking where a package is or whether it has arrived, do not "
            "guess what happened - acknowledge and say the team is looking "
            "into it, rather than inventing a delivery status. It does NOT "
            "apply to policy-driven categories like cancellations, returns, "
            "or refunds - those don't need order-specific facts. Apply the "
            "stated policy (e.g. the 19% restocking fee for a Buyer Remorse "
            "return, per the return-reason table) directly and confidently."
        )
    else:
        lines.append(
            "No verified order/shipment facts and no customer message were "
            "provided - write a brief, generic status-check acknowledgment "
            "only, and do not invent any specifics."
        )

    if already_acknowledged:
        lines.append(
            "\nImportant: we have already sent at least one reply on this "
            "thread (see the prior messages above). Do not send another "
            "generic 'we're reviewing your message' holding reply - the "
            "customer has already heard that. Respond specifically to what "
            "they just said in their current message."
        )

    language = context.get("language")
    if language:
        lines.append(
            f"\nMANDATORY LANGUAGE OVERRIDE: write the entire reply in "
            f"{language}. This overrides the system prompt's default of "
            f"replying in the customer's own language - use {language} even "
            f"though the customer's message above is in a different "
            f"language. Still add an English version below a '=====' "
            f"divider afterward if {language} is not English."
        )

    return "\n".join(lines)


def generate_draft(context: dict, client: OpenAI | None = None) -> str:
    """Call OpenAI with the system prompt + this case's context, return the draft text."""
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": load_system_prompt()},
            {"role": "user", "content": format_user_prompt(context)},
        ],
        temperature=0.4,
    )

    return response.choices[0].message.content.strip()
