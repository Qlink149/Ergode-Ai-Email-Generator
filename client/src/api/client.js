/**
 * api/client.js
 * -------------
 * The low-level plumbing every other api/*.js file builds on: the auth
 * token, the fetch wrapper, and the GET cache/dedupe layer. No endpoint
 * knowledge lives here - just the mechanics every endpoint shares.
 */

// .replace() strips a trailing slash - VITE_API_URL="https://x.vercel.app/"
// would otherwise produce double-slash URLs like ".../app//api/tickets".
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const TOKEN_KEY = "ergode_auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Every authenticated call goes through here - attaches the login token,
 * and on a 401 (missing/stale token) clears it and fires a window event
 * App.jsx listens for, so the whole app falls back to the login screen
 * instead of every page having to handle that case separately.
 */
export async function apiFetch(path, options = {}) {
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

export function cachedGet(path, ttl = 0) {
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
export function invalidateTriageViews() {
  invalidateCache("/api/proposals");
  invalidateCache("/api/escalations");
  invalidateCache("/api/notifications");
}
