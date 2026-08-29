import { useState } from "react";
import { MessageSquareWarning, X } from "lucide-react";
import { overrideEscalation } from "../../api.js";
import { useAuth, can } from "../../auth.js";
import EscalationBadge from "../../components/EscalationBadge.jsx";
import { CaseDetail } from "./SharedBits.jsx";
import { formatTimestamp } from "./constants.js";

/**
 * EscalationPanel.jsx
 * --------------------
 * Everything for the "Everything Else Reviewed" section: the compact stat
 * column, one row of the escalations list, the override form (disagreeing
 * with a verdict drafts a real proposal), and the detail panel.
 */

/**
 * Compact stat column - same visual language as StatBarItem, no delta
 * (escalations aren't tracked week over week the same way). Clickable when
 * onClick is given, doubling as a filter for the list below - active
 * state shown via a tinted background + bottom accent bar, same idea as
 * the filter-tab pills elsewhere on this page.
 */
export function EscalationStatBarItem({ meta, label, value, onClick, active, caption }) {
  const Icon = meta.icon;
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className="min-w-[140px] flex-1 p-3 text-left transition-colors disabled:cursor-default"
      style={{
        background: active ? meta.bg : "transparent",
        cursor: clickable ? "pointer" : "default",
        borderBottom: active ? `2px solid ${meta.color}` : "2px solid transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: meta.bg, color: meta.color }}>
          <Icon size={13} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-semibold leading-none font-display">{value}</p>
      {caption && <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{caption}</p>}
    </button>
  );
}

function OverrideForm({ escalation, onCreated }) {
  const { me } = useAuth();
  // Logging in already says who this is - no separate "type your name"
  // prompt, same as EditableDraft.jsx's Edit/Comment forms.
  const myName = me?.name || me?.email || "unknown";
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await overrideEscalation(escalation._id, note.trim(), myName);
      setNote("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (escalation.overridden_proposal_id) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[var(--violet)]">
        <MessageSquareWarning size={13} />
        Overridden — a prompt-fix proposal was drafted from this, see the Proposals dashboard above.
      </p>
    );
  }

  if (!can(me, "approveProposals")) return null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="brand-button-ghost px-3 py-1.5 text-xs">
        <MessageSquareWarning size={13} />
        Disagree with this — draft a fix anyway
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-[rgb(var(--violet-rgb)/0.18)] bg-[rgb(var(--violet-rgb)/0.04)] p-3">
      <p className="text-xs text-[var(--muted)]">
        Explain why the AI's call above is wrong - e.g. "that's not actually already covered, the existing rule
        only applies to X" or "the contradiction is fine, replace the old rule with this instead." Your note goes
        straight to drafting a real fix.
      </p>
      <textarea
        className="brand-input w-full rounded-lg px-3 py-2 text-sm"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why this needs a fix, and what it should say"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !note.trim()}
          className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Drafting..." : "Draft a fix from this"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="brand-button-ghost px-3 py-2 text-xs">
          Close
        </button>
      </div>
      {error && <p className="text-xs text-[var(--executive-error)]">{error}</p>}
    </form>
  );
}


export function EscalationDetailPanel({ escalation, onOverrideCreated, onClose }) {
  return (
    <div className="executive-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EscalationBadge type={escalation.type} />
          <p className="mt-1.5 text-sm leading-relaxed">{escalation.reason}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {escalation.author} · order {escalation.order_id || "—"} · {formatTimestamp(escalation.created_at)}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <CaseDetail record={escalation} />

      {escalation.notify?.length > 0 && (
        <p className="text-xs text-[var(--muted)]">
          Notify: {escalation.notify.map((n) => (n === "clara" ? "Clara" : "Ergode")).join(", ")}
        </p>
      )}

      <div className="border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
        <OverrideForm escalation={escalation} onCreated={onOverrideCreated} />
      </div>
    </div>
  );
}
