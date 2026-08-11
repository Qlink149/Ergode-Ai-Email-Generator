/**
 * routes/translate.js
 * --------------------
 * Proxies "translate this message to English" requests to the pipeline -
 * same pattern as generate.js, this route does no AI work itself.
 */

const express = require("express");
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.post("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/translate`, {
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
