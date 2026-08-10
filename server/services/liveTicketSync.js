/** Syncs live Order + CRM data for every ticket into "live_tickets" (run: node services/liveTicketSync.js) - avoids re-fetching live on every page load, which trips the Order API's rate limit. */

// Must load before orderApiClient.js/crmThreadApiClient.js, which read env vars at require time.
if (require.main === module) {
  require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
}

const { getDb } = require("../db");
const { fetchOrderDetails } = require("./orderApiClient");
const { fetchThreadContext } = require("./crmThreadApiClient");
const { classifyOrder } = require("./disclosureClassifier");
const { cleanInboundText, isRelayMessage, collapseWhitespace } = require("./messageCleaner");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Matches the {seq, direction, text, order_id, is_relay} shape thread_parser.py produces from the zip. */
function normalizeMessages(emailSummary, orderId) {
  return [...emailSummary]
    .reverse() // CRM API returns newest-first; we want chronological order
    .map((m, i) => {
      const raw = m.message_body || "";
      const isInbound = m.message_type === "message_in";
      const text = collapseWhitespace(isInbound ? cleanInboundText(raw) : raw);
      return {
        seq: i + 1,
        direction: isInbound ? "in" : "out",
        text,
        order_id: orderId,
        is_relay: isInbound && isRelayMessage(text),
        created_time: m.created_time || null,
      };
    });
}

/** Order ids with real customer+agent text in parsed_threads - used only as an index, content always comes from the live APIs. */
async function loadTicketIndex() {
  const db = await getDb();
  const docs = await db.collection("parsed_threads").find({}).toArray();

  const index = [];
  for (const doc of docs) {
    const messages = doc.messages;
    const hasIn = messages.some((m) => m.direction === "in" && m.text && m.text.length > 20);
    const hasOut = messages.some((m) => m.direction === "out" && m.text && m.text.length > 20);
    const orderId = messages.find((m) => m.order_id)?.order_id;
    if (hasIn && hasOut && orderId) {
      index.push({ thread_id: doc.thread_id, order_id: orderId });
    }
  }
  return index;
}

async function fetchOneTicket({ thread_id, order_id }) {
  try {
    const rawOrder = await fetchOrderDetails(order_id);
    if (!rawOrder) return null;
    const thread = await fetchThreadContext({ orderId: order_id }).catch(() => null);
    if (!thread) return null;

    const order = classifyOrder(rawOrder);
    const messages = normalizeMessages(thread.email_summary, order_id);
    if (messages.length === 0) return null;

    // UI display only, never sent to the AI - thread_reason/cancellation_marked have been found unreliable.
    const threadMeta = {
      thread_reason: thread.thread_reason ?? null,
      cancellation_marked: thread.cancellation_marked ?? null,
      order_details: thread.order_details ?? [],
    };

    return { thread_id, order_id, order, messages, threadMeta };
  } catch {
    return null;
  }
}

/** Syncs each ticket sequentially with a delay between calls, to stay under the rate limit. */
async function syncAllTickets({ delayMs = 1200, onProgress } = {}) {
  const index = await loadTicketIndex();
  const db = await getDb();
  const collection = db.collection("live_tickets");

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    const ticket = await fetchOneTicket(entry);

    if (ticket) {
      await collection.replaceOne(
        { thread_id: ticket.thread_id },
        { ...ticket, synced_at: new Date() },
        { upsert: true }
      );
      synced++;
    } else {
      failed++;
    }

    if (onProgress) onProgress({ index: i + 1, total: index.length, thread_id: entry.thread_id, ok: !!ticket });
    if (i < index.length - 1) await sleep(delayMs);
  }

  return { synced, failed, total: index.length };
}

module.exports = { syncAllTickets };

if (require.main === module) {
  syncAllTickets({
    onProgress: ({ index, total, thread_id, ok }) => {
      console.log(`[${index}/${total}] thread ${thread_id}: ${ok ? "synced" : "skipped (no live data)"}`);
    },
  }).then((result) => {
    console.log(`\nDone. Synced ${result.synced}/${result.total}, ${result.failed} skipped.`);
    process.exit(0);
  });
}
