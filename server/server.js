/**
 * server.js
 * ---------
 * The Express app - all API routes mount here.
 *
 * Runs two ways:
 *   - Locally: `node server.js` starts a normal persistent server on
 *     SERVER_PORT (see the app.listen() guard at the bottom).
 *   - On Vercel: this file is deployed as a serverless function (see
 *     vercel.json). Vercel imports `module.exports = app` and calls it
 *     per-request - app.listen() never runs there, Vercel's runtime
 *     handles the actual listening.
 *
 * This file only wires things up. The actual route logic lives in
 * routes/*.js - new features get their own route file and mount here
 * the same way, so this file stays small.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const generateRouter = require("./routes/generate");
const systemPromptRouter = require("./routes/systemPrompt");
const orderLookupRouter = require("./routes/orderLookup");
const draftEditRouter = require("./routes/draftEdit");
const translateRouter = require("./routes/translate");
const commentsRouter = require("./routes/comments");
const proposalsRouter = require("./routes/proposals");
const escalationsRouter = require("./routes/escalations");
const notificationsRouter = require("./routes/notifications");
const authRouter = require("./routes/auth");
const { verifyToken } = require("./services/authToken");

const app = express();
const port = process.env.SERVER_PORT || 4000;

// CORS_ORIGIN is a comma-separated allowlist (e.g. the frontend's Vercel
// domain, plus a custom domain if it has one). Unset locally, which falls
// back to wide-open - fine for local dev, not for production.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Fail loud instead of silently running wide-open: a Vercel deploy with no
// CORS_ORIGIN set would otherwise accept requests from any origin with no
// warning. Locally (no VERCEL env var) the wide-open fallback still applies.
if (process.env.VERCEL && allowedOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGIN must be set in production (Vercel) - refusing to start with CORS wide open. " +
      "Set it to the frontend's deployed domain(s), comma-separated."
  );
}

// maxAge: the client and API are separate origins (separate Vercel
// projects), so the browser fires a CORS preflight (OPTIONS) before every
// GET/PUT/POST that carries the Authorization header - each one a full
// round trip that showed up as ~300ms per request in the network tab.
// Caching the preflight means one OPTIONS per endpoint per browser
// session (Chrome caps the cache at 2h) instead of one before every call.
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : "*", maxAge: 86400 }));
app.use(express.json());

// Request timing. One line per request in the function log stream
// (`vercel logs <deployment>` or the dashboard) - method, path, status,
// server-side duration. This is the time spent IN the handler only; it
// does not include cold start or network, so a fast number here next to a
// slow number in the browser's network tab points straight at
// infrastructure (cold start / region distance) rather than the code.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`[timing] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
});

// Public: logging in, and the health check other services poll.
app.use("/api/auth", authRouter);
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Everything else under /api requires the shared-password token from /api/auth/login.
app.use("/api", (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.use("/api/generate", generateRouter);
app.use("/api/system-prompt", systemPromptRouter);
app.use("/api/order-lookup", orderLookupRouter);
app.use("/api/draft-edit", draftEditRouter);
app.use("/api/translate", translateRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/escalations", escalationsRouter);
app.use("/api/notifications", notificationsRouter);

// Only bind a real port locally - on Vercel, app.listen() must not run;
// the platform invokes `app` directly as the request handler instead.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Report server running at http://localhost:${port}`);
  });
}

module.exports = app;
