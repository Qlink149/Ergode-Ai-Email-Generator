/**
 * services/authToken.js
 * -----------------------
 * Single shared-password gate for the whole app - not per-user accounts.
 * The token is a deterministic hash of the password + a server-only
 * secret, so it needs no session store and survives server restarts: any
 * client holding a previously-issued token stays logged in as long as
 * APP_LOGIN_PASSWORD/AUTH_TOKEN_SECRET don't change.
 */

const crypto = require("crypto");

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

module.exports = { computeToken, verifyPassword, verifyToken };
