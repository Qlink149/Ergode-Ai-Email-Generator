/**
 * api/comments.js
 * ---------------
 * Agent comments left against an order - see server/routes/comments.js.
 */

import { apiFetch, cachedGet, invalidateCache, invalidateTriageViews } from "./client.js";

/**
 * Post a comment against an order id, optionally tied to a specific
 * customer message (seq) with a snapshot of what that message and the AI's
 * reply said, plus the full AI context (order facts, thread history,
 * reasoning, policy, system prompt version) - all captured at post time, so
 * anyone reading the comment later doesn't have to regenerate the draft or
 * re-look-up the order to see what it was about.
 */
export async function postComment({ orderId, author, text, seq, customerMessage, aiReply, aiContext }) {
  const result = await apiFetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: orderId,
      author,
      text,
      seq: seq != null ? String(seq) : null,
      customer_message: customerMessage || null,
      ai_reply: aiReply || null,
      ai_context: aiContext || null,
    }),
  });
  invalidateCache("/api/comments");
  invalidateTriageViews(); // the comment runs through triage, which may create a proposal/escalation
  return result;
}

/** Every comment left against any order, newest first. */
export async function fetchRecentComments() {
  return cachedGet("/api/comments/recent");
}
