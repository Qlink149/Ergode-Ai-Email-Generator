"""
comparison.py
--------------
Compares our AI-generated draft against the real reply that was actually
sent for the same message, and scores how close they are.

We deliberately do NOT score on exact text match - two replies can use
completely different wording and both be correct. Instead we check three
separate things:

1. Facts: order ids, dates, dollar amounts, percentages mentioned in each
   reply. A missing or different fact is a real discrepancy worth a human's
   attention; different phrasing is not.
2. Category: which scenario template (per the system prompt) each reply
   looks like it's using. Do we handle the same kind of case the same way?
3. Similarity: a plain text-closeness score, kept only as a secondary
   signal for the demo - not a pass/fail measure.
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List

# --- Fact extraction patterns -------------------------------------------

ORDER_ID_PATTERN = re.compile(r"\b\d{3}-\d{7}-\d{7}\b")
MONEY_PATTERN = re.compile(r"\$\s?\d+(?:\.\d{2})?")
PERCENT_PATTERN = re.compile(r"\b\d{1,3}\s?%")
DATE_PATTERN = re.compile(
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"
    r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b",
    re.IGNORECASE,
)

# --- Category keywords ----------------------------------------------------
# Matches the scenario templates (A-K) in the system prompt (MongoDB
# "system_prompts" collection - see draft_generator.py's load_system_prompt()).
# Simple and deliberately readable: first category with a keyword hit wins -
# which is exactly why order matters here. More specific signals are listed
# before more generic ones that tend to appear inside them too (e.g. a
# return-with-restocking-fee reply usually also says "refund", so
# return_request must be checked before the more generic refund_processed
# or every return gets mislabeled as a refund).
CATEGORY_KEYWORDS = {
    "cancellation": ["cancel", "cancelled", "cancellation"],
    "manager_escalation": ["manager of the company", "manager of this company", "withdraw"],
    "missing_item": ["missing from your package", "item is missing"],
    "lost_in_transit": ["lost during transit", "lost in transit", "non-delivery"],
    "return_request": ["return", "restocking fee", "buyer remorse", "return shipment"],
    "policy_decline": ["unable to", "return shipping costs are"],
    "refund_processed": [
        "refund", "refunded", "credited back", "we have processed a refund", "full refund",
    ],
    "shipping_status": ["tracking", "carrier", "dispatched", "shipment", "delivered"],
    "product_clarification": ["clarify", "we would like to clarify"],
    "thank_you": ["you're very welcome", "letting us know"],
    "acknowledgment": [
        "reviewing it", "reviewing your message", "reviewing your inquiry",
        "get back to you shortly", "currently investigating", "looking into",
        "support team is", "will provide you with an update", "actively investigating",
    ],
}


def extract_facts(text: str) -> Dict[str, List[str]]:
    """Pull out the concrete, checkable facts mentioned in a piece of text."""
    return {
        "order_ids": ORDER_ID_PATTERN.findall(text),
        "money": MONEY_PATTERN.findall(text),
        "percentages": PERCENT_PATTERN.findall(text),
        "dates": DATE_PATTERN.findall(text),
    }


def diff_facts(real_facts: dict, draft_facts: dict) -> dict:
    """
    For each fact type, compare what the real reply said against what our
    draft said. "missing" = the real reply had it and we didn't (bad).
    "extra" = we mentioned something the real reply didn't (worth review,
    not automatically bad - the real reply might just be less thorough).
    """
    result = {}
    for fact_type in real_facts:
        real_set = set(real_facts[fact_type])
        draft_set = set(draft_facts[fact_type])
        result[fact_type] = {
            "matched": sorted(real_set & draft_set),
            "missing": sorted(real_set - draft_set),
            "extra": sorted(draft_set - real_set),
        }
    return result


def classify_scenario(text: str) -> str:
    """
    Best-effort label for which scenario template a reply resembles.

    Some replies legitimately mention words from more than one category
    (a shipping update that ends in a refund, say), so instead of stopping
    at the first category with any keyword hit, count how many keywords
    each category matches and pick the highest. Ties go to whichever
    category is listed first in CATEGORY_KEYWORDS.
    """
    lowered = text.lower()
    best_category = "other"
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in lowered)
        if score > best_score:
            best_score = score
            best_category = category

    return best_category


def text_similarity(real_reply: str, draft_reply: str) -> float:
    """A simple 0-1 closeness score. Secondary signal only, see module docstring."""
    return round(SequenceMatcher(None, real_reply, draft_reply).ratio(), 3)


def compare_pair(real_reply: str, draft_reply: str) -> dict:
    """Run every check above for one real-reply-vs-draft pair."""
    real_facts = extract_facts(real_reply)
    draft_facts = extract_facts(draft_reply)
    real_category = classify_scenario(real_reply)
    draft_category = classify_scenario(draft_reply)

    return {
        "fact_diff": diff_facts(real_facts, draft_facts),
        "real_category": real_category,
        "draft_category": draft_category,
        "category_match": real_category == draft_category,
        "similarity": text_similarity(real_reply, draft_reply),
    }
