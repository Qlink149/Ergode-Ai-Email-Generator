/**
 * routes/draftEdit.js
 * -------------------
 * Proxies "save my edit to this draft" to the Python pipeline's /draft-edit.
 *
 * Guardrail (permanent-fix): a plain edit is just saved for that one reply.
 * It only goes to the triage agent - and so into the approval queue - when
 * the editor ticked "this is a permanent fix" AND has the flagPermanentFix
 * permission. This route is where that permission is enforced: if the
 * caller isn't allowed, permanent_fix is forced back to false before the
 * request reaches the pipeline.
 *
 * Author: the client sends a free-text name (EditableDraft.jsx, prefilled
 * from the logged-in user but editable - same pattern as the Comment
 * form's "Your name" field). Falls back to the session identity, then
 * "unknown", so a proposal/escalation this creates is never blank.
 */

const express = require("express");
const { computeToken } = require("../services/authToken");

const router = express.Router();
const PIPELINE_URL = process.env.PIPELINE_URL || "http://localhost:8001";

router.put("/", async (req, res) => {
  const wantsPermanentFix = Boolean(req.body && req.body.permanent_fix);
  const mayFlag = Boolean(req.user && req.user.perms && req.user.perms.flagPermanentFix);
  const providedAuthor = typeof req.body?.author === "string" ? req.body.author.trim() : "";

  const body = {
    ...req.body,
    permanent_fix: wantsPermanentFix && mayFlag,
    author: providedAuthor || (req.user && (req.user.name || req.user.email)) || "unknown",
  };

  try {
    const response = await fetch(`${PIPELINE_URL}/draft-edit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${computeToken()}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.status(response.status).json({ ...data, permanent_fix_applied: body.permanent_fix });
  } catch (err) {
    res.status(502).json({
      error: "Could not reach the AI pipeline service. Is it running (python pipeline/app.py)?",
      detail: err.message,
    });
  }
});

module.exports = router;
