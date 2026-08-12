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

const TOKEN_KEY = "ergode_auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Every authenticated call goes through here - attaches the shared login
 * token, and on a 401 (missing/stale token) clears it and fires a window
 * event App.jsx listens for, so the whole app falls back to the login
 * screen instead of every page having to handle that case separately.
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("ergode-auth-expired"));
    throw new Error("Session expired - please log in again.");
  }

  return handleResponse(response);
}

/** Verifies the shared password against the server and stores the session token on success. */
export async function login(password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await handleResponse(response);
  localStorage.setItem(TOKEN_KEY, data.token);
}

export async function fetchReport() {
  return apiFetch("/api/reports");
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

export async function fetchSystemPrompt() {
  return apiFetch("/api/system-prompt");
}

export async function fetchTickets() {
  return apiFetch("/api/tickets");
}

export async function fetchTicketThread(threadId) {
  return apiFetch(`/api/tickets/${threadId}`);
}

/** Save a human edit to a previously generated draft. */
export async function saveDraftEdit({ threadId, seq, editedReply }) {
  return apiFetch("/api/draft-edit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Stringified for the same reason generateDraft() does it - the CRM
      // Thread API's own thread_id (OrderLookupPage.jsx) comes back as a
      // JSON number, and the pipeline's pydantic model requires a string.
      thread_id: threadId != null ? String(threadId) : null,
      seq: String(seq),
      edited_reply: editedReply,
    }),
  });
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

/**
 * Post a comment against an order id, optionally tied to a specific
 * customer message (seq) with a snapshot of what that message and the AI's
 * reply said - captured at post time, so anyone reading the comment later
 * doesn't have to regenerate the draft or re-look-up the order to see what
 * it was about.
 */
export async function postComment({ orderId, author, text, seq, customerMessage, aiReply }) {
  return apiFetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: orderId,
      author,
      text,
      seq: seq != null ? String(seq) : null,
      customer_message: customerMessage || null,
      ai_reply: aiReply || null,
    }),
  });
}

/** Every comment left against any order, newest first. */
export async function fetchRecentComments() {
  return apiFetch("/api/comments/recent");
}

export async function saveSystemPrompt(content) {
  return apiFetch("/api/system-prompt", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
