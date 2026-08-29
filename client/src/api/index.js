/**
 * api/index.js
 * ------------
 * Barrel re-export - every api/*.js file split out by resource, back
 * together as one surface. `client/src/api.js` re-exports this, so every
 * existing `import { x } from "../api.js"` elsewhere in the app keeps
 * working unchanged; new code can import from "./api/index.js" (or the
 * specific resource file) directly.
 */

export * from "./client.js";
export * from "./account.js";
export * from "./users.js";
export * from "./orders.js";
export * from "./comments.js";
export * from "./systemPrompt.js";
export * from "./notifications.js";
export * from "./proposals.js";
export * from "./escalations.js";
