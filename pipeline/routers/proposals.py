"""routers/proposals.py - prompt-fix proposals: list/history/stats/approve/reject."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from auth_dependency import require_auth
from prompt_proposal_store import (
    get_pending_proposals,
    get_all_proposals,
    get_proposal_stats,
    approve_proposal,
    reject_proposal,
)

router = APIRouter()


@router.get("/proposals", dependencies=[Depends(require_auth)])
def list_proposals():
    """Pending prompt-fix proposals, for the Pending Approvals page."""
    return {"proposals": get_pending_proposals()}


@router.get("/proposals/history", dependencies=[Depends(require_auth)])
def proposals_history(status: Optional[str] = None, page: int = 1, limit: int = 200):
    """One page of proposals regardless of outcome, for the Pending Approvals page's history view."""
    proposals, total = get_all_proposals(status, page=page, limit=limit)
    return {"proposals": proposals, "total": total, "page": page, "limit": limit}


@router.get("/proposals/stats", dependencies=[Depends(require_auth)])
def proposals_stats():
    """Bucket/week-over-week counts, computed by MongoDB - what the stat cards/donut/filter-tab counts need, without downloading every proposal to count them in the browser."""
    return get_proposal_stats()


@router.post("/proposals/{proposal_id}/approve", dependencies=[Depends(require_auth)])
def approve(proposal_id: str):
    """
    Re-checks the fix against the CURRENT live prompt before applying it
    (see prompt_proposal_store.py's approve_proposal()) - the response's
    "status" reflects what actually happened: "approved" if the fix went
    live just now, "already_covered" if the live prompt turned out to
    already cover it and nothing was changed.
    """
    result = approve_proposal(proposal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Proposal not found or already reviewed")
    if result.get("needs_manual_review"):
        status = "needs_manual_review"
    elif result.get("already_covered"):
        status = "already_covered"
    else:
        status = "approved"
    return {"status": status, **result}


@router.post("/proposals/{proposal_id}/reject", dependencies=[Depends(require_auth)])
def reject(proposal_id: str):
    result = reject_proposal(proposal_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Proposal not found or already reviewed")
    return {"status": "rejected", **result}
