/**
 * api/escalations.js
 * ------------------
 * Code/data-restriction escalations from the triage agent - the
 * "Everything Else Reviewed" section. See server/routes/escalations.js.
 */

import { apiFetch, cachedGet, invalidateCache, invalidateTriageViews } from "./client.js";

/**
 * One page of code/data-restriction escalations from the triage agent.
 * Pass status ("unseen") and/or type ("none"/"code_restriction"/
 * "data_restriction") to filter, or triggerType ("draft_edit") for the
 * "Permanent Edit" filter. Returns {escalations, total, page, limit}.
 */
export async function fetchEscalations(status, { page = 1, limit = 200, type, triggerType } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (triggerType) params.set("trigger_type", triggerType);
  return cachedGet(`/api/escalations?${params.toString()}`);
}

/** Counts by type for EscalationSection's stat bar, computed by MongoDB. */
export async function fetchEscalationStats() {
  return cachedGet("/api/escalations/stats");
}

/** Marks a batch of escalations as seen - called once the Escalations section is actually viewed. */
export async function markEscalationsSeen(ids) {
  const result = await apiFetch("/api/escalations/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  invalidateCache("/api/escalations");
  invalidateCache("/api/notifications");
  return result;
}

/** Disagrees with a triage verdict - drafts a real prompt-fix proposal from a human note, added to the same pending queue (still needs its own Approve). */
export async function overrideEscalation(id, note, author) {
  const result = await apiFetch(`/api/escalations/${id}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note, author }),
  });
  invalidateTriageViews();
  return result;
}
