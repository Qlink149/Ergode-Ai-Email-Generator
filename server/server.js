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
const reportsRouter = require("./routes/reports");
const generateRouter = require("./routes/generate");
const systemPromptRouter = require("./routes/systemPrompt");
const ticketsRouter = require("./routes/tickets");
const orderLookupRouter = require("./routes/orderLookup");

const app = express();
const port = process.env.SERVER_PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/api/reports", reportsRouter);
app.use("/api/generate", generateRouter);
app.use("/api/system-prompt", systemPromptRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/order-lookup", orderLookupRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Only bind a real port locally - on Vercel, app.listen() must not run;
// the platform invokes `app` directly as the request handler instead.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Report server running at http://localhost:${port}`);
  });
}

module.exports = app;
