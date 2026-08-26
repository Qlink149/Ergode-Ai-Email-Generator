import { CheckCircle2, AlertTriangle, Sparkles, Eye, CheckCheck, XCircle, ShieldAlert, ChevronRight } from "lucide-react";
import { AuthorAvatar } from "./SharedBits.jsx";
import { formatTimestamp } from "./constants.js";

/**
 * EscalationTable.jsx
 * ---------------------
 * A proper table for "Everything Else Reviewed" - Proposal / AI Finding /
 * Status / Updated columns, replacing the card-style row list. The STATUS
 * column tells the real end-to-end story of one piece of feedback, not
 * just the escalation's own status field:
 *
 *   - never opened yet                              -> New
 *   - opened, nobody disagreed with the AI's verdict -> Reviewed
 *   - a human overrode it, that fix is still pending -> In Review
 *   - the override's fix was approved (now live)     -> Implemented
 *   - the override's fix was rejected                -> Rejected
 *   - the override's fix needs manual attention       -> Needs Attention
 *
 * That needs looking up the escalation's overridden_proposal_id against
 * the already-fetched proposals list (proposalsById, built once in
 * PendingApprovalsPage.jsx) - no extra request, since the page already
 * has both lists in memory.
 */

const AI_FINDING_META = {
  none: { label: "No Gap Found", icon: CheckCircle2, color: "var(--royal)" },
  code_restriction: { label: "Gap Found", icon: AlertTriangle, color: "var(--executive-error)" },
  data_restriction: { label: "Gap Found", icon: AlertTriangle, color: "var(--executive-error)" },
};

const PROPOSAL_STATUS_TO_ESCALATION_STATUS = {
  pending: { label: "In Review", icon: Eye, color: "var(--royal)", bg: "rgb(var(--royal-rgb)/0.1)" },
  approved: { label: "Implemented", icon: CheckCheck, color: "var(--executive-success)", bg: "rgb(var(--success-rgb)/0.12)" },
  rejected: { label: "Rejected", icon: XCircle, color: "var(--executive-error)", bg: "rgb(var(--danger-rgb)/0.12)" },
  already_covered: { label: "Needs Attention", icon: ShieldAlert, color: "var(--warning)", bg: "rgb(var(--warning-rgb)/0.14)" },
  needs_manual_review: { label: "Needs Attention", icon: ShieldAlert, color: "var(--warning)", bg: "rgb(var(--warning-rgb)/0.14)" },
};

function deriveStatus(escalation, proposalsById) {
  if (escalation.overridden_proposal_id) {
    const proposal = proposalsById.get(escalation.overridden_proposal_id);
    if (proposal) return PROPOSAL_STATUS_TO_ESCALATION_STATUS[proposal.status];
  }
  if (escalation.status === "unseen") {
    return { label: "New", icon: Sparkles, color: "var(--violet)", bg: "rgb(var(--violet-rgb)/0.12)" };
  }
  return { label: "Reviewed", icon: CheckCircle2, color: "var(--muted)", bg: "rgb(var(--navy-rgb)/0.05)" };
}

export function EscalationTableHeader() {
  return (
    <div className="hidden items-center gap-3 border-b border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] lg:flex">
      <span className="min-w-0 flex-1">Feedback</span>
      <span className="w-36 shrink-0">AI Finding</span>
      <span className="w-32 shrink-0">Status</span>
      <span className="w-40 shrink-0">Updated</span>
      <span className="w-4 shrink-0" />
    </div>
  );
}

export function EscalationTableRow({ escalation, selected, onSelect, proposalsById }) {
  const finding = AI_FINDING_META[escalation.type] || AI_FINDING_META.none;
  const FindingIcon = finding.icon;
  const status = deriveStatus(escalation, proposalsById);
  const StatusIcon = status.icon;

  return (
    <button
      onClick={() => onSelect(escalation._id)}
      className={`flex w-full min-w-0 items-center gap-3 border-b border-[rgb(var(--navy-rgb)/0.06)] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--navy-rgb)/0.03)] ${
        selected ? "bg-[rgb(var(--violet-rgb)/0.07)]" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AuthorAvatar name={escalation.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">{escalation.author}</span>
            <span className="text-xs text-[var(--muted)]">· order {escalation.order_id || "—"}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{escalation.reason}</p>
        </div>
      </div>

      <span className="flex w-36 shrink-0 items-center gap-1.5 text-xs font-medium" style={{ color: finding.color }}>
        <FindingIcon size={13} />
        {finding.label}
      </span>

      <span
        className="flex w-32 shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold"
        style={{ background: status.bg, color: status.color }}
      >
        <StatusIcon size={12} />
        {status.label}
      </span>

      <span className="hidden w-40 shrink-0 text-xs text-[var(--muted)] lg:block">
        {formatTimestamp(escalation.created_at)}
        <br />
        by {escalation.author}
      </span>

      <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" />
    </button>
  );
}
