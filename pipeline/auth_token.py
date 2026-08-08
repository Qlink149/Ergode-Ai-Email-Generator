"""
auth_token.py
-------------
The same shared-password token scheme as server/services/authToken.js,
reimplemented here because Vercel routes /pyapi/(.*) straight to this
FastAPI service (see root vercel.json) - the Node server's auth
middleware never sees those requests, so this service must enforce the
token itself rather than trusting that Express already checked it.

Also used by order_lookup_client.py to authenticate its own
server-to-server call back into the Node server's /api/order-lookup.
"""

import hashlib
import hmac

from config import APP_LOGIN_PASSWORD, AUTH_TOKEN_SECRET


def compute_token() -> str | None:
    if not APP_LOGIN_PASSWORD or not AUTH_TOKEN_SECRET:
        return None
    return hashlib.sha256(f"{APP_LOGIN_PASSWORD}:{AUTH_TOKEN_SECRET}".encode()).hexdigest()


def verify_token(token: str | None) -> bool:
    expected = compute_token()
    if not expected or not token:
        return False
    return hmac.compare_digest(token, expected)
