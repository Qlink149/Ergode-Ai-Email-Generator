"""routers/escalations.py - code/data-restriction escalations: list/stats/seen/override."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_dependency import require_auth
from escalation_store import (
    get_escalations,
    get_escalation,
    get_escalation_stats,
    mark_escalations_seen,
    mark_escalation_overridden,
)
from prompt_proposal_store import create_proposal_from_override

router = APIRouter()


@router.get("/escalations", dependencies=[Depends(require_auth)])
def list_escalations(status: Optional[str] = None, page: int = 1, limit: int = 200):
    escalations, total = get_escalations(status, page=page, limit=limit)
    return {"escalations": escalations, "total": total, "page": page, "limit": limit}


@router.get("/escalations/stats", dependencies=[Depends(require_auth)])
def escalations_stats():
    """Counts by type, computed by MongoDB - what EscalationSection's stat bar needs."""
    return get_escalation_stats()


class EscalationSeenPayload(BaseModel):
    ids: List[str]


@router.post("/escalations/seen", dependencies=[Depends(require_auth)])
def escalations_seen(payload: EscalationSeenPayload):
    count = mark_escalations_seen(payload.ids)
    return {"status": "ok", "updated": count}


class EscalationOverridePayload(BaseModel):
    note: str
    author: str


@router.post("/escalations/{escalation_id}/override", dependencies=[Depends(require_auth)])
def override_escalation(escalation_id: str, payload: EscalationOverridePayload):
    """
    A human disagrees with a triage verdict (most often "none") and wants
    a real prompt fix drafted from it. Drafts one against the CURRENT live
    prompt and creates a normal pending proposal from it - this endpoint
    never touches the live prompt itself, the resulting proposal still
    needs a separate Approve.
    """
    escalation = get_escalation(escalation_id)
    if escalation is None:
        raise HTTPException(status_code=404, detail="Escalation not found")

    proposal_id = create_proposal_from_override(escalation, payload.note, payload.author)
    if proposal_id is None:
        raise HTTPException(status_code=502, detail="Could not draft a fix from this override - try a more specific note.")

    mark_escalation_overridden(escalation_id, proposal_id)
    return {"status": "proposal_created", "proposal_id": proposal_id}
