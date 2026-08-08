/** The one public auth route - everything else under /api requires the token this issues, see server.js. */

const express = require("express");
const { verifyPassword, computeToken } = require("../services/authToken");

const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body || {};

  if (!verifyPassword(password)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const token = computeToken();
  if (!token) {
    return res.status(500).json({ error: "Login is not configured (APP_LOGIN_PASSWORD/AUTH_TOKEN_SECRET)" });
  }

  res.json({ token });
});

module.exports = router;
