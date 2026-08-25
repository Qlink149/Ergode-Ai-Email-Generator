import { AlertCircle, Inbox, Layers } from "lucide-react";
import { EscalationStatBarItem, EscalationRow, EscalationDetailPanel } from "./EscalationPanel.jsx";
import { ProposalTableHeader, ProposalRow } from "./ProposalTable.jsx";
import ProposalDetailPanel from "./ProposalDetailPanel.jsx";
import { ESCALATION_TYPE_META, ESCALATION_TYPES, PROMPT_FIX_STAT_META } from "./constants.js";

/**
 * EscalationSection.jsx
 * -----------------------
 * The "Everything Else Reviewed" section: escalation stat bar (clickable,
 * doubles as a filter), the row list, and the detail panel. Clicking
 * "Prompt Fix" is a special case - those items aren't escalations, they're
 * proposals, so the row list and detail panel swap to the proposal
 * versions instead of trying to filter a list that can never match.
 * Pure render - all state lives in PendingApprovalsPage.jsx.
 */
export default function EscalationSection({
  loading,
  error,
  escalations,
  fetchedCount,
  totalCount,
  totalTriaged,
  promptFixValue,
  escalationStats,
  escalationFilter,
  setEscalationFilter,
  filteredEscalations,
  proposalsByRecency,
  selectedId,
  setSelectedId,
  selectedProposal,
  selectedEscalationId,
  setSelectedEscalationId,
  selectedEscalation,
  onDecided,
  onOverrideCreated,
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Everything Else Reviewed</h3>
      </div>

      {error && (
        <div className="executive-card-soft flex items-center gap-2 p-4 text-sm text-[var(--executive-error)]">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
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
        <>
          <div className="executive-card flex flex-wrap divide-x divide-[rgb(var(--navy-rgb)/0.08)] p-0">
            <EscalationStatBarItem
              meta={{ icon: Layers, bg: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
              label="Total Triaged"
              value={totalTriaged}
              active={escalationFilter === "all"}
              onClick={() => setEscalationFilter("all")}
            />
            {/* Prompt Fix items live in the Proposals table above, not in this row list below -
                clicking selects it like any other filter tab (so it visibly highlights), and the
                row list below swaps to the proposal rows instead of trying to filter this list. */}
            <EscalationStatBarItem
              meta={PROMPT_FIX_STAT_META}
              label="Prompt Fix"
              value={promptFixValue}
              active={escalationFilter === "prompt_fix"}
              onClick={() => setEscalationFilter("prompt_fix")}
            />
            {ESCALATION_TYPES.map((t) => (
              <EscalationStatBarItem
                key={t}
                meta={ESCALATION_TYPE_META[t]}
                label={ESCALATION_TYPE_META[t].label}
                value={escalationStats.counts[t] || 0}
                active={escalationFilter === t}
                onClick={() => setEscalationFilter(t)}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="executive-card overflow-hidden p-0">
              {escalationFilter !== "prompt_fix" && totalCount > fetchedCount && (
                <p className="border-b border-[rgb(var(--navy-rgb)/0.06)] px-3 py-2 text-[11px] text-[var(--muted)]">
                  Showing the {fetchedCount} most recent of {totalCount}. Narrow with a filter to find an older one.
                </p>
              )}
              {escalationFilter === "prompt_fix" ? (
                proposalsByRecency.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
                    <Inbox size={22} />
                    No prompt fix proposals yet.
                  </div>
                ) : (
                  <>
                    <ProposalTableHeader />
                    {proposalsByRecency.map((p) => (
                      <ProposalRow key={p._id} proposal={p} selected={p._id === selectedId} onSelect={setSelectedId} />
                    ))}
                  </>
                )
              ) : filteredEscalations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
                  <Inbox size={22} />
                  Nothing matches this filter.
                </div>
              ) : (
                filteredEscalations.map((e) => (
                  <EscalationRow key={e._id} escalation={e} selected={e._id === selectedEscalationId} onSelect={setSelectedEscalationId} />
                ))
              )}
            </div>
            <div className="lg:sticky lg:top-20 lg:self-start">
              {escalationFilter === "prompt_fix" ? (
                <ProposalDetailPanel proposal={selectedProposal} onDecided={onDecided} />
              ) : (
                <EscalationDetailPanel escalation={selectedEscalation} onOverrideCreated={onOverrideCreated} />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
