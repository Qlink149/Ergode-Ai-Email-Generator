import { useEffect, useState } from "react";
import { Pencil, Check, MessageSquarePlus } from "lucide-react";
import { saveDraftEdit, postComment } from "../api.js";
import { useAuth, can } from "../auth.js";

// The system prompt's MANDATORY OUTPUT FORMAT rule (draft_generator.py) makes
// the model return "<reply>\n=====\n<same reply in English>" whenever the
// reply itself isn't in English, so a reviewer who doesn't read that
// language can still approve it. Split that apart for display instead of
// showing the raw "=====" separator as if it were part of the email.
const BILINGUAL_SEPARATOR = /\n=+\n/;

function splitBilingualDraft(text) {
  const parts = text.split(BILINGUAL_SEPARATOR);
  if (parts.length !== 2) return { reply: text, translation: null };
  return { reply: parts[0].trim(), translation: parts[1].trim() };
}

/**
 * The AI's draft, editable in place. "Edit" swaps to a textarea seeded
 * with the current text; "Save" writes the edit back to ai_drafts
 * (draft_store.py) against this exact thread/seq, alongside the AI's
 * original draft_reply, which is never overwritten.
 *
 * "Comment" sits next to Edit for the same reason - it's posted against
 * orderId + this exact seq, along with a snapshot of customerMessage, the
 * current draft text, and aiContext (the same order facts/thread
 * history/reasoning AiContextPanel.jsx shows) (see server/routes/comments.js),
 * so the history in CommentsSidebar.jsx is self-contained: whoever reads a
 * comment later sees exactly what the customer said, what the AI replied,
 * and why - without having to regenerate the draft or re-look-up the order.
 *
 * Neither form asks who's doing this - that's already known from the login
 * (useAuth()'s `me.name`, or "Admin" for the shared login), so it's sent
 * straight through as the author on both an edit and a comment.
 *
 * Used by OrderLookupPage.jsx.
 */
export default function EditableDraft({ orderId, threadId, seq, draftReply, customerMessage, aiContext }) {
  const { me } = useAuth();
  const canFlagPermanentFix = can(me, "flagPermanentFix");
  // Logging in already says who this is - a named user's own name, or
  // "Admin" for the shared login. No separate "type your name" prompt
  // needed anywhere in this component anymore.
  const myName = me?.name || me?.email || "unknown";

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draftReply);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permanentFix, setPermanentFix] = useState(false);
  const [sentForReview, setSentForReview] = useState(false);

  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentPosted, setCommentPosted] = useState(false);
  const [commentError, setCommentError] = useState(null);

  useEffect(() => {
    setText(draftReply);
    setEditing(false);
    setSaved(false);
    setPermanentFix(false);
    setSentForReview(false);
    setCommenting(false);
    setCommentText("");
    setCommentPosted(false);
    setCommentError(null);
  }, [threadId, seq, draftReply]);

  const wantsReview = canFlagPermanentFix && permanentFix;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveDraftEdit({
        threadId,
        seq,
        editedReply: text,
        permanentFix: wantsReview,
        author: myName,
      });
      setSaved(true);
      setSentForReview(Boolean(result.permanent_fix_applied));
      setEditing(false);
    } catch {
      // Best-effort - the edited text stays visible either way.
    } finally {
      setSaving(false);
    }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const { reply } = splitBilingualDraft(text);
      await postComment({
        orderId,
        author: myName,
        text: commentText.trim(),
        seq,
        customerMessage,
        aiReply: reply,
        aiContext,
      });
      setCommentText("");
      setCommentPosted(true);
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setCommentSubmitting(false);
    }
  }

  return (
    <div className="executive-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          What our AI generated{saved && (sentForReview ? " (edited · sent for review)" : " (edited)")}
        </h3>
        {!editing && !commenting && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
              className="brand-button-ghost px-3 py-1 text-xs"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={() => {
                setCommenting(true);
                setCommentPosted(false);
              }}
              className="brand-button-ghost px-3 py-1 text-xs"
            >
              <MessageSquarePlus size={12} />
              Comment
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="brand-input w-full rounded-lg px-3 py-2 text-sm leading-relaxed"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {canFlagPermanentFix && (
            <label className="flex items-start gap-2 rounded-lg border border-[rgb(var(--violet-rgb)/0.2)] bg-[rgb(var(--violet-rgb)/0.04)] p-2.5 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={permanentFix}
                onChange={(e) => setPermanentFix(e.target.checked)}
              />
              <span>
                <span className="font-semibold">This is a permanent fix.</span> Send it for review so it can
                improve future AI replies. Leave unchecked to just save this one reply.
              </span>
            </label>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={13} />
            {saving ? "Saving..." : wantsReview ? "Save & send for review" : "Save edit"}
          </button>
        </div>
      ) : (
        (() => {
          const { reply, translation } = splitBilingualDraft(text);
          return (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply}</p>
              {translation && (
                <div className="mt-3 rounded-lg border border-[rgb(var(--violet-rgb)/0.15)] bg-[rgb(var(--violet-rgb)/0.04)] p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--violet)]">
                    English translation
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{translation}</p>
                </div>
              )}
            </>
          );
        })()
      )}

      {commenting && (
        <form onSubmit={handlePostComment} className="mt-4 space-y-2 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-4">
          <textarea
            className="brand-input w-full rounded-lg px-3 py-2 text-sm"
            rows={2}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="What should change about this reply?"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquarePlus size={13} />
              {commentSubmitting ? "Posting..." : "Post Comment"}
            </button>
            <button
              type="button"
              onClick={() => setCommenting(false)}
              className="brand-button-ghost px-3 py-2 text-xs"
            >
              Close
            </button>
          </div>
          {commentPosted && <p className="text-xs text-[var(--muted)]">Comment posted.</p>}
          {commentError && <p className="text-xs text-[var(--executive-error)]">{commentError}</p>}
        </form>
      )}
    </div>
  );
}
