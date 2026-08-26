/** The header notification bell's unread summary - direct MongoDB reads, no pipeline hop (see services/proposalStore.js's docstring). */

const express = require("express");
const { getDb } = require("../db");
const { countPendingProposals } = require("../services/proposalStore");
const { countUnseenEscalations } = require("../services/escalationStore");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const [pendingProposalsCount, unseenEscalationsCount] = await Promise.all([
      countPendingProposals(db),
      countUnseenEscalations(db),
    ]);
    res.json({
      pending_proposals_count: pendingProposalsCount,
      unseen_escalations_count: unseenEscalationsCount,
    });
  } catch (err) {
    res.status(502).json({ error: `Could not load notification counts: ${err.message}` });
  }
});

module.exports = router;
