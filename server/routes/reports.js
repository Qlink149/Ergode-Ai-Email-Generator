/**
 * routes/reports.js
 * ------------------
 * Reads the report file the Python pipeline generates and returns it.
 *
 * This route is read-only - it does not generate anything itself. It
 * re-reads the file on every request so a fresh pipeline run shows up
 * immediately without restarting this server.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const REPORT_PATH = path.join(__dirname, "..", "..", "data", "reports", "full_report.json");

router.get("/", (req, res) => {
  if (!fs.existsSync(REPORT_PATH)) {
    return res.status(404).json({
      error: "No report yet. Run the pipeline first: python pipeline/run_pipeline.py",
    });
  }

  const raw = fs.readFileSync(REPORT_PATH, "utf-8");
  res.json(JSON.parse(raw));
});

module.exports = router;
