/**
 * services/rawEmailReader.js
 * ----------------------------
 * Reads the raw, original Amazon-branded HTML email bodies out of
 * email_bodyies/<thread_id>.html - not from a live API, just files already
 * on disk. Each file is a hand-generated dump of the whole thread's
 * messages (message_in = raw Amazon notification HTML, message_out = our
 * own plain-HTML reply), one after another. This is display-only: it
 * feeds the UI's "original message" view, never the AI.
 *
 * Message ordering in the file (data-index, 1-based) lines up with our own
 * message.seq for the same thread - both come from the same underlying
 * chronological export.
 */

const fs = require("fs");
const path = require("path");

const EMAIL_BODIES_DIR = path.join(__dirname, "..", "..", "email_bodyies");

// thread_id is a route param that ends up in a file path below - only
// digits are ever valid here, so reject anything else outright rather
// than letting something like "../../.env" resolve outside the folder.
const VALID_THREAD_ID = /^\d+$/;

const BLOCK_RE =
  /<div class="email-message" data-index="(\d+)" data-type="([^"]+)" data-id="(\d+)">\s*<div class="message-header">[\s\S]*?<\/div>\s*<div class="message-body">([\s\S]*?)(?=<div class="email-message"|$)/g;

/** Returns [{index, type, id, html}] for a thread, or null if no file is on disk for it. */
function readRawMessages(threadId) {
  if (!VALID_THREAD_ID.test(threadId)) return null;

  const filePath = path.join(EMAIL_BODIES_DIR, `${threadId}.html`);
  if (!fs.existsSync(filePath)) return null;

  const html = fs.readFileSync(filePath, "utf-8");
  const messages = [];
  let match;
  BLOCK_RE.lastIndex = 0;
  while ((match = BLOCK_RE.exec(html))) {
    messages.push({
      index: Number(match[1]),
      type: match[2],
      id: match[3],
      html: match[4].trim(),
    });
  }
  return messages;
}

module.exports = { readRawMessages };
