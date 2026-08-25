/** Proxies code/data restriction escalations (from the triage agent) to the Python pipeline. */

const express = require("express");
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.get("/", async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.status) params.set("status", req.query.status);
    if (req.query.page) params.set("page", req.query.page);
    if (req.query.limit) params.set("limit", req.query.limit);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${PIPELINE_URL}/escalations${qs}`, {
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

router.get("/stats", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/escalations/stats`, {
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

router.post("/seen", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/escalations/seen`, {
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
