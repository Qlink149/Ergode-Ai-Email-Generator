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

from pymongo import ASCENDING, DESCENDING, IndexModel, MongoClient
from pymongo.errors import PyMongoError

from config import MONGODB_URI, MONGODB_DB_NAME

_client = None
_indexes_ready = False


def _ensure_indexes(db) -> None:
    """
    Creates every index this app's actual query patterns need (see the
    Vercel/MongoDB performance audit) - nothing speculative. create_index()
    is idempotent (a no-op if the index already exists with the same spec),
    so it's safe to call on every cold start rather than needing a separate
    migration step. Batched into one createIndexes command per collection
    (not one round trip per index) so it adds ~5 round trips to a cold
    start, not ~8, and wrapped so a transient index error can never block
    the request that triggered it - the indexes already exist in any
    long-lived environment, this is just belt-and-braces for a fresh DB.

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
    per_collection = {
        "system_prompts": [
            IndexModel([("version", DESCENDING)]),
        ],
        "prompt_proposals": [
            IndexModel([("status", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ],
        "escalations": [
            IndexModel([("status", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("type", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ],
        "ai_drafts": [
            IndexModel([("thread_id", ASCENDING), ("seq", ASCENDING), ("generated_at", DESCENDING)]),
        ],
        "order_comments": [
            IndexModel([("created_at", DESCENDING)]),
        ],
    }
    try:
        for name, models in per_collection.items():
            db[name].create_indexes(models)
    except PyMongoError:
        # Already-existing indexes are a no-op; a transient failure here must
        # never turn into a failed request - the next cold start retries.
        pass


def get_db():
    """Return the shared database handle, connecting on first use."""
    global _client, _indexes_ready
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured.")
    if _client is None:
        # tz_aware=True: without it, PyMongo hands back naive datetimes for
        # every stored field (created_at, updated_at, etc.) even though
        # they were saved as UTC (datetime.now(timezone.utc)) - FastAPI then
        # serializes them with no timezone suffix at all (e.g.
        # "2026-08-26T05:18:03"), and the browser's `new Date(...)` treats
        # a timestamp with no offset as LOCAL time, not UTC. Confirmed
        # directly: every timestamp in the UI was reading ~5.5 hours off
        # (India's UTC offset) because of this. tz_aware=True makes PyMongo
        # attach real UTC tzinfo, so the JSON comes out with a proper "+00:00"
        # and the browser converts it to local time correctly instead of
        # misreading it as already-local.
        # serverSelectionTimeoutMS: fail fast on a momentary Atlas hiccup
        # instead of hanging on the 30s driver default.
        _client = MongoClient(MONGODB_URI, tz_aware=True, serverSelectionTimeoutMS=5000, maxPoolSize=10)
    db = _client[MONGODB_DB_NAME]
    if not _indexes_ready:
        _ensure_indexes(db)
        _indexes_ready = True
    return db
