"""
app.py
------
Run the FastAPI pipeline locally with one short command:

    python app.py

That's all it does - it's a thin wrapper around
`uvicorn api:app --reload --port 8001` so local dev doesn't need the
longer incantation. The actual app lives in api.py.

Production (Vercel) never runs this file - it loads api.py directly, see
the root vercel.json. Runs fine from either the repo root
(`python pipeline/app.py`) or from inside pipeline/ (`python app.py`).
"""

import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
# Make `api` importable and keep uvicorn's reload subprocess pointed at the
# pipeline dir no matter where this was launched from.
sys.path.insert(0, str(_HERE))
os.chdir(_HERE)

import uvicorn

from config import PIPELINE_PORT

if __name__ == "__main__":
    uvicorn.run("api:app", host="127.0.0.1", port=PIPELINE_PORT, reload=True)
