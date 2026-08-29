/**
 * routes/account.js
 * -----------------
 * Authenticated self-service, mounted at /api/account AFTER the auth
 * middleware (so req.user is always set):
 *
 *   GET  /api/account/me        - who am I + what can I do (the client
 *                                  renders tabs/buttons from this)
 *   POST /api/account/password  - change my own password (named users only;
 *                                  the shared-password admin has no account)
 */

const express = require("express");
const { getDb } = require("../db");
const { getUserById, verifyUserPassword, setPassword } = require("../services/userStore");

const router = express.Router();

router.get("/me", (req, res) => {
  res.json({
    kind: req.user.kind, // "user" | "admin"
    id: req.user.id || null,
    email: req.user.email || null,
    name: req.user.name || null,
    permissions: req.user.perms,
  });
});

router.post("/password", async (req, res) => {
  if (req.user.kind !== "user") {
    return res.status(400).json({ error: "The shared admin login has no password to change here." });
  }
  const { currentPassword, newPassword } = req.body || {};
  try {
    const db = await getDb();
    const userDoc = await getUserById(db, req.user.id);
    if (!userDoc || !(await verifyUserPassword(userDoc, currentPassword))) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
    await setPassword(db, req.user.id, newPassword);
    res.json({ status: "ok" });
  } catch (err) {
    const status = err.status || 502;
    res.status(status).json({ error: err.message || "Could not change password." });
  }
});

module.exports = router;
