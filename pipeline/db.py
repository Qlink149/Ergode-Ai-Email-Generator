"""
db.py
-----
One shared MongoDB connection for the pipeline, reused by every file that
needs it instead of each one opening its own. Mirrors server/db.js on the
Node side - same database, same collection names, so Node and Python
never disagree about where data lives.

Collections:
  system_prompts    - versioned system prompt text (read/written by api.py)
  ai_drafts         - one document per on-demand generation: context in,
                       draft + analysis out (written by draft_store.py)
  order_comments    - support-agent comments on a draft, keyed to an
                       order/message (written by server/routes/comments.js,
                       Node-owned - not written from this side)
  prompt_proposals  - AI-drafted system-prompt fixes awaiting human
                       approve/reject (written by prompt_proposal_store.py)
  escalations       - comments/edits the triage agent flagged as needing a
                       code change or new CRM data, not a prompt fix
                       (written by escalation_store.py)
"""

from pymongo import MongoClient

from config import MONGODB_URI, MONGODB_DB_NAME

_client = None


def get_db():
    """Return the shared database handle, connecting on first use."""
    global _client
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured.")
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client[MONGODB_DB_NAME]
