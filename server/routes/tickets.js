/**
 * routes/tickets.js
 * ------------------
 * The ticket queue: one row per customer thread, like a support inbox.
 *
 * Right now this reads the threads the Python pipeline parsed out of
 * categorizations.zip (data/parsed_threads/*.json) - that's the acquisition
 * source for this phase. When the real CRM Thread API goes live, only the
 * loadAllThreads() function below needs to change to call that API instead
 * of reading these files; every route and the React pages that consume
 * them stay the same.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const THREADS_DIR = path.join(__dirname, "..", "..", "data", "parsed_threads");

/** Read every parsed thread file. Swap this out for a live API call later. */
function loadAllThreads() {
  if (!fs.existsSync(THREADS_DIR)) return {};

  const threads = {};
  for (const file of fs.readdirSync(THREADS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const threadId = file.replace(".json", "");
    threads[threadId] = JSON.parse(fs.readFileSync(path.join(THREADS_DIR, file), "utf-8"));
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

router.get("/", (req, res) => {
  const threads = loadAllThreads();
  const rows = Object.entries(threads).map(([id, messages]) => summarize(id, messages));

  // Threads waiting on a reply surface first - that's the actual queue.
  rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "awaiting_reply" ? -1 : 1));

  res.json({ tickets: rows });
});

router.get("/:threadId", (req, res) => {
  const threads = loadAllThreads();
  const messages = threads[req.params.threadId];

  if (!messages) {
    return res.status(404).json({ error: `No thread found with id ${req.params.threadId}` });
  }

  res.json({ thread_id: req.params.threadId, messages });
});

module.exports = router;
