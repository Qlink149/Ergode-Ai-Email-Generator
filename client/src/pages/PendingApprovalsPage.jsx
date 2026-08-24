import { useEffect, useState } from "react";
import {
  ListChecks,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import {
  fetchPendingProposals,
  approveProposal,
  rejectProposal,
  fetchEscalations,
  markEscalationsSeen,
} from "../api.js";
import EscalationBadge from "../components/EscalationBadge.jsx";

/**
 * PendingApprovalsPage.jsx
 * --------------------------
 * The human side of the triage-agent loop (see pipeline/triage_agent.py):
 * every Comment or Draft Edit is classified automatically, but nothing
 * ever reaches the live system prompt without a person reviewing it here
 * and clicking Approve. Escalations (code/data gaps) have nothing to
 * approve - they're read-only, just acknowledged by viewing them, which
 * marks them seen and clears the header's notification count.
 */

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ProposalCard({ proposal, index, onDecided }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      const result = await approveProposal(proposal._id);
      let message;
      let kind = "success";
      if (result.status === "already_covered") {
        message = `Already covered by the live prompt — nothing changed. ${result.note || ""}`;
        kind = "info";
      } else if (result.status === "needs_manual_review") {
        message = `Not applied automatically — ${result.note || "the merge looked unsafe. Apply this by hand in the System Prompt editor."}`;
        kind = "warning";
      } else {
        message = "Approved — now live.";
      }
      onDecided(proposal._id, message, kind);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      await rejectProposal(proposal._id);
      onDecided(proposal._id, "Rejected.", "neutral");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div
      className="triage-item-in executive-card space-y-3 p-4"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full min-w-0 items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          {expanded ? (
            <ChevronDown size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" />
          ) : (
            <ChevronRight size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">{proposal.author}</span>
              <span className="text-[var(--muted)]">on order</span>
              <span className="font-semibold">{proposal.order_id || "—"}</span>
            </div>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{proposal.reason}</p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-[var(--muted)]">
          {formatTimestamp(proposal.created_at)}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
          <div className="min-w-0 rounded-lg border border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {proposal.trigger_type === "draft_edit" ? "Draft was rewritten to" : "Comment"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {proposal.source_text}
            </p>
          </div>

          {proposal.contradiction_check && (
            <div className="min-w-0 rounded-lg border border-[rgb(var(--royal-rgb)/0.16)] bg-[rgb(var(--royal-rgb)/0.05)] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--royal-rgb)/1)]">
                Contradiction check
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {proposal.contradiction_check}
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <span className="pill pill-neutral">
                {proposal.edit_type === "replace" ? "Replaces this existing text" : "Inserted right after this existing text"}
              </span>
            </p>
            <pre className="brand-input max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg px-3 py-2 font-mono text-xs leading-relaxed text-[var(--muted)]">
              {proposal.anchor_text}
            </pre>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--executive-success)]">
              {proposal.edit_type === "replace" ? "New wording" : "New text being added"}
            </p>
            <pre className="brand-input max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border-[rgb(var(--success-rgb)/0.3)] px-3 py-2 font-mono text-xs leading-relaxed">
              {proposal.new_text}
            </pre>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={busy}
              className="brand-button-success px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={13} />
              {busy ? "Working..." : "Approve"}
            </button>
            <button
              onClick={handleReject}
              disabled={busy}
              className="brand-button-danger px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={13} />
              Reject
            </button>
            {error && <span className="text-xs text-[var(--executive-error)]">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function EscalationCard({ escalation, index }) {
  return (
    <div
      className="triage-item-in executive-card-soft space-y-2 p-4"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <EscalationBadge type={escalation.type} />
          <span className="font-semibold">{escalation.author}</span>
          <span className="text-[var(--muted)]">on order</span>
          <span className="font-semibold">{escalation.order_id || "—"}</span>
        </div>
        <span className="text-xs text-[var(--muted)]">{formatTimestamp(escalation.created_at)}</span>
      </div>
      <p className="text-sm leading-relaxed">{escalation.reason}</p>
      {escalation.notify?.length > 0 && (
        <p className="text-xs text-[var(--muted)]">
          Notify: {escalation.notify.map((n) => (n === "clara" ? "Clara" : "Ergode")).join(", ")}
        </p>
      )}
    </div>
  );
}

export default function PendingApprovalsPage() {
  const [proposals, setProposals] = useState([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState(null);
  const [justDecided, setJustDecided] = useState(null);

  const [escalations, setEscalations] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(true);
  const [escalationsError, setEscalationsError] = useState(null);

  useEffect(() => {
    fetchPendingProposals()
      .then((data) => setProposals(data.proposals))
      .catch((err) => setProposalsError(err.message))
      .finally(() => setProposalsLoading(false));
  }, []);

  useEffect(() => {
    fetchEscalations()
      .then((data) => {
        setEscalations(data.escalations);
        const unseenIds = data.escalations.filter((e) => e.status === "unseen").map((e) => e._id);
        if (unseenIds.length > 0) markEscalationsSeen(unseenIds).catch(() => {});
      })
      .catch((err) => setEscalationsError(err.message))
      .finally(() => setEscalationsLoading(false));
  }, []);

  function handleDecided(proposalId, message, kind = "success") {
    setProposals((prev) => prev.filter((p) => p._id !== proposalId));
    setJustDecided({ message: message || "Decision saved.", kind });
    setTimeout(() => setJustDecided(null), kind === "warning" ? 8000 : 5000);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
        >
          <ListChecks size={18} />
        </span>
        <h2 className="text-xl font-semibold leading-tight">Pending Approvals</h2>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Prompt Fix Proposals
        </h3>

        {proposalsError && (
          <div className="executive-card-soft flex items-center gap-2 p-4 text-sm text-[var(--executive-error)]">
            <AlertCircle size={16} />
            {proposalsError}
          </div>
        )}

        {proposalsLoading ? (
          <div className="executive-card space-y-3 p-5">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-[rgb(var(--navy-rgb)/0.08)]" />
            <div className="h-16 w-full animate-pulse rounded-lg bg-[rgb(var(--navy-rgb)/0.05)]" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="executive-card-soft flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
            <Inbox size={22} />
            No prompt fixes are waiting for review right now.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p, i) => (
              <ProposalCard key={p._id} proposal={p} index={i} onDecided={handleDecided} />
            ))}
          </div>
        )}

        {justDecided && (
          <p
            className="flex items-center gap-1.5 text-sm"
            style={{
              color:
                justDecided.kind === "warning"
                  ? "var(--warning)"
                  : justDecided.kind === "neutral"
                    ? "var(--muted)"
                    : "var(--executive-success)",
            }}
          >
            {justDecided.kind === "warning" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {justDecided.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Everything Else Reviewed
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Every comment/edit the AI didn't turn into a prompt fix - a code or data gap to route to a
            team, or genuinely nothing actionable. Nothing is ever hidden, only prompt fixes need a
            decision.
          </p>
        </div>

        {escalationsError && (
          <div className="executive-card-soft flex items-center gap-2 p-4 text-sm text-[var(--executive-error)]">
            <AlertCircle size={16} />
            {escalationsError}
          </div>
        )}

        {escalationsLoading ? (
          <div className="executive-card space-y-3 p-5">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-[rgb(var(--navy-rgb)/0.08)]" />
            <div className="h-16 w-full animate-pulse rounded-lg bg-[rgb(var(--navy-rgb)/0.05)]" />
          </div>
        ) : escalations.length === 0 ? (
          <div className="executive-card-soft flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
            <Inbox size={22} />
            Nothing has been reviewed yet.
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.map((e, i) => (
              <EscalationCard key={e._id} escalation={e} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
