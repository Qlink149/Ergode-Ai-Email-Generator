"""routers/notifications.py - the header bell's unread summary."""

from fastapi import APIRouter, Depends

from auth_dependency import require_auth
from prompt_proposal_store import count_pending_proposals
from escalation_store import count_unseen_escalations

router = APIRouter()


@router.get("/notifications/summary", dependencies=[Depends(require_auth)])
def notifications_summary():
    # count_documents, not len(get_pending_proposals()) - this is polled
    # every 45s from every open tab (NotificationBell.jsx); the old version
    # fetched every pending proposal's FULL document (including ai_context)
    # just to measure how many there were.
    return {
        "pending_proposals_count": count_pending_proposals(),
        "unseen_escalations_count": count_unseen_escalations(),
    }
