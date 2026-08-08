/** The ticket queue - reads from "live_tickets" (synced by services/liveTicketSync.js), not fetched live per request. */

const express = require("express");
const { getDb } = require("../db");
const { readRawMessages } = require("../services/rawEmailReader");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const tickets = await db.collection("live_tickets").find({}).toArray();

    const rows = tickets.map((t) => {
      const last = t.messages[t.messages.length - 1];
      return {
        thread_id: t.thread_id,
        order_id: t.order_id,
        product_name: t.order.customer_safe.product_name,
        recipient_name: t.order.customer_safe.recipient_name,
        message_count: t.messages.length,
        status: last.direction === "in" ? "awaiting_reply" : "responded",
        has_relay: t.messages.some((m) => m.is_relay),
        last_message_direction: last.direction,
        last_message_preview: (last.text || "").slice(0, 140),
      };
    });

    rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "awaiting_reply" ? -1 : 1));

    res.json({ tickets: rows });
  } catch (err) {
    res.status(502).json({ error: `Could not load tickets: ${err.message}` });
  }
});

router.get("/:threadId", async (req, res) => {
  try {
    const db = await getDb();
    const ticket = await db.collection("live_tickets").findOne({ thread_id: req.params.threadId });

    if (!ticket) {
      return res.status(404).json({ error: `No synced ticket found for thread ${req.params.threadId}` });
    }

    res.json({
      thread_id: ticket.thread_id,
      order_id: ticket.order_id,
      order: ticket.order,
      messages: ticket.messages,
      thread_meta: ticket.threadMeta || null,
    });
  } catch (err) {
    res.status(502).json({ error: `Could not load thread: ${err.message}` });
  }
});

/** The original raw Amazon-branded email HTML for this thread, if we have it on disk - display only. */
router.get("/:threadId/raw-messages", (req, res) => {
  try {
    const messages = readRawMessages(req.params.threadId);
    res.json({ found: messages !== null, messages: messages || [] });
  } catch (err) {
    res.status(500).json({ error: `Could not read raw email files: ${err.message}` });
  }
});

module.exports = router;
