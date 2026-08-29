/**
 * routes/systemPrompt.js
 * -----------------------
 * Read and update the live system prompt (the "system_prompts" collection).
 * All of this is pure append-only Mongo work with no AI involved, so it's
 * served straight from Node - see services/systemPromptStore.js, and
 * proposalStore.js's docstring for why crossing into the Python pipeline
 * for reads was the real cause of slow page loads.
 *
 * The one exception: a brand-new, never-seeded database. loadSystemPrompt()
 * returns null then, and only that single request proxies through to the
 * pipeline, which seeds version 1 from system_prompt_seed.md. Happens once
 * per database, ever.
 *
 * A save here still takes effect on the very next draft generated -
 * draft_generator.py reads the latest version fresh from the same Mongo on
 * every call.
 */

const express = require("express");
const { getDb } = require("../db");
const { computeToken } = require("../services/authToken");
const { requirePerm } = require("../services/permissions");
const {
  loadSystemPrompt,
  listSystemPromptVersions,
  getSystemPromptVersionContent,
  saveSystemPrompt,
} = require("../services/systemPromptStore");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const content = await loadSystemPrompt(db);
    if (content !== null) {
      return res.json({ content });
    }
    // Never-seeded database - let the pipeline seed it from
    // system_prompt_seed.md (its file, its job). One-time.
    const response = await fetch(`${PIPELINE_URL}/system-prompt`, {
      headers: { Authorization: `Bearer ${computeToken()}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Could not load the system prompt: ${err.message}` });
  }
});

router.get("/versions", async (req, res) => {
  try {
    const db = await getDb();
    res.json({ versions: await listSystemPromptVersions(db) });
  } catch (err) {
    res.status(502).json({ error: `Could not load system-prompt versions: ${err.message}` });
  }
});

router.get("/versions/:id", async (req, res) => {
  try {
    const db = await getDb();
    const result = await getSystemPromptVersionContent(db, req.params.id);
    if (result === null) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `Could not load that version: ${err.message}` });
  }
});

router.put("/", requirePerm("editSystemPrompt"), async (req, res) => {
  try {
    const content = req.body?.content;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "content (string) is required." });
    }
    const db = await getDb();
    const version = await saveSystemPrompt(db, content);
    res.json({ status: "saved", version });
  } catch (err) {
    res.status(502).json({ error: `Could not save the system prompt: ${err.message}` });
  }
});

module.exports = router;
