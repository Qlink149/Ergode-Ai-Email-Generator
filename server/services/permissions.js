/**
 * permissions.js
 * --------------
 * The whole RBAC vocabulary in one place: which tabs exist, which action
 * permissions exist, what a brand-new user gets by default, and what the
 * shared-password admin implicitly has (everything).
 *
 * Auth model (see server.js's middleware and services/authToken.js):
 *  - The shared APP_LOGIN_PASSWORD still works and logs you in as "admin"
 *    with every permission - nothing to set up, always a way in.
 *  - Named users log in with email + password, carry a signed JWT, and
 *    only have the permissions an admin ticked for them.
 *
 * Every check is enforced server-side (requirePerm below); the client
 * hides UI it can't use, but that's convenience, not the boundary.
 */

// The functional tabs App.jsx can show. "users" is the User Management tab.
const TAB_IDS = ["lookup", "prompt", "approvals", "users"];

// Action permissions, on top of tab visibility.
const PERMISSION_KEYS = [
  "approveProposals", // Approve/Reject a proposal, Override an escalation
  "editSystemPrompt", // Save on the System Prompt page (incl. Restore)
  "flagPermanentFix", // mark a draft edit as a permanent fix -> sends it to triage/approval
  "manageUsers", // the User Management tab: create users, set permissions, reset passwords
];

// What the shared-password admin gets, and what a "select all" in the UI means.
const ALL_PERMISSIONS = {
  tabs: [...TAB_IDS],
  ...Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])),
};

// A new user with nothing ticked: can open Order Lookup, nothing else.
const DEFAULT_PERMISSIONS = {
  tabs: ["lookup"],
  ...Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])),
};

/** Clamp arbitrary client input down to exactly the known shape - unknown keys/tabs dropped. */
function sanitizePermissions(input) {
  const src = input && typeof input === "object" ? input : {};
  const tabs = Array.isArray(src.tabs) ? src.tabs.filter((t) => TAB_IDS.includes(t)) : [];
  // manageUsers implies the users tab is visible, and everyone can see Order Lookup.
  const tabSet = new Set(tabs);
  tabSet.add("lookup");
  if (src.manageUsers) tabSet.add("users");
  const out = { tabs: TAB_IDS.filter((t) => tabSet.has(t)) };
  for (const key of PERMISSION_KEYS) out[key] = Boolean(src[key]);
  return out;
}

/** Express middleware: 403 unless req.user has the named permission. */
function requirePerm(key) {
  return (req, res, next) => {
    if (req.user && req.user.perms && req.user.perms[key]) return next();
    return res.status(403).json({ error: "You don't have permission to do that." });
  };
}

module.exports = {
  TAB_IDS,
  PERMISSION_KEYS,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  sanitizePermissions,
  requirePerm,
};
