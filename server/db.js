/**
 * db.js
 * -----
 * One shared MongoDB connection, reused across every route instead of
 * each route opening its own. Connects lazily on first use and caches
 * the connection promise - important both for local dev (don't reconnect
 * per request) and for Vercel (each serverless invocation should reuse a
 * warm connection when the container is reused, not open a fresh one
 * every time).
 */

const { MongoClient } = require("mongodb");

let clientPromise = null;

function getClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGODB_URI, {
      // Fail fast on a momentary Atlas hiccup instead of hanging on the
      // 30s driver default - a stalled request is worse than a clear error.
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    }).connect();
  }
  return clientPromise;
}

let indexesReady = false;

async function getDb() {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB_NAME || "ergode");
  if (!indexesReady) {
    indexesReady = true;
    // Correctness, not just speed: two accounts must never share an email.
    // createIndex is idempotent; a transient failure just retries next cold start.
    db.collection("users")
      .createIndex({ email: 1 }, { unique: true })
      .catch(() => {
        indexesReady = false;
      });
  }
  return db;
}

module.exports = { getDb };
