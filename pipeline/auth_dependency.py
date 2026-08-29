"""
auth_dependency.py
-------------------
The FastAPI dependency every router in routers/ depends on. Split out of
api.py so each router module can import it without importing api.py
itself (which would create a circular import, since api.py is the one
that imports every router).

In local dev, the Node server already checks this token before ever
reaching this service (see server.js's middleware) - but in production,
Vercel routes /pyapi/(.*) straight here (root vercel.json), completely
bypassing Express. Without this, anyone who finds that path could
generate OpenAI-billed drafts or overwrite the live system prompt with no
login at all.
"""

from fastapi import Header, HTTPException

from auth_token import verify_token


def require_auth(authorization: str = Header(default="")) -> None:
    token = authorization[len("Bearer "):] if authorization.startswith("Bearer ") else None
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
