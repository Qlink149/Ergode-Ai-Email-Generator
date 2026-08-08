/**
 * routes/systemPrompt.js
 * -----------------------
 * Read and update the live system prompt, by proxying to the Python
 * pipeline service (which owns the actual prompt file). A save here takes
 * effect on the very next draft generated - no restart needed anywhere.
 */

const express = require("express");
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.get("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/system-prompt`, {
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

router.put("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/system-prompt`, {
      method: "PUT",
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
