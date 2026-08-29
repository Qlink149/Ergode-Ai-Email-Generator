"""routers/misc.py - the odds and ends: translation, and the public health check."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from openai import OpenAI

from auth_dependency import require_auth
from config import OPENAI_API_KEY, require_openai_key
from translator import translate_to_english

router = APIRouter()


class TranslatePayload(BaseModel):
    text: str


@router.post("/translate", dependencies=[Depends(require_auth)])
def translate(payload: TranslatePayload):
    """Translates one message to English for display, if it isn't already."""
    require_openai_key()
    translated = translate_to_english(payload.text, client=OpenAI(api_key=OPENAI_API_KEY))
    return {"translated": translated}


@router.get("/health")
def health():
    return {"status": "ok"}
