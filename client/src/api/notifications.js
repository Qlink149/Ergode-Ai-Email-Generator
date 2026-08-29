/**
 * api/notifications.js
 * ---------------------
 * The header bell's unread summary - see server/routes/notifications.js.
 */

import { cachedGet } from "./client.js";

/** Unread counts for the header's notification bell - pending proposals + unseen escalations. */
export async function fetchNotificationsSummary() {
  // Dedupe only (no TTL) - the bell polls this on its own schedule and
  // wants fresh counts each time; this just collapses the StrictMode
  // double-mount into one request.
  return cachedGet("/api/notifications");
}
