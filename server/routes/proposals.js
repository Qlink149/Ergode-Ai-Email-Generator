/** Proxies the Pending Approvals queue (prompt-fix proposals) to the Python pipeline. */

const express = require("express");
const { computeToken } = require("../services/authToken");

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
    const params = new URLSearchParams();
    if (req.query.status) params.set("status", req.query.status);
    if (req.query.page) params.set("page", req.query.page);
    if (req.query.limit) params.set("limit", req.query.limit);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${PIPELINE_URL}/proposals/history${qs}`, {
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
    const response = await fetch(`${PIPELINE_URL}/proposals/stats`, {
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

router.post("/:id/approve", async (req, res) => {
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

router.post("/:id/reject", async (req, res) => {
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
