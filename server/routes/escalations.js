/**
 * routes/escalations.js
 * -----------------------
 * Code/data-restriction escalations from the triage agent. Read endpoints
 * (/, /stats) and the simple "mark seen" write query MongoDB directly -
 * see services/escalationStore.js. Override still proxies to the Python
 * pipeline since it drafts a real fix via the AI, not just a Mongo write.
 */

const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");
const { computeToken } = require("../services/authToken");
const { getEscalations, getEscalationStats } = require("../services/escalationStore");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;
    const data = await getEscalations(db, { status: req.query.status, type: req.query.type, page, limit });
    res.json({ ...data, page, limit });
  } catch (err) {
    res.status(502).json({ error: `Could not load escalations: ${err.message}` });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const db = await getDb();
    const stats = await getEscalationStats(db);
    res.json(stats);
  } catch (err) {
    res.status(502).json({ error: `Could not load escalation stats: ${err.message}` });
  }
});

router.post("/seen", async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      return res.json({ status: "ok", updated: 0 });
    }
    const db = await getDb();
    const result = await db.collection("escalations").updateMany(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, status: "unseen" },
      { $set: { status: "seen", seen_at: new Date() } }
    );
    res.json({ status: "ok", updated: result.modifiedCount });
  } catch (err) {
    res.status(502).json({ error: `Could not mark escalations seen: ${err.message}` });
  }
});

router.post("/:id/override", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/escalations/${req.params.id}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${computeToken()}` },
      body: JSON.stringify(req.body),
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
