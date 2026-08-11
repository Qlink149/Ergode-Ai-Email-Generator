"""
analysis.py
-----------
A lightweight AI read on one exchange: how the customer sounds, how urgent
it is, and whether a human should look at the draft before it goes out.

This does not replace human approval - nothing in this project sends an
email automatically. It's the automated triage step: it flags which drafts
most need a human's attention, the same idea as the confidence-threshold
routing and validation gates in the system design doc, simplified into one
model call for this phase.
"""

import json
from typing import Optional

from openai import BadRequestError, OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, require_openai_key

ANALYSIS_INSTRUCTIONS = """
You are analyzing a customer support exchange. Given the customer's message,
the order facts the reply was allowed to use, and our draft reply, return a
JSON object with exactly these fields:

- "sentiment": one of "positive", "neutral", "frustrated", "angry"
- "urgency": one of "low", "medium", "high"
- "confidence": a number from 0 to 1 - how confident you are the draft
  reply correctly and fully addresses the customer's message
- "needs_human_review": true or false
- "review_reason": one short sentence explaining why it does or doesn't
  need review
- "reasoning": a clear, concrete explanation (3-5 sentences) of why the
  reply is written the way it is. Walk through it in this order:
  1. What the customer actually said or needed, in your own words.
  2. Which specific order facts confirmed or shaped the situation - name
     the actual field values (the real date, amount, tracking status,
     etc.), not just the field names, and say what each one ruled in or
     ruled out.
  3. Which approach or skill the reply used and why that one applied here
     rather than an alternative (e.g. "the retention skill applied
     because this is a buyer-remorse return, not a defect, so the keep-it
     offer came before the return path" or "no retention offer because
     this is our fulfillment error, not the customer's choice to return").
  4. If anything in the reply is uncertain, unverified, or driven by an
     absence of data (e.g. no refund_date on file, so it doesn't claim one
     exists), say so explicitly.
  Do not write a generic restatement of what a support reply does ("it
  addresses the customer's concern professionally") - every sentence
  should reference something specific and real from this exact case.
- "fields_used": an array of short strings, each one naming a specific
  order fact or CRM field that was actually drawn on to write this reply,
  with its real value (e.g. "shipped_date: 2025-12-20 07:59:59",
  "carrier_name: FEDEX", "customer_refund_amount: $189.65",
  "thread_reason: Refund"). Only include fields that materially shaped
  what the reply says - not every field that happened to be available.
  Empty array if the reply didn't rely on any specific fact (e.g. a
  generic acknowledgment).
- "policy_applied": one short, specific sentence naming the exact policy,
  template, or skill from the system prompt that justifies this reply's
  approach. If the reply mentions or implies any refund, replacement, or
  compensation, this MUST name the specific policy that authorizes it
  (e.g. "19% restocking fee applies - Buyer Remorse return, per the
  return-reason table" or "Full refund, no restocking fee - our
  fulfillment error, not the customer's return" or "Refunding now, not
  claiming it's already issued - no refund_date on file yet"). If no
  refund/compensation is involved, name whichever category/template did
  apply (e.g. "Category F - shipping delay, tracking exists and is
  progressing normally" or "Proactive status update - no customer message
  to answer"). Never leave this vague ("standard policy") - name the
  actual rule.

Set needs_human_review to true whenever any of these apply: the customer
sounds angry or frustrated, the draft promises a refund, replacement, or
compensation, the draft responds to a dispute (e.g. "delivered but not
received"), or your own confidence is below 0.7. Otherwise set it to false.

Write "reasoning", "fields_used", and "policy_applied" in English ALWAYS,
even if the customer's message and the draft reply are in another language.
This analysis is read by an English-speaking reviewer, not the customer -
it is never translated or shown to them, so it should never switch language
to match the reply.

Return ONLY the JSON object, no other text.
"""

# Used when the model's response can't be parsed - fail toward caution
# rather than silently approving something that was never checked.
_FALLBACK_RESULT = {
    "sentiment": "unknown",
    "urgency": "unknown",
    "confidence": 0,
    "needs_human_review": True,
    "review_reason": "Analysis could not be parsed - defaulting to human review.",
    "reasoning": "Could not be determined - analysis failed to parse.",
    "fields_used": [],
    "policy_applied": "Could not be determined - analysis failed to parse.",
}


def analyze_message(
    customer_message: str,
    draft_reply: str,
    order_facts: Optional[dict] = None,
    thread_history: Optional[list] = None,
    client: Optional[OpenAI] = None,
) -> dict:
    """Ask the model to score one customer-message-and-draft-reply pair."""
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    facts_block = ""
    if order_facts:
        known_facts = {k: v for k, v in order_facts.items() if v}
        if known_facts:
            facts_lines = "\n".join(f"- {k}: {v}" for k, v in known_facts.items())
            facts_block = f"\n\nOrder facts available for this reply:\n{facts_lines}"

    history_block = ""
    if thread_history:
        history_lines = "\n".join(
            f"- {'Customer' if entry.get('direction') == 'in' else 'Us'}: {entry.get('text', '')}"
            for entry in thread_history
        )
        history_block = f"\n\nEarlier messages in this thread, oldest first:\n{history_lines}"

    messages = [
        {"role": "system", "content": ANALYSIS_INSTRUCTIONS},
        {
            "role": "user",
            "content": (
                f"Customer message:\n{customer_message}{facts_block}{history_block}"
                f"\n\nDraft reply:\n{draft_reply}"
            ),
        },
    ]
    kwargs = {"model": OPENAI_MODEL, "messages": messages, "response_format": {"type": "json_object"}}

    try:
        # temperature=0 for consistent scoring - dropped if the model
        # (e.g. gpt-5.6-luna) only allows its default. See
        # draft_generator.py's generate_draft() for the same pattern.
        response = client.chat.completions.create(**kwargs, temperature=0)
    except BadRequestError as err:
        if "temperature" not in str(err):
            raise
        response = client.chat.completions.create(**kwargs)

    try:
        result = json.loads(response.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        return _FALLBACK_RESULT

    # Make sure every expected field is present even if the model dropped one.
    for key, default in _FALLBACK_RESULT.items():
        result.setdefault(key, default)

    return result
