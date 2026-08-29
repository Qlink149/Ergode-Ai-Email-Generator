/**
 * routes/orderLookup.js
 * -----------------------
 * Look up one order by id against the real Order API and CRM Thread API,
 * classify what comes back (see disclosureClassifier.js), and hand the
 * customer-safe + internal view to the frontend. NEVER_SURFACE fields
 * never reach this response at all.
 *
 * The CRM Thread API call is allowed to fail independently (e.g. no real
 * CRM_API_KEY configured yet) without failing the whole lookup - order
 * data alone is still useful, and the frontend shows a clear message for
 * whichever half didn't come back.
 *
 * email_summary's inbound messages get a boilerplate-stripping pass (see
 * messageCleaner.js) - otherwise this page would hand the AI raw Amazon
 * notification text instead of the customer's actual words.
 */

const express = require("express");
const { fetchOrderDetails } = require("../services/orderApiClient");
const { fetchThreadContext } = require("../services/crmThreadApiClient");
const { classifyOrder } = require("../services/disclosureClassifier");
const { cleanInboundText, isRelayMessage, collapseWhitespace } = require("../services/messageCleaner");

const router = express.Router();

function cleanThread(thread) {
  if (!thread?.email_summary) return thread;
  return {
    ...thread,
    email_summary: thread.email_summary.map((m) => {
      const isInbound = m.message_type === "message_in";
      const text = collapseWhitespace(isInbound ? cleanInboundText(m.message_body) : m.message_body);
      return { ...m, message_body: text, is_relay: isInbound && isRelayMessage(text) };
    }),
  };
}

router.get("/:orderId", async (req, res) => {
  const { orderId } = req.params;

  // Fire both upstream calls at once instead of Order-then-CRM in series -
  // the CRM Thread API has been observed taking 100s+ on some orders, and
  // there's no reason to make the (usually fast) Order API wait behind it.
  // A bad order id occasionally wastes one CRM call; a good one (the common
  // case) now costs max(order, crm) instead of order + crm.
  const orderPromise = fetchOrderDetails(orderId);
  const threadSettled = fetchThreadContext({ orderId })
    .then(cleanThread)
    .then((thread) => ({ thread, threadError: null }))
    .catch((err) => ({ thread: null, threadError: err.message }));

  let rawOrder;
  try {
    rawOrder = await orderPromise;
  } catch (err) {
    return res.status(502).json({ error: `Order API: ${err.message}` });
  }

  if (!rawOrder) {
    return res.status(404).json({ error: `No order found for id ${orderId}` });
  }

  const { thread, threadError } = await threadSettled;

  res.json({
    order_id: orderId,
    order: classifyOrder(rawOrder),
    thread,
    thread_error: threadError,
  });
});

module.exports = router;
