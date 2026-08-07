/**
 * services/disclosureClassifier.js
 * -----------------------------------
 * The non-negotiable rule from the system design: every field from the
 * Order API is either safe to show a customer, safe for an agent to see
 * internally, or must never leave this server at all.
 *
 *   CUSTOMER_SAFE - may appear in generated text and in the UI
 *   INTERNAL      - shown to the agent in the UI, but never in AI-generated text
 *   NEVER_SURFACE - supplier/seller/processing-site data. Not read into
 *                   the output at all - see the comment below.
 *
 * The safety comes from what this function does NOT do: it never reads
 * rawOrder.seller_info or the extraDetails.auxhold_* fields into the
 * returned object. There is no "strip" step to forget - those fields
 * simply never enter the object that gets sent to the browser or the AI.
 *
 * One INTERNAL field is deliberately surfaced separately, as
 * `reasoning_status`: the plain-English order status. The original design
 * says INTERNAL fields may be used for the AI's reasoning, just never
 * echoed into customer-facing text - e.g. a cancelled order can still show
 * a shipped_date (the label was generated before the cancellation landed),
 * and without knowing the order was actually cancelled, the AI has no way
 * to avoid confidently telling a customer their already-cancelled order
 * "has already shipped and can't be cancelled." draft_generator.py is
 * responsible for keeping this out of the actual output text.
 */

const ORDER_STATUS_LABELS = {
  N: "New, not yet processed",
  HLD: "On hold",
  HAM: "On hold - attention management",
  HEC: "On hold - extra charge or payment pending",
  HPC: "On hold - potential cheat flag",
  PD: "Processed - shipped direct by the supplier",
  PA: "Processed - routed via our warehouse",
  SHPFW: "Shipped from warehouse",
  H: "Closed / archived",
  C: "Cancelled",
  RF: "Refunded",
  REP: "Replacement issued",
  REPF: "Replacement follow-up",
};

function classifyOrder(rawOrder) {
  const firstSku = Object.keys(rawOrder.product_details || {})[0];
  const lineItem = (rawOrder.product_details?.[firstSku] || [])[0] || {};
  const buyer = rawOrder.buyerinfo || {};
  const extra = rawOrder.extraDetails || {};
  // rawOrder.seller_info is intentionally never referenced anywhere in
  // this file - that is what makes it NEVER_SURFACE in practice.

  return {
    customer_safe: {
      recipient_name: buyer.recipient_name || buyer.buyer_name || null,
      product_name: lineItem.book_title || null,
      quantity: lineItem.qty || null,
      carrier_name: lineItem.carrier_name || null,
      tracking_id: lineItem.tracking_id || null,
      tracking_url: lineItem.shipper_tracking_url || null,
      shipped_date: lineItem.shipped_date || null,
      purchase_date: buyer.purchase_date || null,
      marketplace: extra.marketplace_name || rawOrder.venue || null,
      customer_tracking_status: lineItem.customer_tracking_status || null,
      ship_method: lineItem.ship_method || null,
      promised_delivery_date: extra.promised_delivery_date || null,
      total_price: rawOrder.total_price || null,
      // Concrete evidence a refund actually happened, unlike order_status -
      // an amount and a date, not a label. Prefer these over reasoning_status.
      customer_refund_amount: lineItem.customer_refund_amount || null,
      refund_date: lineItem.refund_date || null,
      last_mile_carrier: extra.last_mile_carrier || null,
      last_mile_tracking: extra.last_mile_tracking || null,
    },
    internal: {
      order_status_code: lineItem.order_status || null,
      internal_order_id: extra.internal_order_id || null,
      order_item_id: extra.order_item_id || null,
      action: extra.action || null,
      cancel_order: lineItem.cancel_order || null,
    },
    // For the AI's reasoning only - see the module docstring. Not part of
    // customer_safe, so nothing downstream mistakes it for sayable text.
    reasoning_status: ORDER_STATUS_LABELS[lineItem.order_status] || null,
  };
}

module.exports = { classifyOrder };
