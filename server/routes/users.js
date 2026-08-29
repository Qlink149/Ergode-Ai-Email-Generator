/**
 * routes/users.js
 * ---------------
 * User Management - mounted at /api/users behind the auth middleware AND
 * requirePerm("manageUsers") (see server.js), so every handler here can
 * assume the caller is allowed to administer accounts.
 *
 *   GET    /api/users            list all users (no password hashes)
 *   POST   /api/users            create { email, name, password, permissions }
 *   PATCH  /api/users/:id        update { name?, permissions?, active? }
 *   POST   /api/users/:id/password   admin reset { newPassword }
 */

const express = require("express");
const { getDb } = require("../db");
const { listUsers, createUser, updateUser, setPassword } = require("../services/userStore");
const { TAB_IDS, PERMISSION_KEYS } = require("../services/permissions");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    res.json({ users: await listUsers(db), tab_ids: TAB_IDS, permission_keys: PERMISSION_KEYS });
  } catch (err) {
    res.status(502).json({ error: `Could not load users: ${err.message}` });
  }
});

router.post("/", async (req, res) => {
  try {
    const db = await getDb();
    const { email, name, password, permissions } = req.body || {};
    const createdBy = req.user.email || req.user.name || "admin";
    const user = await createUser(db, { email, name, password, permissions }, createdBy);
    res.status(201).json({ user });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Could not create user." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { name, permissions, active } = req.body || {};
    const user = await updateUser(db, req.params.id, { name, permissions, active });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Could not update user." });
  }
});

router.post("/:id/password", async (req, res) => {
  try {
    const db = await getDb();
    const updated = await setPassword(db, req.params.id, (req.body || {}).newPassword);
    if (!updated) return res.status(404).json({ error: "User not found." });
    res.json({ status: "ok" });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "Could not reset password." });
  }
});

module.exports = router;
