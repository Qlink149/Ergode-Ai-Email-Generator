/**
 * services/fetchWithRetry.js
 * -----------------------------
 * A thin wrapper around fetch() for calling Ergode's own external APIs
 * (Order API, CRM Thread API) - both are outside our control and have
 * been observed to occasionally time out or blip on a transient network
 * error. One retry after a short pause clears most of those without
 * making a genuinely-down API take forever to fail - it does NOT retry
 * on a real HTTP error response (4xx/5xx), only on timeout/network
 * failures, since a 4xx/5xx won't change on a second identical request
 * (fetch() only throws on connection-level failures, never on a
 * received-but-unsuccessful response, so anything caught here already
 * is one of those).
 *
 * timeoutMs is 120s, not the usual few-seconds default - a real request
 * was measured taking ~110s to complete successfully (not hung, just
 * slow), so anything shorter was cutting off calls that would have
 * succeeded. A 15s timeout was firing on those before they ever had a
 * chance to finish.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, { timeoutMs = 120000, retries = 1, retryDelayMs = 1000 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

module.exports = { fetchWithRetry };
