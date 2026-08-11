"""
translator.py
--------------
On-demand English translation for a customer message shown in the UI -
purely a display aid for a human reading the thread, not something fed
back into generation (draft_generator.py already handles the customer's
own language on the way out, per the system prompt's bilingual-output rule).
"""

from typing import Optional

from openai import BadRequestError, OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL, require_openai_key

_ALREADY_ENGLISH = "ALREADY_ENGLISH"

_INSTRUCTIONS = (
    "If the user's message is already written in English, respond with "
    f"exactly {_ALREADY_ENGLISH} and nothing else. Otherwise, translate it "
    "into natural English and respond with ONLY the translation - no notes, "
    "no language name, no quotation marks around it."
)


def translate_to_english(text: str, client: Optional[OpenAI] = None) -> Optional[str]:
    """Returns an English translation, or None if the text is already English."""
    require_openai_key()
    client = client or OpenAI(api_key=OPENAI_API_KEY)

    messages = [
        {"role": "system", "content": _INSTRUCTIONS},
        {"role": "user", "content": text},
    ]
    kwargs = {"model": OPENAI_MODEL, "messages": messages}

    try:
        response = client.chat.completions.create(**kwargs, temperature=0)
    except BadRequestError as err:
        if "temperature" not in str(err):
            raise
        response = client.chat.completions.create(**kwargs)

    result = (response.choices[0].message.content or "").strip()
    if result == _ALREADY_ENGLISH:
        return None
    return result
