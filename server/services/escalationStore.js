/**
 * escalationStore.js
 * --------------------
 * Direct MongoDB reads for "escalations" - mirrors the read side of
 * pipeline/escalation_store.py. See proposalStore.js's docstring for why
 * this duplicates query logic that already exists in Python: it avoids
 * the second serverless hop for pure-read requests.
 */

const DEFAULT_PAGE_SIZE = 200;

function serialize(doc) {
  return { ...doc, _id: doc._id.toString() };
}

async function getEscalations(db, { status, type, page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const collection = db.collection("escalations");
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
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

  return { escalations: docs.map(serialize), total };
}

async function getEscalationStats(db) {
  const collection = db.collection("escalations");
  const rows = await collection.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]).toArray();
  const counts = { code_restriction: 0, data_restriction: 0, none: 0 };
  for (const row of rows) {
    if (row._id in counts) counts[row._id] = row.count;
  }
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

async function countUnseenEscalations(db) {
  return db.collection("escalations").countDocuments({ status: "unseen" });
}

module.exports = { getEscalations, getEscalationStats, countUnseenEscalations };
