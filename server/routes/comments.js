/**
 * comments.js
 * -----------
 * Agent comments/notes left against a specific order id - e.g. "the AI
 * draft got the refund policy wrong, should say X instead". Posted from
 * EditableDraft.jsx's "Comment" button, right next to "Edit" on a
 * generated draft, so seq plus a snapshot of the customer message and AI
 * reply it's about are included whenever the comment came from that flow -
 * captured at comment time so a reader of CommentsSidebar.jsx never has to
 * regenerate a draft or re-look-up an order just to see what a comment was
 * referring to. Stored in the "order_comments" collection, separate from
 * live_tickets/ai_drafts since a comment can be left against an order
 * looked up here even when no synced ticket exists for it.
 */

const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

// Comment-time snapshots are for context, not full transcripts - cap length
// so a pasted essay-length message can't bloat a comment document.
const SNAPSHOT_MAX_LENGTH = 500;

function truncateSnapshot(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.length > SNAPSHOT_MAX_LENGTH ? `${trimmed.slice(0, SNAPSHOT_MAX_LENGTH)}…` : trimmed;
}

router.post("/", async (req, res) => {
  const orderId = (req.body.order_id || "").trim();
  const author = (req.body.author || "").trim();
  const text = (req.body.text || "").trim();
  // Which customer message (by seq) this comment is about, if it came from
  // EditableDraft.jsx's "Comment" button - optional, since a comment could
  // also be left against an order with no specific message in mind.
  const seq = req.body.seq != null ? String(req.body.seq).trim() : null;

  if (!orderId || !author || !text) {
    return res.status(400).json({ error: "order_id, author, and text are all required." });
  }

  try {
    const db = await getDb();
    const comment = {
      order_id: orderId,
      seq: seq || null,
      customer_message: truncateSnapshot(req.body.customer_message),
      ai_reply: truncateSnapshot(req.body.ai_reply),
      author,
      text,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("order_comments").insertOne(comment);
    res.status(201).json({ ...comment, _id: result.insertedId });
  } catch (err) {
    res.status(502).json({ error: `Could not save comment: ${err.message}` });
  }
});

// Most recent comments across all orders, for the dashboard view.
router.get("/recent", async (req, res) => {
  try {
    const db = await getDb();
    const comments = await db
      .collection("order_comments")
      .find({})
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
    res.json({ comments });
  } catch (err) {
    res.status(502).json({ error: `Could not load recent comments: ${err.message}` });
  }
});

module.exports = router;
