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
You are analyzing a customer support exchange. Given the customer's message
and our draft reply, return a JSON object with exactly these fields:

- "sentiment": one of "positive", "neutral", "frustrated", "angry"
- "urgency": one of "low", "medium", "high"
- "confidence": a number from 0 to 1 - how confident you are the draft
  reply correctly and fully addresses the customer's message
- "needs_human_review": true or false
- "review_reason": one short sentence explaining why it does or doesn't
  need review

Set needs_human_review to true whenever any of these apply: the customer
sounds angry or frustrated, the draft promises a refund, replacement, or
compensation, the draft responds to a dispute (e.g. "delivered but not
received"), or your own confidence is below 0.7. Otherwise set it to false.

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
}


def analyze_message(customer_message: str, draft_reply: str, client: Optional[OpenAI] = None) -> dict:
    """Ask the model to score one customer-message-and-draft-reply pair."""
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    messages = [
        {"role": "system", "content": ANALYSIS_INSTRUCTIONS},
        {
            "role": "user",
            "content": f"Customer message:\n{customer_message}\n\nDraft reply:\n{draft_reply}",
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
