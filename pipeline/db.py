"""
db.py
-----
One shared MongoDB connection for the pipeline, reused by every file that
needs it instead of each one opening its own. Mirrors server/db.js on the
Node side - same database, same collection names, so Node and Python
never disagree about where data lives.

Collections:
  parsed_threads  - one document per thread (written by thread_parser.py,
                     read by server/routes/tickets.js)
  pipeline_runs   - one document per pipeline run, write-once, never
                     overwritten (written by report_builder.py, read by
                     server/routes/reports.js)
  system_prompts  - versioned system prompt text (read/written by api.py)
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
