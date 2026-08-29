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

async function getEscalations(db, { status, type, triggerType, page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const collection = db.collection("escalations");
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
  // Powers the "Permanent Edit" filter - every escalation a permanent-fix
  // draft edit produced, regardless of its outcome type.
  if (triggerType) query.trigger_type = triggerType;
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  const [total, docs] = await Promise.all([
    // O(1) metadata read when unfiltered - see proposalStore.js.
    status || type || triggerType ? collection.countDocuments(query) : collection.estimatedDocumentCount(),
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
  const [result] = await collection
    .aggregate([
      {
        $facet: {
          by_type: [{ $group: { _id: "$type", count: { $sum: 1 } } }],
          // "Permanent Edit" stat card's breakdown - of the permanent-fix
          // edits that DIDN'T become a prompt-fix proposal (that half is
          // proposalStore.js's getProposalStats' draft_edit_count), which
          // of the other 3 outcomes they landed as. Grouped, not just
          // counted, so the card can show e.g. "0 became a fix, 8 no gap
          // found" instead of one opaque total.
          draft_edit_by_type: [{ $match: { trigger_type: "draft_edit" } }, { $group: { _id: "$type", count: { $sum: 1 } } }],
        },
      },
    ])
    .toArray();

  const counts = { code_restriction: 0, data_restriction: 0, none: 0 };
  for (const row of result.by_type) {
    if (row._id in counts) counts[row._id] = row.count;
  }
  const draftEditCounts = { code_restriction: 0, data_restriction: 0, none: 0 };
  for (const row of result.draft_edit_by_type) {
    if (row._id in draftEditCounts) draftEditCounts[row._id] = row.count;
  }
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    draft_edit_counts: draftEditCounts,
  };
}

async function countUnseenEscalations(db) {
  return db.collection("escalations").countDocuments({ status: "unseen" });
}

module.exports = { getEscalations, getEscalationStats, countUnseenEscalations };
