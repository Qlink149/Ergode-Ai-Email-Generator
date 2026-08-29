/**
 * systemPromptStore.js
 * ---------------------
 * Direct MongoDB reads/writes for "system_prompts" - mirrors
 * pipeline/system_prompt_store.py (same collection, same append-only
 * model, same version-preview aggregation), served from Node instead of
 * proxied through the Python pipeline.
 *
 * See proposalStore.js's docstring for the full rationale. Short version:
 * client -> Node -> Python -> Mongo paid two serverless cold starts for a
 * request that's pure Mongo work. The System Prompt page was the last
 * page whose load still crossed into Python for nothing but reads - every
 * other read endpoint already moved to Node. The only system-prompt
 * operations that still belong in Python are the ones the AI is actually
 * part of (a proposal's recheck-and-splice at approval time), and those
 * call save_system_prompt() in-process there, never through this route.
 *
 * The one case this hands back to Python: a brand-new database with zero
 * versions, where load has to SEED from pipeline/system_prompt_seed.md.
 * loadSystemPrompt() returns null then and the route proxies that single
 * request through - it happens once in a database's lifetime.
 */

const { ObjectId } = require("mongodb");

// Mirrors system_prompt_store.py's _PREVIEW_LENGTH - the History list view
// renders a ~220-char preview per row until a version is expanded.
const PREVIEW_LENGTH = 220;

/** Current live prompt text, or null if the collection has never been seeded. */
async function loadSystemPrompt(db) {
  const latest = await db
    .collection("system_prompts")
    .findOne({}, { sort: { version: -1 }, projection: { content: 1 } });
  return latest ? latest.content : null;
}

/** Highest version number, or 0 if none. */
async function getSystemPromptVersion(db) {
  const latest = await db
    .collection("system_prompts")
    .findOne({}, { sort: { version: -1 }, projection: { version: 1 } });
  return latest ? latest.version : 0;
}

/**
 * Every past version, newest first, PREVIEW TEXT ONLY - never the full
 * content field (tens of KB each, collection is 60+ versions and never
 * shrinks). $substrCP/$strLenCP are codepoint-aware so a multi-byte
 * character can't be split mid-preview or throw the "…" logic off.
 */
async function listSystemPromptVersions(db) {
  const versions = await db
    .collection("system_prompts")
    .aggregate([
      { $sort: { version: -1 } },
      {
        $project: {
          version: 1,
          updated_at: 1,
          source: 1,
          source_proposal_id: 1,
          source_comment_id: 1,
          content_preview: { $substrCP: ["$content", 0, PREVIEW_LENGTH] },
          content_length: { $strLenCP: "$content" },
        },
      },
    ])
    .toArray();

  return versions.map((v) => ({ ...v, _id: v._id.toString() }));
}

/** One version's full text, on demand - only when a History card is expanded or restored. */
async function getSystemPromptVersionContent(db, versionId) {
  let oid;
  try {
    oid = new ObjectId(versionId);
  } catch {
    return null; // malformed id - treated as "not found" by the route
  }
  const doc = await db
    .collection("system_prompts")
    .findOne({ _id: oid }, { projection: { version: 1, content: 1 } });
  if (!doc) return null;
  return { version: doc.version, content: doc.content };
}

/**
 * Append a new version - every past version is kept, nothing overwritten.
 * Matches save_system_prompt()'s default path exactly: source "manual",
 * version = current max + 1. (Same non-transactional max+1 as the Python
 * side; a true race would need two saves within the same millisecond.)
 */
async function saveSystemPrompt(db, content, { source = "manual", sourceProposalId = null, sourceCommentId = null } = {}) {
  const collection = db.collection("system_prompts");
  const latest = await collection.findOne({}, { sort: { version: -1 }, projection: { version: 1 } });
  const nextVersion = latest ? latest.version + 1 : 1;
  await collection.insertOne({
    version: nextVersion,
    content,
    updated_at: new Date(),
    source,
    source_proposal_id: sourceProposalId,
    source_comment_id: sourceCommentId,
  });
  return nextVersion;
}

module.exports = {
  loadSystemPrompt,
  getSystemPromptVersion,
  listSystemPromptVersions,
  getSystemPromptVersionContent,
  saveSystemPrompt,
};
