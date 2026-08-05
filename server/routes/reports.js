/**
 * routes/reports.js
 * ------------------
 * Reads pipeline run reports from the "pipeline_runs" MongoDB collection.
 * Every run the Python pipeline does is its own document - write once,
 * never overwritten - so past runs stay available as an audit trail
 * instead of each run replacing the last one.
 *
 * This route is read-only - it does not generate anything itself.
 */

const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

/** The most recent run - what the Comparison Report tab shows by default. */
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const latest = await db
      .collection("pipeline_runs")
      .find({})
      .sort({ generated_at: -1 })
      .limit(1)
      .next();

    if (!latest) {
      return res.status(404).json({
        error: "No report yet. Run the pipeline first: python pipeline/run_pipeline.py",
      });
    }

    res.json(latest);
  } catch (err) {
    res.status(502).json({ error: `Could not load report: ${err.message}` });
  }
});

/** Every past run's headline numbers, newest first - the audit trail. */
router.get("/history", async (req, res) => {
  try {
    const db = await getDb();
    const runs = await db
      .collection("pipeline_runs")
      .find({}, { projection: { cases: 0 } }) // headline numbers only, not every case
      .sort({ generated_at: -1 })
      .toArray();

    res.json({ runs });
  } catch (err) {
    res.status(502).json({ error: `Could not load report history: ${err.message}` });
  }
});

module.exports = router;
