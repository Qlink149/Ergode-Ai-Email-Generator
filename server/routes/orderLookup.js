/**
 * routes/orderLookup.js
 * -----------------------
 * The live-data counterpart to the ticket queue: look up one order by id
 * against the real Order API and CRM Thread API, classify what comes
 * back (see disclosureClassifier.js), and hand the customer-safe +
 * internal view to the frontend. NEVER_SURFACE fields never reach this
 * response at all.
 *
 * The CRM Thread API call is allowed to fail independently (e.g. no real
 * CRM_API_KEY configured yet) without failing the whole lookup - order
 * data alone is still useful, and the frontend shows a clear message for
 * whichever half didn't come back.
 */

const express = require("express");
const { fetchOrderDetails } = require("../services/orderApiClient");
const { fetchThreadContext } = require("../services/crmThreadApiClient");
const { classifyOrder } = require("../services/disclosureClassifier");

const router = express.Router();

router.get("/:orderId", async (req, res) => {
  const { orderId } = req.params;

  let rawOrder;
  try {
    rawOrder = await fetchOrderDetails(orderId);
  } catch (err) {
    return res.status(502).json({ error: `Order API: ${err.message}` });
  }

  if (!rawOrder) {
    return res.status(404).json({ error: `No order found for id ${orderId}` });
  }

  let thread = null;
  let threadError = null;
  try {
    thread = await fetchThreadContext({ orderId });
  } catch (err) {
    threadError = err.message;
  }

  res.json({
    order_id: orderId,
    order: classifyOrder(rawOrder),
    thread,
    thread_error: threadError,
  });
});

module.exports = router;
