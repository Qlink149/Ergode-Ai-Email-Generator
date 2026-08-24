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
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

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
      // Full snapshot of what AiContextPanel.jsx shows when generating -
      // order facts, thread history, reasoning, policy, system prompt
      // version - captured as-is (not truncated like the text snippets
      // above) so the same panel can be re-rendered later against a
      // comment with full fidelity, no regenerate/re-look-up needed.
      ai_context: req.body.ai_context || null,
      author,
      text,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("order_comments").insertOne(comment);

    // A comment is itself feedback - run it through the triage agent right
    // away so a wrong-prompt gap surfaces as a proposal, or a code/data gap
    // surfaces as an escalation, without anyone having to notice by hand.
    // Best-effort: the comment is already saved either way, a triage
    // failure here should never turn a successful post into an error.
    let triage = null;
    try {
      const triageResp = await fetch(`${PIPELINE_URL}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${computeToken()}` },
        body: JSON.stringify({
          trigger_type: "comment",
          order_id: orderId,
          author,
          comment_id: String(result.insertedId),
          seq,
          source_text: text,
          // Prefer the full, untruncated message/facts already captured on
          // ai_context over the 500-char comment snapshot, when present.
          customer_message: comment.ai_context?.context?.customer_message ?? comment.customer_message,
          ai_draft_reply: comment.ai_reply,
          ai_reasoning: comment.ai_context?.reasoning,
          ai_policy_applied: comment.ai_context?.policy_applied,
          order_facts: comment.ai_context?.context?.order_facts,
          thread_history: comment.ai_context?.context?.thread_history,
        }),
      });
      triage = await triageResp.json();
      await db.collection("order_comments").updateOne(
        { _id: result.insertedId },
        {
          $set: {
            triage_outcome: triage.outcome ?? null,
            triage_proposal_id: triage.proposal_id ?? null,
            triage_escalation_id: triage.escalation_id ?? null,
          },
        }
      );
    } catch (err) {
      // Pipeline unreachable, or triage itself failed - comment stands as saved.
    }

    res.status(201).json({ ...comment, _id: result.insertedId, triage });
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
