/** Proxies "save my edit to this draft" to the Python pipeline's /draft-edit. */

const express = require("express");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.put("/", async (req, res) => {
  try {
    const response = await fetch(`${PIPELINE_URL}/draft-edit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
