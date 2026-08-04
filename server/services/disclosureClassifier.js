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
 */

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
    },
    internal: {
      order_status_code: lineItem.order_status || null,
      internal_order_id: extra.internal_order_id || null,
      order_item_id: extra.order_item_id || null,
      ship_method: lineItem.ship_method || null,
      action: extra.action || null,
      cancel_order: lineItem.cancel_order || null,
    },
  };
}

module.exports = { classifyOrder };
