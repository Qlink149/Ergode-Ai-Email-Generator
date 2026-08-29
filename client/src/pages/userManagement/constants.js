/**
 * constants.js
 * ------------
 * Plain lookup tables shared across the User Management components -
 * same pattern as pendingApprovals/constants.js.
 */

export const TAB_LABELS = {
  lookup: "Order Lookup",
  prompt: "System Prompt",
  approvals: "Pending Approvals",
  users: "User Management",
};

export const PERMISSION_LABELS = {
  approveProposals: "Approve / reject proposals",
  editSystemPrompt: "Edit the system prompt",
  flagPermanentFix: "Flag an edit as a permanent fix",
  manageUsers: "Manage users",
};

export const EMPTY_PERMS = {
  tabs: ["lookup"],
  approveProposals: false,
  editSystemPrompt: false,
  flagPermanentFix: false,
  manageUsers: false,
};
