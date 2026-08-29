/**
 * routes/auth.js
 * --------------
 * The one PUBLIC auth route: POST /api/auth/login. Everything else under
 * /api requires the token this issues (see server.js).
 *
 * Two ways to log in:
 *  - email + password  -> a named user account (users collection). Returns
 *    a signed per-user JWT carrying that user's permissions.
 *  - password only      -> the shared APP_LOGIN_PASSWORD. Returns the
 *    original deterministic admin token. Always available, full access.
 *
 * Self-service (`GET /me`, change password) lives in routes/account.js,
 * which is mounted AFTER the auth middleware.
 */

const express = require("express");
const { getDb } = require("../db");
const { verifyPassword, computeToken, signUserToken } = require("../services/authToken");
const { getUserByEmail, verifyUserPassword, serialize } = require("../services/userStore");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  // Named-user login.
  if (email && String(email).trim()) {
    try {
      const db = await getDb();
      const userDoc = await getUserByEmail(db, email);
      const ok = userDoc && userDoc.active !== false && (await verifyUserPassword(userDoc, password));
      if (!ok) {
        return res.status(401).json({ error: "Incorrect email or password." });
      }
      const user = serialize(userDoc);
      return res.json({ token: signUserToken(user), user });
    } catch (err) {
      return res.status(502).json({ error: `Login failed: ${err.message}` });
    }
  }

  // Shared-password admin login (unchanged).
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  const token = computeToken();
  if (!token) {
    return res.status(500).json({ error: "Login is not configured (APP_LOGIN_PASSWORD/AUTH_TOKEN_SECRET)" });
  }
  res.json({ token, user: { name: "Admin", kind: "admin" } });
});

module.exports = router;
