/**
 * routes/tickets.js
 * ------------------
 * The ticket queue: one row per customer thread, like a support inbox.
 *
 * Reads from the "parsed_threads" MongoDB collection, written by the
 * Python pipeline's thread_parser.py. That's the acquisition source for
 * this phase. When the real CRM Thread API goes live, only
 * loadAllThreads() below needs to change to call that API (and write
 * results into the same collection shape) - every route and the React
 * pages that consume them stay the same.
 */

const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

/** Read every parsed thread from MongoDB. Swap this out for a live API call later. */
async function loadAllThreads() {
  const db = await getDb();
  const docs = await db.collection("parsed_threads").find({}).toArray();

  const threads = {};
  for (const doc of docs) {
    threads[doc.thread_id] = doc.messages;
  }
  return threads;
}

/** Turn one thread's full message list into the summary row the queue shows. */
function summarize(threadId, messages) {
  const last = messages[messages.length - 1];
  const orderId = messages.find((m) => m.order_id)?.order_id || null;
  const hasRelay = messages.some((m) => m.is_relay);

  return {
    thread_id: threadId,
    order_id: orderId,
    message_count: messages.length,
    status: last.direction === "in" ? "awaiting_reply" : "responded",
    has_relay: hasRelay,
    last_message_direction: last.direction,
    last_message_preview: last.text.slice(0, 140),
  };
}

router.get("/", async (req, res) => {
  try {
    const threads = await loadAllThreads();
    const rows = Object.entries(threads).map(([id, messages]) => summarize(id, messages));

    // Threads waiting on a reply surface first - that's the actual queue.
    rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "awaiting_reply" ? -1 : 1));

    res.json({ tickets: rows });
  } catch (err) {
    res.status(502).json({ error: `Could not load tickets: ${err.message}` });
  }
});

router.get("/:threadId", async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("parsed_threads").findOne({ thread_id: req.params.threadId });

    if (!doc) {
      return res.status(404).json({ error: `No thread found with id ${req.params.threadId}` });
    }

    res.json({ thread_id: req.params.threadId, messages: doc.messages });
  } catch (err) {
    res.status(502).json({ error: `Could not load thread: ${err.message}` });
  }
});

module.exports = router;
