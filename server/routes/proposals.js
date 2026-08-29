/**
 * routes/proposals.js
 * ---------------------
 * The Pending Approvals queue (prompt-fix proposals). Read endpoints
 * (/history, /stats) query MongoDB directly - see services/proposalStore.js
 * for why. Approve/reject still proxy to the Python pipeline since those
 * involve the AI recheck-against-the-live-prompt step, not just a read.
 */

const express = require("express");
const { getDb } = require("../db");
const { computeToken } = require("../services/authToken");
const { requirePerm } = require("../services/permissions");
const { getAllProposals, getProposalStats } = require("../services/proposalStore");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.get("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/proposals`, {
      headers: { Authorization: `Bearer ${computeToken()}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Could not reach the AI pipeline service. Is it running (uvicorn api:app --port 8001)?",
      detail: err.message,
    });
  }
});

router.get("/history", async (req, res) => {
  try {
    const db = await getDb();
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;
    const data = await getAllProposals(db, { status: req.query.status, page, limit });
    res.json({ ...data, page, limit });
  } catch (err) {
    res.status(502).json({ error: `Could not load proposal history: ${err.message}` });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const db = await getDb();
    const stats = await getProposalStats(db);
    res.json(stats);
  } catch (err) {
    res.status(502).json({ error: `Could not load proposal stats: ${err.message}` });
  }
});

router.post("/:id/approve", requirePerm("approveProposals"), async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/proposals/${req.params.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${computeToken()}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Could not reach the AI pipeline service. Is it running (uvicorn api:app --port 8001)?",
      detail: err.message,
    });
  }
});

router.post("/:id/reject", requirePerm("approveProposals"), async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/proposals/${req.params.id}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${computeToken()}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Could not reach the AI pipeline service. Is it running (uvicorn api:app --port 8001)?",
      detail: err.message,
    });
  }
});

module.exports = router;
