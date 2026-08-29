"""
api.py
------
The FastAPI entry point. Every actual route lives in routers/*.py, one
file per resource (generate, system_prompt, draft_edit, triage, proposals,
escalations, notifications, misc) - this file only imports each one and
mounts it, same pattern as server/server.js does for its route files.

Run with:
    uvicorn api:app --port 8001 --reload
(or `python app.py`, a thin wrapper around the same thing - see app.py)
"""

import sys
from pathlib import Path

# Vercel's Python runtime loads this file as the entry point but does not
# add its own directory to sys.path, so the plain sibling imports below
# (from config import ..., from routers import ...) fail with
# "ModuleNotFoundError: No module named 'config'" once deployed, even
# though they work fine locally (where we always run from inside
# pipeline/, so the directory is on sys.path implicitly). This makes that
# true in both places. Must run before importing routers/* below, since
# those import sibling modules (auth_dependency, config, db, ...) the same
# way.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI

from routers import generate, system_prompt, draft_edit, triage, proposals, escalations, notifications, misc

app = FastAPI(title="Ergode AI Pipeline")

# Every router is mounted TWICE - once unprefixed (for local dev, where
# PIPELINE_URL is a bare http://localhost:8001 with no path) and once
# under /pyapi (for production, where server and pipeline deploy together
# as one Vercel project - see the root vercel.json - and Vercel forwards
# the FULL incoming path, including the /pyapi prefix, to this function
# rather than stripping it). Same handlers, reachable both ways.
for _module in (generate, system_prompt, draft_edit, triage, proposals, escalations, notifications, misc):
    app.include_router(_module.router)
    app.include_router(_module.router, prefix="/pyapi")
