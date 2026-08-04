/**
 * server.js
 * ---------
 * A small Express server with one job: read the report JSON that the
 * Python pipeline produces (data/reports/full_report.json) and serve it
 * to the React viewer over HTTP.
 *
 * This file only wires things up. The actual route logic lives in
 * routes/reports.js. As the project grows past this comparison-report
 * phase, new features get their own route file and get mounted here the
 * same way - this file itself should stay small.
 */

require("dotenv").config({ path: "../.env" });
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

app.listen(port, () => {
  console.log(`Report server running at http://localhost:${port}`);
});
