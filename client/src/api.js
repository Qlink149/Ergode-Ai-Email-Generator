/**
 * api.js
 * ------
 * The one place in the app that knows how to talk to the report server.
 * If the API shape changes later, this is the only file that should need
 * to change.
 */

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchReport() {
  return handleResponse(await fetch("/api/reports"));
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
}) {
  return handleResponse(
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_message: customerMessage,
        order_id: orderId || null,
        is_relay: Boolean(isRelay),
        thread_history: threadHistory || [],
        language: language || null,
        order_facts: orderFacts || null,
      }),
    })
  );
}

/** Look up one order against the live Order API + CRM Thread API. */
export async function fetchOrderLookup(orderId) {
  return handleResponse(await fetch(`/api/order-lookup/${orderId}`));
}

export async function fetchSystemPrompt() {
  return handleResponse(await fetch("/api/system-prompt"));
}

export async function fetchTickets() {
  return handleResponse(await fetch("/api/tickets"));
}

export async function fetchTicketThread(threadId) {
  return handleResponse(await fetch(`/api/tickets/${threadId}`));
}

export async function saveSystemPrompt(content) {
  return handleResponse(
    await fetch("/api/system-prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
  );
}
