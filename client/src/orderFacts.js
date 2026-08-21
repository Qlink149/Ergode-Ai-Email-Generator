/** Order-facts shaping for what gets sent to the AI. Used by OrderLookupPage.jsx. */

/**
 * Strips order facts that weren't true yet as of the given message date -
 * a reply from before a refund shouldn't see that refund. Note on the
 * system prompt (v31/v32): it separately tells the model never to narrate
 * or diagnose tracking-scan status as its own sentence in the reply text
 * - that instruction still applies here and is the actual guardrail
 * against fabricated-sounding "no scan on file" phrasing, independent of
 * whether this field is present.
 */
export function dateGateOrderFacts(facts, messageDate) {
  if (!facts) return facts;

  const gated = { ...facts };
  if (!messageDate) return gated;

  const asOf = new Date(messageDate);

  const shippedDate = facts.shipped_date ? new Date(facts.shipped_date) : null;
  if (shippedDate && asOf < shippedDate) {
    gated.carrier_name = null;
    gated.tracking_id = null;
    gated.tracking_url = null;
    gated.ship_method = null;
    gated.shipped_date = null;
    gated.customer_tracking_status = null;
    gated.last_mile_carrier = null;
    gated.last_mile_tracking = null;
  }

  const refundDate = facts.refund_date ? new Date(facts.refund_date) : null;
  if (refundDate && asOf < refundDate) {
    gated.customer_refund_amount = null;
    gated.refund_date = null;
  }

  return gated;
}
