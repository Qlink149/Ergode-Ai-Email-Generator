import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquareText } from "lucide-react";
import { fetchRecentComments } from "../api.js";

/**
 * CommentsSidebar.jsx
 * --------------------
 * Slide-in panel from the right, opened by the "Comments" button next to
 * the order search bar on OrderLookupPage.jsx. Read-only history of every
 * comment ever left, across every order, newest first. Posting a new
 * comment happens from EditableDraft.jsx's "Comment" button instead,
 * right next to "Edit" on a generated draft - which is also where a
 * comment's customer-message/AI-reply snapshot comes from, so each card
 * here is self-contained (no need to regenerate a draft or re-look-up the
 * order to see what a comment was about).
 *
 * Rendered via a portal straight into document.body: AppShell.jsx's <main>
 * has "relative z-10", which establishes its own stacking context - a
 * z-50 element nested inside main only ever ranks against other things
 * inside that z-10 context, so it can never outrank the sticky header's
 * z-50 at the root. A portal escapes that entirely instead of needing an
 * ever-higher z-index that still wouldn't fix it.
 */

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function SnapshotBlock({ label, text, tone }) {
  if (!text) return null;
  const toneClasses =
    tone === "violet"
      ? "border-[rgb(var(--violet-rgb)/0.18)] bg-[rgb(var(--violet-rgb)/0.05)]"
      : "border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)]";
  const labelClass = tone === "violet" ? "text-[var(--violet)]" : "text-[var(--muted)]";

  return (
    <div className={`min-w-0 rounded-lg border p-2.5 ${toneClasses}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export default function CommentsSidebar({ isOpen, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetchRecentComments()
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-[rgb(var(--navy-rgb)/0.08)]">
          <div className="panel-blob" />
          <div className="relative z-10 flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
              >
                <MessageSquareText size={17} />
              </span>
              <div>
                <h3 className="text-base font-semibold leading-tight">Comments</h3>
                <p className="text-xs text-[var(--muted)]">Every comment left across every order</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="executive-card-soft mb-3 p-4 text-sm text-[var(--executive-error)]">{error}</div>
          )}

          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No comments have been left yet.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c._id || `${c.order_id}-${c.created_at}`} className="executive-card space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold">{c.author}</span>
                      <span className="text-[var(--muted)]">on order</span>
                      <span className="font-semibold">{c.order_id}</span>
                    </div>
                    <span className="text-xs text-[var(--muted)]">{formatTimestamp(c.created_at)}</span>
                  </div>

                  {(c.customer_message || c.ai_reply) && (
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      <SnapshotBlock label="Customer said" text={c.customer_message} />
                      <SnapshotBlock label="AI replied" text={c.ai_reply} tone="violet" />
                    </div>
                  )}

                  <div className="min-w-0 rounded-lg border border-[rgb(var(--royal-rgb)/0.16)] bg-[rgb(var(--royal-rgb)/0.05)] p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--royal-rgb)/1)]">
                      {c.author}'s comment
                    </p>
                    <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
