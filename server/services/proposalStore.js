/**
 * proposalStore.js
 * -----------------
 * Direct MongoDB reads for "prompt_proposals" - mirrors the read side of
 * pipeline/prompt_proposal_store.py exactly (same collection, same
 * indexes, same aggregation shape), but served from Node instead of
 * proxied through the Python pipeline.
 *
 * Why this exists as a second copy of the same query logic: every
 * proposal/escalation list or stats request used to go client -> Node ->
 * Python -> Mongo, paying TWO separate serverless cold starts (Node's,
 * then Python's) for a request that's pure read-only Mongo work with no
 * AI involved. Measured directly against production: even with Fluid
 * Compute enabled, each hop still cost ~350-450ms on its own, so chaining
 * them for every read was the real source of "pages load slow" - not
 * anything client-side. Node already has its own connection to the exact
 * same shared database (see db.js), so for reads there's no reason to
 * cross into Python at all. Writes that need the AI/triage logic
 * (approve/reject/override) still proxy to the pipeline - only the
 * pure-read list/stats endpoints moved here.
 */

const DEFAULT_PAGE_SIZE = 200;

function serialize(doc) {
  return { ...doc, _id: doc._id.toString() };
}

async function getAllProposals(db, { status, page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const collection = db.collection("prompt_proposals");
  const query = status ? { status } : {};
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  const [total, docs] = await Promise.all([
    collection.countDocuments(query),
    collection
      .find(query)
      .sort({ created_at: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .toArray(),
  ]);

  return { proposals: docs.map(serialize), total };
}

// Same bucket mapping as PendingApprovalsPage's bucketOf() on the frontend
// and prompt_proposal_store.py's _BUCKET_EXPR on the pipeline side - kept
// in sync by hand since it's a small, stable, 3-way status->bucket rule.
const BUCKET_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ["$status", "pending"] }, then: "pending" },
      { case: { $eq: ["$status", "approved"] }, then: "implemented" },
      { case: { $eq: ["$status", "rejected"] }, then: "rejected" },
    ],
    default: "needs_attention",
  },
};

async function getProposalStats(db) {
  const collection = db.collection("prompt_proposals");
  const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [result] = await collection
    .aggregate([
      {
        $facet: {
          all_time: [{ $group: { _id: BUCKET_EXPR, count: { $sum: 1 } } }],
          this_week: [
            { $match: { created_at: { $gte: weekCutoff } } },
            { $group: { _id: BUCKET_EXPR, count: { $sum: 1 } } },
          ],
          non_override_total: [{ $match: { trigger_type: { $ne: "override" } } }, { $count: "count" }],
        },
      },
    ])
    .toArray();

  const counts = { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 };
  const weekCounts = { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 };
  for (const row of result.all_time) counts[row._id] = row.count;
  for (const row of result.this_week) weekCounts[row._id] = row.count;
  const nonOverrideTotal = result.non_override_total[0]?.count || 0;

  return {
    counts,
    weekCounts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    non_override_total: nonOverrideTotal,
  };
}

async function countPendingProposals(db) {
  return db.collection("prompt_proposals").countDocuments({ status: "pending" });
}

module.exports = { getAllProposals, getProposalStats, countPendingProposals };
