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

from pymongo import ASCENDING, DESCENDING, MongoClient

from config import MONGODB_URI, MONGODB_DB_NAME

_client = None
_indexes_ready = False


def _ensure_indexes(db) -> None:
    """
    Creates every index this app's actual query patterns need (see the
    Vercel/MongoDB performance audit) - nothing speculative. create_index()
    is idempotent (a no-op if the index already exists with the same spec),
    so it's safe to call on every cold start rather than needing a separate
    migration step.

    - system_prompts: load_system_prompt()/get_system_prompt_version()/
      save_system_prompt() all do find_one({}, sort=[("version", -1)]) -
      this is the hottest query in the app (runs on every /generate call).
    - prompt_proposals / escalations: get_all_proposals()/get_escalations()
      filter by status (optional) and always sort by created_at - the
      compound index serves the status-filtered case, the plain one serves
      the unfiltered "history" case (a compound index's sort-only benefit
      requires status to be the query's leading field, which an unfiltered
      call doesn't have).
    - ai_drafts: save_draft_edit() filters by thread_id+seq and sorts by
      generated_at.
    - order_comments: /recent sorts the whole collection before its
      .limit(200) - the index lets Mongo satisfy that from the index
      instead of an in-memory sort of every comment ever made.
    """
    db["system_prompts"].create_index([("version", DESCENDING)])

    db["prompt_proposals"].create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    db["prompt_proposals"].create_index([("created_at", DESCENDING)])

    db["escalations"].create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    db["escalations"].create_index([("created_at", DESCENDING)])

    db["ai_drafts"].create_index([("thread_id", ASCENDING), ("seq", ASCENDING), ("generated_at", DESCENDING)])

    db["order_comments"].create_index([("created_at", DESCENDING)])


def get_db():
    """Return the shared database handle, connecting on first use."""
    global _client, _indexes_ready
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured.")
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    db = _client[MONGODB_DB_NAME]
    if not _indexes_ready:
        _ensure_indexes(db)
        _indexes_ready = True
    return db
