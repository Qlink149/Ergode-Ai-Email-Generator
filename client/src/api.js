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

/**
 * GET cache + in-flight dedupe.
 *
 * Two problems this solves, both visible in the network tab:
 *  - The same endpoint fetched twice on one page load. React's
 *    <StrictMode> (main.jsx) deliberately double-invokes effects in dev,
 *    and PendingApprovalsPage has two effects that fire together on mount.
 *    Concurrent callers for the same path now share one request.
 *  - Refetching near-static data (the system prompt, its version list) on
 *    every navigation back to that page. Those get a short TTL so a repeat
 *    view within a few minutes is instant.
 *
 * ttl = 0  -> dedupe only: the entry is dropped the moment the request
 *             settles, so the next call always hits the network (correct
 *             for lists/stats that change when you approve/reject something).
 * ttl > 0  -> also served from cache for that many ms; mutations call
 *             invalidateCache() to drop stale entries early.
 */
const _getCache = new Map(); // path -> { inflight: boolean, until: number, promise: Promise }

function cachedGet(path, ttl = 0) {
  const hit = _getCache.get(path);
  if (hit && (hit.inflight || Date.now() < hit.until)) return hit.promise;

  const promise = apiFetch(path);
  _getCache.set(path, { inflight: true, until: 0, promise });
  promise.then(
    () => {
      if (ttl > 0) _getCache.set(path, { inflight: false, until: Date.now() + ttl, promise });
      else _getCache.delete(path);
    },
    () => _getCache.delete(path)
  );
  return promise;
}

/** Drop every cached GET whose path starts with `prefix` - call after a write that could change it. */
export function invalidateCache(prefix = "") {
  for (const key of [..._getCache.keys()]) {
    if (key.startsWith(prefix)) _getCache.delete(key);
  }
}

/**
 * A comment, draft edit, approve, reject, or override can all change the
 * proposal list, the escalation list, and the notification counts - drop
 * all three so the next load is fresh. (Most are dedupe-only entries that
 * self-evict on settle anyway; this just covers the case where a stale
 * copy is still within its in-flight window.)
 */
function invalidateTriageViews() {
  invalidateCache("/api/proposals");
  invalidateCache("/api/escalations");
  invalidateCache("/api/notifications");
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
  // Rarely changes; 5-min TTL so switching to this tab and back is instant.
  // saveSystemPrompt() invalidates it.
  return cachedGet("/api/system-prompt", 5 * 60 * 1000);
}

/** Save a human edit to a previously generated draft. */
export async function saveDraftEdit({ threadId, seq, editedReply }) {
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
    }),
  });
  invalidateTriageViews(); // a draft edit runs through triage too
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

export async function saveSystemPrompt(content) {
  const result = await apiFetch("/api/system-prompt", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  invalidateCache("/api/system-prompt"); // both the prompt itself and its version list
  return result;
}

/** Every past system-prompt version, newest first, PREVIEW TEXT ONLY (content_preview/content_length, not the full content) - see fetchSystemPromptVersionContent for the full text of one version. */
export async function fetchSystemPromptVersions() {
  return cachedGet("/api/system-prompt/versions", 5 * 60 * 1000);
}

/** One version's full text - call only when a History card is expanded or right before Restore, never for the list. */
export async function fetchSystemPromptVersionContent(versionId) {
  return apiFetch(`/api/system-prompt/versions/${versionId}`);
}

/** Unread counts for the header's notification bell - pending proposals + unseen escalations. */
export async function fetchNotificationsSummary() {
  // Dedupe only (no TTL) - the bell polls this on its own schedule and
  // wants fresh counts each time; this just collapses the StrictMode
  // double-mount into one request.
  return cachedGet("/api/notifications");
}

/** Applies a proposal's full proposed text as the new live system-prompt version. */
export async function approveProposal(id) {
  const result = await apiFetch(`/api/proposals/${id}/approve`, { method: "POST" });
  invalidateTriageViews();
  invalidateCache("/api/system-prompt"); // an approve creates a new prompt version
  return result;
}

/** Discards a proposal - the live system prompt is left untouched. */
export async function rejectProposal(id) {
  const result = await apiFetch(`/api/proposals/${id}/reject`, { method: "POST" });
  invalidateTriageViews();
  return result;
}

/**
 * One page of proposals regardless of outcome (approved/rejected/
 * already_covered/needs_manual_review), for the history view. Returns
 * {proposals, total, page, limit} - `total` is the REAL total count (from
 * MongoDB), not proposals.length, since proposals is just this one page.
 */
export async function fetchProposalHistory(status, { page = 1, limit = 200 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  return cachedGet(`/api/proposals/history?${params.toString()}`);
}

/** Bucket + week-over-week counts for the stat cards/donut/filter-tab counts, computed by MongoDB - not by downloading every proposal and reducing it in the browser. */
export async function fetchProposalStats() {
  return cachedGet("/api/proposals/stats");
}

/** One page of code/data-restriction escalations from the triage agent. Pass status ("unseen") and/or type ("none"/"code_restriction"/"data_restriction") to filter. Returns {escalations, total, page, limit}. */
export async function fetchEscalations(status, { page = 1, limit = 200, type } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  return cachedGet(`/api/escalations?${params.toString()}`);
}

/** Counts by type for EscalationSection's stat bar, computed by MongoDB. */
export async function fetchEscalationStats() {
  return cachedGet("/api/escalations/stats");
}

/** Marks a batch of escalations as seen - called once the Escalations section is actually viewed. */
export async function markEscalationsSeen(ids) {
  const result = await apiFetch("/api/escalations/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  invalidateCache("/api/escalations");
  invalidateCache("/api/notifications");
  return result;
}

/** Disagrees with a triage verdict - drafts a real prompt-fix proposal from a human note, added to the same pending queue (still needs its own Approve). */
export async function overrideEscalation(id, note, author) {
  const result = await apiFetch(`/api/escalations/${id}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note, author }),
  });
  invalidateTriageViews();
  return result;
}
