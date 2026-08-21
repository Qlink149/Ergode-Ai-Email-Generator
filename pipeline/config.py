"""
config.py
---------
Central place for settings, file paths, and secrets.

Every other pipeline file imports paths and settings from here instead of
hard-coding them. If a folder moves, this is the only file that changes.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# The project root is one folder above this "pipeline" folder.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load secrets and settings from the .env file at the project root.
load_dotenv(PROJECT_ROOT / ".env")

# --- Secrets / settings coming from .env ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
# Fixed, not read from the environment - a missing/misconfigured
# OPENAI_MODEL env var in production was traced to drafts silently
# generating on a weaker model than what was tested locally, with the
# exact same system prompt giving wrong answers as a result.
OPENAI_MODEL = "gpt-5.6-luna"
PIPELINE_PORT = int(os.getenv("PIPELINE_PORT", "8001"))
SERVER_PORT = int(os.getenv("SERVER_PORT", "4000"))
# SERVER_URL is how order_lookup_client.py reaches the Node server to reuse
# its live Order API integration. Locally this defaults to localhost; once
# client/server/pipeline are deployed as separate Vercel projects, set
# SERVER_URL explicitly to the deployed server project's URL.
SERVER_URL = os.getenv("SERVER_URL", f"http://localhost:{SERVER_PORT}")
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ergode")
APP_LOGIN_PASSWORD = os.getenv("APP_LOGIN_PASSWORD", "")
AUTH_TOKEN_SECRET = os.getenv("AUTH_TOKEN_SECRET", "")

# --- Input files ---
ZIP_PATH = PROJECT_ROOT / "categorizations.zip"
# Seed-only fallback for the system prompt - see db.py / draft_generator.py.
# Lives inside pipeline/ (not a shared docs/ folder) specifically so it
# still deploys correctly when pipeline/ is its own Vercel project scoped
# to just this folder. The database is the source of truth once seeded.
SYSTEM_PROMPT_SEED_PATH = Path(__file__).resolve().parent / "system_prompt_seed.md"


def require_openai_key() -> None:
    """Stop early with a clear message if no API key is configured yet."""
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key."
        )
