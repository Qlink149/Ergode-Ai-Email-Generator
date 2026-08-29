/**
 * api/systemPrompt.js
 * -------------------
 * The live system prompt + its version history - see
 * server/routes/systemPrompt.js.
 */

import { apiFetch, cachedGet, invalidateCache } from "./client.js";

/** Rarely changes; 5-min TTL so switching to this tab and back is instant. saveSystemPrompt() invalidates it. */
export async function fetchSystemPrompt() {
  return cachedGet("/api/system-prompt", 5 * 60 * 1000);
}

export async function saveSystemPrompt(content) {
  const result = await apiFetch("/api/system-prompt", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  invalidateCache("/api/system-prompt"); // both the prompt itself and its version list
  return result;
}

/** Every past system-prompt version, newest first, PREVIEW TEXT ONLY (content_preview/content_length, not the full content) - see fetchSystemPromptVersionContent for the full text of one version. */
export async function fetchSystemPromptVersions() {
  return cachedGet("/api/system-prompt/versions", 5 * 60 * 1000);
}

/** One version's full text - call only when a History card is expanded or right before Restore, never for the list. */
export async function fetchSystemPromptVersionContent(versionId) {
  return apiFetch(`/api/system-prompt/versions/${versionId}`);
}
