"""
draft_sanitizer.py
-------------------
A deterministic safety net behind system-prompt instructions that have been
observed not holding 100% of the time on their own - each function here
guarantees one such rule regardless of what the model actually wrote.
"""

import re

# Matches a dollar figure in either format the model has been seen using:
#   English: $95.11 / $1,234.56
#   French:  95,11 $ / 1 234,56 $  (number-then-symbol, comma decimal)
_EN_MONEY = r"\$\s?\d[\d,]*(?:\.\d{2})?"
_FR_MONEY = r"\d[\d, ]*,\d{2}\s?\$"
_MONEY = re.compile(f"(?:{_EN_MONEY})|(?:{_FR_MONEY})")

# If the customer's own message asks how much, or already quotes a dollar
# figure themselves (disputing a number they received), the system prompt's
# exception applies and a stated amount is legitimate - leave the draft alone.
_CUSTOMER_ASKED_AMOUNT = re.compile(
    r"how much|what amount|what.{0,20}(refund|amount)|combien|quel montant|\$\s?\d|\d,\d{2}\s?\$",
    re.IGNORECASE,
)


def sanitize_draft(text: str) -> str:
    text = text.strip()

    # A reply the model wrapped entirely in quotes, e.g. "Dear ...\n...\nRegards, X"
    if len(text) > 1 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1].strip()

    # **bold** -> bold (keep the words, drop the markdown)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    # Stray leftover single/double asterisks used as markdown emphasis or bullets
    text = re.sub(r"\*+", "", text)
    # "# Heading" -> "Heading" at the start of a line
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)

    return text.strip()


def strip_unrequested_refund_amount(text: str, customer_message: str) -> str:
    """
    The system prompt tells the model not to state a refund's dollar amount
    unless the customer asked how much or is disputing a figure they already
    received - observed in testing to not hold 100% of the time on its own
    (the model tends to volunteer the number when explaining a partial
    refund, or when citing it as "proof" a refund happened). This strips any
    dollar figure that slips through anyway, unless the customer's own
    message shows the exception genuinely applies.
    """
    if _CUSTOMER_ASKED_AMOUNT.search(customer_message or ""):
        return text
    if not _MONEY.search(text):
        return text

    # "a refund of $71.14" / "un remboursement de 95,11 $" -> drop the
    # connector + figure entirely, reading naturally without either.
    text = re.sub(rf"\s+(?:of|de)\s+(?:{_EN_MONEY}|{_FR_MONEY})", "", text)
    # "the remaining $5.78" -> "the remaining balance"
    text = re.sub(rf"\b(remaining|reste)\s+(?:{_EN_MONEY}|{_FR_MONEY})", r"\1 balance", text, flags=re.IGNORECASE)
    # Anything left over - remove outright.
    text = _MONEY.sub("", text)

    # Clean up whitespace/punctuation artifacts left behind by the removals.
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"[ \t]+\n", "\n", text)

    return text.strip()
