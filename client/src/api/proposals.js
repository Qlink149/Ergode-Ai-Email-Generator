/**
 * api/proposals.js
 * ----------------
 * Prompt-fix proposals - the Pending Approvals dashboard's top half. See
 * server/routes/proposals.js.
 */

import { apiFetch, cachedGet, invalidateCache, invalidateTriageViews } from "./client.js";

/** Applies a proposal's full proposed text as the new live system-prompt version. */
export async function approveProposal(id) {
  const result = await apiFetch(`/api/proposals/${id}/approve`, { method: "POST" });
  invalidateTriageViews();
  invalidateCache("/api/system-prompt"); // an approve creates a new prompt version
  return result;
}

/** Discards a proposal - the live system prompt is left untouched. */
export async function rejectProposal(id) {
  const result = await apiFetch(`/api/proposals/${id}/reject`, { method: "POST" });
  invalidateTriageViews();
  return result;
}

/**
 * One page of proposals regardless of outcome (approved/rejected/
 * already_covered/needs_manual_review), for the history view. Returns
 * {proposals, total, page, limit} - `total` is the REAL total count (from
 * MongoDB), not proposals.length, since proposals is just this one page.
 */
export async function fetchProposalHistory(status, { page = 1, limit = 200 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  return cachedGet(`/api/proposals/history?${params.toString()}`);
}

/** Bucket + week-over-week counts for the stat cards/donut/filter-tab counts, computed by MongoDB - not by downloading every proposal and reducing it in the browser. */
export async function fetchProposalStats() {
  return cachedGet("/api/proposals/stats");
}
