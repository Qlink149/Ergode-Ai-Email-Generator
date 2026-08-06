/**
 * api.js
 * ------
 * The one place in the app that knows how to talk to the report server.
 * If the API shape changes later, this is the only file that should need
 * to change.
 *
 * API_BASE is empty locally (requests go to relative "/api/..." paths,
 * which vite.config.js proxies to the Express server) but must be set to
 * the server's deployed URL via VITE_API_URL when the client and server
 * are deployed as separate Vercel projects.
 */

// .replace() strips a trailing slash - VITE_API_URL="https://x.vercel.app/"
// would otherwise produce double-slash URLs like ".../app//api/tickets".
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchReport() {
  return handleResponse(await fetch(`${API_BASE}/api/reports`));
}

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
}) {
  return handleResponse(
    await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_message: customerMessage,
        order_id: orderId || null,
        is_relay: Boolean(isRelay),
        thread_history: threadHistory || [],
        language: language || null,
        order_facts: orderFacts || null,
        // Only the ticketing page passes these, so this generation gets
        // written back to ai_drafts against the thread it belongs to.
        thread_id: threadId || null,
        seq: seq != null ? String(seq) : null,
      }),
    })
  );
}

/** Look up one order against the live Order API + CRM Thread API. */
export async function fetchOrderLookup(orderId) {
  return handleResponse(await fetch(`${API_BASE}/api/order-lookup/${orderId}`));
}

export async function fetchSystemPrompt() {
  return handleResponse(await fetch(`${API_BASE}/api/system-prompt`));
}

export async function fetchTickets() {
  return handleResponse(await fetch(`${API_BASE}/api/tickets`));
}

export async function fetchTicketThread(threadId) {
  return handleResponse(await fetch(`${API_BASE}/api/tickets/${threadId}`));
}

export async function saveSystemPrompt(content) {
  return handleResponse(
    await fetch(`${API_BASE}/api/system-prompt`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
  );
}
