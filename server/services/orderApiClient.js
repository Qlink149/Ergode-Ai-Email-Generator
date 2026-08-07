/**
 * services/orderApiClient.js
 * ----------------------------
 * Talks to Ergode's read-only Order Details API (see
 * clara-ai-external-order-api-guide.pdf). Auth is HTTP Basic, but with an
 * extra step: username and password are each base64-encoded individually
 * before being combined into the usual "user:pass" Basic value (section 2
 * of the guide) - a plain Basic header will not work against this API.
 *
 * This file only fetches and returns the raw response. It does not decide
 * what's safe to show anyone - that is disclosureClassifier.js's job,
 * kept deliberately separate so the safety rule lives in exactly one place.
 */

const ORDER_API_URL = process.env.ORDER_API_URL;
const USERNAME = process.env.ORDER_API_USERNAME;
const PASSWORD = process.env.ORDER_API_PASSWORD;

function buildAuthHeader() {
  const encodedUser = Buffer.from(USERNAME, "utf-8").toString("base64");
  const encodedPass = Buffer.from(PASSWORD, "utf-8").toString("base64");
  const combined = Buffer.from(`${encodedUser}:${encodedPass}`, "utf-8").toString("base64");
  return `Basic ${combined}`;
}

/** Fetch one order by marketplace order id. Returns null if nothing matched. */
async function fetchOrderDetails(orderId) {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Order API credentials are not configured (ORDER_API_USERNAME/ORDER_API_PASSWORD).");
  }

  const response = await fetch(ORDER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: buildAuthHeader(),
    },
    body: new URLSearchParams({
      function_name: "fetch_order_details",
      "parameters[order_id]": orderId,
    }),
    signal: AbortSignal.timeout(15000), // was hanging forever on some calls with no timeout
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Order API error ${response.status}`);
  }

  // 200 with [] means no match - normalize both shapes to null so callers
  // don't need to special-case it.
  if (Array.isArray(data)) return null;
  return data[orderId] || null;
}

module.exports = { fetchOrderDetails };
