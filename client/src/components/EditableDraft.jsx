import { useEffect, useState } from "react";
import { Pencil, Check } from "lucide-react";
import { saveDraftEdit } from "../api.js";

/**
 * The AI's draft, editable in place. "Edit" swaps to a textarea seeded
 * with the current text; "Save" writes the edit back to ai_drafts
 * (draft_store.py) against this exact thread/seq, alongside the AI's
 * original draft_reply, which is never overwritten.
 * Shared by TicketDetail.jsx and OrderLookupPage.jsx.
 */
export default function EditableDraft({ threadId, seq, draftReply }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draftReply);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(draftReply);
    setEditing(false);
    setSaved(false);
  }, [threadId, seq, draftReply]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveDraftEdit({ threadId, seq, editedReply: text });
      setSaved(true);
      setEditing(false);
    } catch {
      // Best-effort - the edited text stays visible either way.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="executive-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          What our AI generated{saved && " (edited)"}
        </h3>
        {!editing && (
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={13} />
            {saving ? "Saving..." : "Save edit"}
          </button>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      )}
    </div>
  );
}
