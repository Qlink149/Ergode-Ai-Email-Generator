/**
 * services/crmThreadApiClient.js
 * ---------------------------------
 * Talks to Ergode's read-only CRM Thread-Context API (see
 * CRM_Thread_Context_API.pdf). Auth is a shared secret header (x-api-key).
 *
 * Two real data quirks observed from the live API get cleaned up here, in
 * one place, so nothing downstream has to know about them:
 *
 * 1. message_body comes back HTML-entity-encoded, and in some messages
 *    double-encoded (e.g. "&amp;#39;" instead of "'"). decodeHtmlEntities()
 *    unwraps it.
 * 2. Every message_in observed so far comes back as the literal string
 *    "HTML content is empty." instead of the customer's actual text - a
 *    gap in the source data, not something fixable on our end. Rather than
 *    let that placeholder silently get treated as real customer text (and
 *    fed to the AI as if it were), messages matching it are normalized to
 *    an empty string so callers can detect "no usable text" explicitly.
 */

const CRM_API_URL = process.env.CRM_API_URL;
const API_KEY = process.env.CRM_API_KEY;

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

function decodeEntitiesOnce(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&(amp|lt|gt|quot|nbsp|rsquo|lsquo|rdquo|ldquo);/g, (_, name) => NAMED_ENTITIES[name]);
}

/** Some messages are double-encoded ("&amp;#39;"), so decode twice. */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return decodeEntitiesOnce(decodeEntitiesOnce(text)).trim();
}

const EMPTY_CONTENT_PLACEHOLDER = "HTML content is empty.";

function cleanMessage(message) {
  const decoded = decodeHtmlEntities(message.message_body);
  return {
    ...message,
    message_body: decoded === EMPTY_CONTENT_PLACEHOLDER ? "" : decoded,
  };
}

/** Look up a thread by order id (or thread id). Returns the API's `data` object. */
async function fetchThreadContext({ orderId, threadId } = {}) {
  if (!API_KEY) {
    throw new Error(
      "CRM_API_KEY is not configured - the CRM Thread API guide only shipped a placeholder key."
    );
  }
  if (!orderId && !threadId) {
    throw new Error("Provide either orderId or threadId.");
  }

  const params = new URLSearchParams(orderId ? { order_id: orderId } : { thread_id: threadId });
  const response = await fetch(`${CRM_API_URL}?${params}`, {
    headers: { "x-api-key": API_KEY },
  });

  const body = await response.json();

  if (!response.ok || body.status === false) {
    throw new Error(body.error?.error_message || `CRM API error ${response.status}`);
  }

  return {
    ...body.data,
    email_summary: (body.data.email_summary || []).map(cleanMessage),
  };
}

module.exports = { fetchThreadContext };
