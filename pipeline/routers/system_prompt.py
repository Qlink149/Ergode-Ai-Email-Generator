"""routers/system_prompt.py - read/write the live system prompt + its version history."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_dependency import require_auth
from system_prompt_store import (
    load_system_prompt,
    save_system_prompt,
    list_system_prompt_versions,
    get_system_prompt_version_content,
)

router = APIRouter()


class SystemPromptPayload(BaseModel):
    content: str


@router.get("/system-prompt", dependencies=[Depends(require_auth)])
def get_system_prompt():
    """Return the system prompt exactly as it is used for the next generation."""
    return {"content": load_system_prompt()}


@router.put("/system-prompt", dependencies=[Depends(require_auth)])
def update_system_prompt(payload: SystemPromptPayload):
    """
    Save the edit as a new version in MongoDB. Because draft_generator.py
    reads the latest version fresh on every call, this takes effect on the
    very next /generate request - no restart needed. Every past version
    stays in the database.
    """
    version = save_system_prompt(payload.content)
    return {"status": "saved", "version": version}


@router.get("/system-prompt/versions", dependencies=[Depends(require_auth)])
def system_prompt_versions():
    """Every past version, newest first, preview text only - full content is a separate on-demand call (see below)."""
    return {"versions": list_system_prompt_versions()}


@router.get("/system-prompt/versions/{version_id}", dependencies=[Depends(require_auth)])
def system_prompt_version_content(version_id: str):
    """One version's full text - called only when a History card is expanded, or right before Restore."""
    result = get_system_prompt_version_content(version_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return result
