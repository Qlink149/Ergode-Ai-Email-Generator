import { useEffect, useState } from "react";
import { Check, X, CheckCircle2, ArrowDown, FileSearch, Quote } from "lucide-react";
import { approveProposal, rejectProposal } from "../../api.js";
import { SectionHeading, CaseDetail } from "./SharedBits.jsx";
import {
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  TRIGGER_TYPE_LABEL,
  DETAIL_TABS,
  CURRENT_VALUE_TINT,
  PROPOSED_CHANGE_TINT,
  finalDecisionMeta,
  shortId,
  formatTimestamp,
} from "./constants.js";

/** One rounded, tinted card per step - icon badge + label + value, connected by a short dashed line. Matches the reference "Change Flow" stepper exactly. */
function ChangeFlowStep({ label, text, tint, isLast }) {
  const Icon = tint.icon;
  return (
    <div>
      <div className="flex items-start gap-3 rounded-lg p-3" style={{ background: tint.bg }}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: tint.iconBg, color: tint.iconFg }}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: tint.iconFg }}>
            {label}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">{text}</p>
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-start pl-[19px]">
          <div className="h-3 border-l border-dashed" style={{ borderColor: "rgb(var(--navy-rgb)/0.2)" }} />
        </div>
      )}
    </div>
  );
}

/**
 * ProposalDetailPanel.jsx
 * ------------------------
 * The right-hand panel shown when a proposal row is selected - a 3-tab
 * view (Overview / Context / Timeline) plus the Approve/Reject buttons
 * that only appear while the proposal is still pending.
 */
export default function ProposalDetailPanel({ proposal, onDecided, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    setError(null);
    setMessage(null);
    setTab("overview");
  }, [proposal?._id]);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      const result = await approveProposal(proposal._id);
      if (result.status === "already_covered") {
        setMessage(`Already covered by the live prompt — nothing changed. ${result.note || ""}`);
      } else if (result.status === "needs_manual_review") {
        setMessage(`Not applied automatically — ${result.note || "the merge looked unsafe."}`);
      } else {
        setMessage("Approved — now live.");
      }
      onDecided();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      await rejectProposal(proposal._id);
      setMessage("Rejected.");
      onDecided();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const decision = finalDecisionMeta(proposal);

  return (
    <div className="executive-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--muted)]">{shortId(proposal._id)}</span>
            <span className={`pill ${STATUS_PILL_CLASS[proposal.status]}`}>{STATUS_LABEL[proposal.status]}</span>
            {proposal.trigger_type === "override" && <span className="pill pill-neutral">From an override</span>}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{proposal.reason}</p>
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

      <div className="flex gap-1 border-b border-[rgb(var(--navy-rgb)/0.08)]">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-xs font-semibold transition-colors"
            style={
              tab === t.id
                ? { borderBottom: "2px solid rgb(var(--royal-rgb)/1)", color: "rgb(var(--royal-rgb)/1)" }
                : { borderBottom: "2px solid transparent", color: "var(--muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <SectionHeading icon={ArrowDown} title="Change Flow" tint={{ background: "rgb(var(--success-rgb)/0.12)", color: "var(--executive-success)" }} />
            <div className="pl-1 pt-2">
              <ChangeFlowStep
                label={proposal.edit_type === "replace" ? "Current Value" : "Existing Text (fix goes right after)"}
                text={proposal.anchor_text}
                tint={CURRENT_VALUE_TINT}
              />
              <ChangeFlowStep
                label={proposal.edit_type === "replace" ? "Proposed Change" : "New Text Added"}
                text={proposal.new_text}
                tint={PROPOSED_CHANGE_TINT}
              />
              <ChangeFlowStep label="Final Decision" text={decision.text} tint={decision.tint} isLast />
            </div>
          </div>

          <div className="space-y-1.5">
            <SectionHeading icon={FileSearch} title="Details" />
            <div className="space-y-1.5 rounded-lg border border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] p-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Type</span>
                <span className="font-medium">{TRIGGER_TYPE_LABEL[proposal.trigger_type] || "Comment"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Created By</span>
                <span className="font-medium">{proposal.author}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Created On</span>
                <span className="font-medium">{formatTimestamp(proposal.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Order</span>
                <span className="font-medium">{proposal.order_id || "—"}</span>
              </div>
            </div>
          </div>

          {proposal.contradiction_check && (
            <div className="min-w-0 rounded-lg border border-[rgb(var(--royal-rgb)/0.16)] bg-[rgb(var(--royal-rgb)/0.05)] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--royal-rgb)/1)]">
                Contradiction check
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{proposal.contradiction_check}</p>
            </div>
          )}

          {proposal.trigger_type === "override" && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Reason for Override</p>
              <div className="rounded-lg p-3" style={{ background: "rgb(var(--violet-rgb)/0.06)" }}>
                <Quote size={14} style={{ color: "var(--violet)" }} />
                <p className="mt-1 whitespace-pre-wrap break-words text-sm italic leading-relaxed text-[var(--muted)]">
                  {proposal.source_text}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "context" && (
        <div className="space-y-4">
          <CaseDetail record={proposal} />
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-2">
          <ol className="space-y-3 border-l-2 border-[rgb(var(--navy-rgb)/0.1)] pl-3">
            <li>
              <p className="text-sm font-semibold">Created</p>
              <p className="text-xs text-[var(--muted)]">{formatTimestamp(proposal.created_at)} · triage agent drafted this fix</p>
            </li>
            {proposal.status === "pending" ? (
              <li>
                <p className="text-sm font-semibold text-[var(--muted)]">Awaiting decision</p>
              </li>
            ) : (
              <li>
                <p className="text-sm font-semibold">{STATUS_LABEL[proposal.status]}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatTimestamp(proposal.reviewed_at)}
                  {proposal.status === "approved" && proposal.reviewed_outcome_version != null
                    ? ` · went live as system prompt version ${proposal.reviewed_outcome_version}`
                    : ""}
                </p>
                {proposal.recheck_note && <p className="mt-1 text-xs text-[var(--muted)]">{proposal.recheck_note}</p>}
              </li>
            )}
          </ol>
        </div>
      )}

      {proposal.status === "pending" && (
        <div className="flex items-center gap-2 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="brand-button-success flex-1 justify-center px-4 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={13} />
            {busy ? "Working..." : "Approve Proposal"}
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="brand-button-danger flex-1 justify-center px-4 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={13} />
            Reject
          </button>
        </div>
      )}

      {message && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--executive-success)]">
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
      {error && <p className="text-sm text-[var(--executive-error)]">{error}</p>}
    </div>
  );
}
