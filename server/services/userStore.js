/**
 * userStore.js
 * ------------
 * MongoDB access for the "users" collection - the named accounts an admin
 * creates from the User Management tab. The shared-password admin is NOT
 * in here; it's handled entirely in authToken.js and has no document.
 *
 * Passwords are stored only as a bcrypt hash. Every function that returns
 * a user to a caller runs it through serialize(), which drops the hash -
 * it must never leave this module.
 */

const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { sanitizePermissions, DEFAULT_PERMISSIONS } = require("./permissions");

const BCRYPT_ROUNDS = 10;
const COLLECTION = "users";

function serialize(doc) {
  if (!doc) return null;
  const { password_hash, ...rest } = doc;
  return { ...rest, _id: doc._id.toString() };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function listUsers(db) {
  const docs = await db.collection(COLLECTION).find({}).sort({ created_at: -1 }).toArray();
  return docs.map(serialize);
}

async function getUserByEmail(db, email) {
  return db.collection(COLLECTION).findOne({ email: normalizeEmail(email) });
}

async function getUserById(db, id) {
  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  return db.collection(COLLECTION).findOne({ _id: oid });
}

/**
 * Create a user. Throws { status, message } on a bad request (duplicate
 * email, missing fields) so the route can translate it to an HTTP error.
 */
async function createUser(db, { email, name, password, permissions }, createdBy) {
  const normEmail = normalizeEmail(email);
  if (!normEmail || !name || !password) {
    throw { status: 400, message: "email, name, and password are all required." };
  }
  if (password.length < 8) {
    throw { status: 400, message: "Password must be at least 8 characters." };
  }
  if (await getUserByEmail(db, normEmail)) {
    throw { status: 409, message: "A user with that email already exists." };
  }
  const doc = {
    email: normEmail,
    name: String(name).trim(),
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    permissions: permissions ? sanitizePermissions(permissions) : { ...DEFAULT_PERMISSIONS },
    active: true,
    created_at: new Date(),
    created_by: createdBy || null,
    updated_at: new Date(),
  };
  const { insertedId } = await db.collection(COLLECTION).insertOne(doc);
  return serialize({ ...doc, _id: insertedId });
}

/** Patch name / permissions / active. Returns the updated (serialized) user, or null if not found. */
async function updateUser(db, id, patch) {
  const oid = (() => {
    try {
      return new ObjectId(id);
    } catch {
      return null;
    }
  })();
  if (!oid) return null;

  const set = { updated_at: new Date() };
  if (typeof patch.name === "string" && patch.name.trim()) set.name = patch.name.trim();
  if (typeof patch.active === "boolean") set.active = patch.active;
  if (patch.permissions) set.permissions = sanitizePermissions(patch.permissions);

  const result = await db
    .collection(COLLECTION)
    .findOneAndUpdate({ _id: oid }, { $set: set }, { returnDocument: "after" });
  // Driver v4 returned { value: doc }; v6+ returns the doc directly (or null).
  const doc = result && "value" in result ? result.value : result;
  return doc ? serialize(doc) : null;
}

/** Set a new password (admin reset or self-service). Returns true if a user was updated. */
async function setPassword(db, id, newPassword) {
  const oid = (() => {
    try {
      return new ObjectId(id);
    } catch {
      return null;
    }
  })();
  if (!oid) return false;
  if (!newPassword || newPassword.length < 8) {
    throw { status: 400, message: "Password must be at least 8 characters." };
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const result = await db
    .collection(COLLECTION)
    .updateOne({ _id: oid }, { $set: { password_hash: hash, updated_at: new Date() } });
  return result.matchedCount > 0;
}

/** True if `password` matches the stored hash for this user doc. */
async function verifyUserPassword(userDoc, password) {
  if (!userDoc || !userDoc.password_hash) return false;
  return bcrypt.compare(String(password || ""), userDoc.password_hash);
}

module.exports = {
  serialize,
  listUsers,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  setPassword,
  verifyUserPassword,
};
