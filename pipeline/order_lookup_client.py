"""
order_lookup_client.py
------------------------
Calls our own Express order-lookup endpoint (server/routes/orderLookup.js)
to pull real, live order facts for a given order id - the same live Order
API data the Order Lookup page already uses, reused here so the
historical batch comparison benefits from real names/tracking too,
instead of that only being available on live tickets.

Best-effort by design: the zip threads are historical, so an order id
might not resolve, or the live API might be briefly unavailable. Either
way this returns None rather than raising - that one case just runs
without order_facts, exactly like before this existed. It never fails
the whole batch over a single lookup miss.
"""

from typing import Optional

import requests

from auth_token import compute_token
from config import SERVER_URL

# The Node server now gates every /api/* route behind the same shared-
# password token (see server/services/authToken.js) - this is a server-to-
# server call, not a browser one, so it computes that same token itself
# rather than prompting anyone for a password.
_AUTH_TOKEN = compute_token()


def fetch_order_facts(order_id: Optional[str]) -> Optional[dict]:
    """
    Return order facts for one order id, or None on any failure: the
    customer-safe fields, plus `internal_status_note` (a plain-English
    order status, e.g. "Cancelled") for the AI's reasoning only - see
    disclosureClassifier.js's `reasoning_status` and draft_generator.py's
    handling of it. Never surfaced to the customer, just used so the AI
    doesn't contradict a status it isn't shown directly.

    Uses requests rather than urllib - urllib.request.urlopen() also
    accepts file:// URLs, which static analysis (Semgrep's security-audit
    ruleset) flags whenever the URL is built from a dynamic value, as it
    is here (order_id). requests only ever does HTTP(S), so that class of
    risk doesn't apply regardless of what order_id contains.
    """
    if not order_id:
        return None

    try:
        headers = {"Authorization": f"Bearer {_AUTH_TOKEN}"} if _AUTH_TOKEN else {}
        response = requests.get(f"{SERVER_URL}/api/order-lookup/{order_id}", headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        order = data.get("order", {})
        facts = order.get("customer_safe")
        if facts is not None:
            facts = {**facts, "internal_status_note": order.get("reasoning_status")}
        return facts
    except (requests.RequestException, ValueError):
        return None
