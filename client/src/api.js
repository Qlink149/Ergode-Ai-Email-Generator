/**
 * api.js
 * ------
 * Thin re-export shim. The actual API surface lives in api/*.js, split by
 * resource (client.js, account.js, users.js, orders.js, comments.js,
 * systemPrompt.js, notifications.js, proposals.js, escalations.js) - this
 * file stayed a single ~400-line file for long enough that it was the
 * biggest file in the client, so it got split. Every existing
 * `import { x } from "../api.js"` elsewhere in the app is unaffected;
 * new code can import straight from "./api/index.js" (or a specific
 * resource file) instead.
 */
export * from "./api/index.js";
