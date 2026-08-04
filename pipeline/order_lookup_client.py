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

import json
import urllib.error
import urllib.request

from config import SERVER_URL


def fetch_order_facts(order_id: str | None) -> dict | None:
    """Return customer-safe order facts for one order id, or None on any failure."""
    if not order_id:
        return None

    try:
        with urllib.request.urlopen(f"{SERVER_URL}/api/order-lookup/{order_id}", timeout=10) as response:
            data = json.loads(response.read())
            return data.get("order", {}).get("customer_safe")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
