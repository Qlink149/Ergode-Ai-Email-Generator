/**
 * routes/generate.js
 * -------------------
 * Proxies "generate a draft right now" requests to the Python FastAPI
 * pipeline service, which is the only thing that actually talks to
 * OpenAI. This route does no AI work itself - it just forwards the
 * request body and returns whatever the pipeline service responds with.
 */

const express = require("express");
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.post("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/generate`, {
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
