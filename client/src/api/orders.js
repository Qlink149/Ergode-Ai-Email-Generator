/**
 * api/orders.js
 * -------------
 * Order Lookup + draft generation/editing/translation - the core
 * OrderLookupPage.jsx / EditableDraft.jsx flow.
 */

import { apiFetch, invalidateTriageViews } from "./client.js";

/**
 * Ask the AI to draft a reply right now for a typed-in customer message.
 * Leave `language` empty to auto-detect from the customer's message, or
 * pass a language name (e.g. "Spanish") to force the reply into it.
 */
export async function generateDraft({
  customerMessage,
  orderId,
  isRelay,
  threadHistory,
  language,
  orderFacts,
  threadId,
  seq,
  cancellationMarked,
  threadReason,
}) {
  return apiFetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_message: customerMessage,
      order_id: orderId || null,
      is_relay: Boolean(isRelay),
      thread_history: threadHistory || [],
      language: language || null,
      order_facts: orderFacts || null,
      // When set, this generation gets written back to ai_drafts against
      // the thread/message it belongs to, so a later edit can find it.
      // Stringified because the CRM Thread API's own thread_id (see
      // OrderLookupPage.jsx) comes back as a JSON number, and the pipeline's
      // pydantic model requires a string - a raw number 422s.
      thread_id: threadId != null ? String(threadId) : null,
      seq: seq != null ? String(seq) : null,
      // From the CRM Thread API's threadMeta - see draft_generator.py's
      // cancellation-interception rule for what these actually mean.
      cancellation_marked: cancellationMarked ?? null,
      thread_reason: threadReason || null,
    }),
  });
}

/** Look up one order against the live Order API + CRM Thread API. */
export async function fetchOrderLookup(orderId) {
  return apiFetch(`/api/order-lookup/${orderId}`);
}

/**
 * Save a human edit to a previously generated draft. `author` names who
 * made the edit - stored on every edit now (EditableDraft.jsx always asks
 * for a name, same as its Comment form), not just ones sent for review.
 * `permanentFix` (only honored if the user has the flagPermanentFix
 * permission) additionally sends the edit on to the triage agent /
 * approval queue; without it the edit is just saved for this one reply.
 */
export async function saveDraftEdit({ threadId, seq, editedReply, permanentFix = false, author }) {
  const result = await apiFetch("/api/draft-edit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Stringified for the same reason generateDraft() does it - the CRM
      // Thread API's own thread_id (OrderLookupPage.jsx) comes back as a
      // JSON number, and the pipeline's pydantic model requires a string.
      thread_id: threadId != null ? String(threadId) : null,
      seq: String(seq),
      edited_reply: editedReply,
      permanent_fix: Boolean(permanentFix),
      author: author || undefined,
    }),
  });
  if (result.permanent_fix_applied) invalidateTriageViews(); // triage may have created a proposal/escalation
  return result;
}

/** Translates one message to English for display - returns null if it's already English. */
export async function translateMessage(text) {
  const { translated } = await apiFetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return translated;
}
