/**
 * services/authToken.js
 * -----------------------
 * Two token schemes live here, side by side:
 *
 *  1. The original shared-password token - a deterministic
 *     sha256(password:secret). Still issued for the shared APP_LOGIN_PASSWORD
 *     ("admin"), and still what the Node server uses to authenticate its
 *     own server-to-server calls into the Python pipeline. Unchanged.
 *
 *  2. Per-user JWTs (added with the User Management feature) - signed with
 *     the same AUTH_TOKEN_SECRET, carrying the user's id, email, name and
 *     resolved permissions. server.js's /api middleware accepts either.
 *
 * Both are stateless: no session store, survives restarts, valid until
 * expiry (JWT) or until APP_LOGIN_PASSWORD/AUTH_TOKEN_SECRET change.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const USER_TOKEN_TTL = "30d";

function computeToken() {
  const password = process.env.APP_LOGIN_PASSWORD;
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!password || !secret) return null;
  return crypto.createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

function verifyPassword(password) {
  return Boolean(process.env.APP_LOGIN_PASSWORD) && password === process.env.APP_LOGIN_PASSWORD;
}

function verifyToken(token) {
  const expected = computeToken();
  if (!expected || !token || token.length !== expected.length) return false;
  // Constant-time comparison - a plain === would let response timing leak
  // how many leading characters of a guessed token were correct.
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** Sign a per-user session token. `user` is a serialized user doc (no password_hash). */
function signUserToken(user) {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      kind: "user",
      sub: String(user._id || user.id),
      email: user.email,
      name: user.name,
      perms: user.permissions,
    },
    secret,
    { expiresIn: USER_TOKEN_TTL }
  );
}

/** Decode + verify a per-user token. Returns the payload, or null if invalid/expired. */
function verifyUserToken(token) {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload && payload.kind === "user" ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { computeToken, verifyPassword, verifyToken, signUserToken, verifyUserToken };
