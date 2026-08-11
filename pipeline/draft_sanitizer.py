"""
draft_sanitizer.py
-------------------
A deterministic safety net behind the system prompt's "plain text, no
markdown, don't quote-wrap the whole reply" instruction - that instruction
alone has been seen not holding 100% of the time, so this guarantees it
regardless of what the model actually did.
"""

import re


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
