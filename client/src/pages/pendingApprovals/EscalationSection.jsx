import { AlertCircle, Inbox, Layers } from "lucide-react";
import Modal from "../../components/Modal.jsx";
import { EscalationStatBarItem, EscalationDetailPanel } from "./EscalationPanel.jsx";
import { EscalationTableHeader, EscalationTableRow } from "./EscalationTable.jsx";
import { ProposalTableHeader, ProposalRow } from "./ProposalTable.jsx";
import ProposalDetailPanel from "./ProposalDetailPanel.jsx";
import Pagination from "./Pagination.jsx";
import { ESCALATION_TYPE_META, ESCALATION_TYPES, PROMPT_FIX_STAT_META, PERMANENT_EDIT_STAT_META } from "./constants.js";

/** "N became a fix · N no gap found" etc. for the Permanent Edit card - only the non-zero parts, so a quiet history doesn't read as a wall of zeroes. */
function permanentEditCaption(breakdown) {
  if (!breakdown) return null;
  const parts = [];
  if (breakdown.prompt_fix) parts.push(`${breakdown.prompt_fix} became a fix`);
  if (breakdown.code_restriction) parts.push(`${breakdown.code_restriction} code gap`);
  if (breakdown.data_restriction) parts.push(`${breakdown.data_restriction} data gap`);
  if (breakdown.none) parts.push(`${breakdown.none} no gap found`);
  return parts.join(" · ") || null;
}

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
  totalCount,
  totalTriaged,
  permanentEditTotal,
  permanentEditBreakdown,
  promptFixValue,
  escalationStats,
  escalationFilter,
  setEscalationFilter,
  filteredEscalations,
  proposalsByRecency,
  permanentFixProposals,
  proposalsById,
  selectedId,
  setSelectedId,
  selectedProposal,
  selectedEscalationId,
  setSelectedEscalationId,
  selectedEscalation,
  onDecided,
  onOverrideCreated,
  page,
  limit,
  onPageChange,
  onLimitChange,
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
      ) : totalTriaged === 0 ? (
        <div className="executive-card-soft flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
          <Inbox size={22} />
          Nothing has been reviewed yet.
        </div>
      ) : (
        <>
          {/* Always shown once anything has ever been triaged - even a
              filter with zero matches (a card reading "0") still needs to
              stay visible so it can be clicked back off. Only the row list
              below reacts to the filter having no matches. */}
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
            {/* Spans both proposals and escalations (a permanent-fix edit
                can land as either), so clicking it is its own filter mode
                below rather than a `type` on the escalations query - see
                the two-block layout. Caption breaks the total down by
                outcome, so "8" doesn't read as one opaque number. */}
            <EscalationStatBarItem
              meta={PERMANENT_EDIT_STAT_META}
              label="Permanent Edit"
              value={permanentEditTotal}
              caption={permanentEditCaption(permanentEditBreakdown)}
              active={escalationFilter === "permanent_edit"}
              onClick={() => setEscalationFilter("permanent_edit")}
            />
          </div>

          {escalationFilter === "permanent_edit" ? (
            // Spans both collections - two stacked blocks instead of one
            // table, since a permanent-fix edit's outcome can be a
            // proposal (it became a fix) or an escalation (it didn't).
            <div className="space-y-3">
              <div className="executive-card overflow-hidden p-0">
                <div className="border-b border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Became a Fix
                </div>
                {permanentFixProposals.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
                    <Inbox size={22} />
                    None of these became a fix yet.
                  </div>
                ) : (
                  <>
                    <ProposalTableHeader />
                    {permanentFixProposals.map((p) => (
                      <ProposalRow key={p._id} proposal={p} selected={p._id === selectedId} onSelect={setSelectedId} />
                    ))}
                  </>
                )}
              </div>

              <div className="executive-card overflow-hidden p-0">
                <div className="border-b border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Reviewed — No Change Needed
                </div>
                {filteredEscalations.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
                    <Inbox size={22} />
                    Nothing matches this filter.
                  </div>
                ) : (
                  <>
                    <EscalationTableHeader />
                    {filteredEscalations.map((e) => (
                      <EscalationTableRow
                        key={e._id}
                        escalation={e}
                        selected={e._id === selectedEscalationId}
                        onSelect={setSelectedEscalationId}
                        proposalsById={proposalsById}
                      />
                    ))}
                    <Pagination page={page} limit={limit} total={totalCount} onPageChange={onPageChange} onLimitChange={onLimitChange} />
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="executive-card overflow-hidden p-0">
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
                <>
                  <EscalationTableHeader />
                  {filteredEscalations.map((e) => (
                    <EscalationTableRow
                      key={e._id}
                      escalation={e}
                      selected={e._id === selectedEscalationId}
                      onSelect={setSelectedEscalationId}
                      proposalsById={proposalsById}
                    />
                  ))}
                  <Pagination page={page} limit={limit} total={totalCount} onPageChange={onPageChange} onLimitChange={onLimitChange} />
                </>
              )}
            </div>
          )}

          {/* Selection, not filter mode, decides which panel opens - a
              permanent-fix edit's row can be either shape (see above), and
              the two are mutually exclusive since only one row type is ever
              clicked at a time. */}
          <Modal isOpen={Boolean(selectedProposal)} onClose={() => setSelectedId(null)}>
            {selectedProposal && (
              <ProposalDetailPanel proposal={selectedProposal} onDecided={onDecided} onClose={() => setSelectedId(null)} />
            )}
          </Modal>
          <Modal isOpen={Boolean(selectedEscalation)} onClose={() => setSelectedEscalationId(null)}>
            {selectedEscalation && (
              <EscalationDetailPanel
                escalation={selectedEscalation}
                onOverrideCreated={onOverrideCreated}
                onClose={() => setSelectedEscalationId(null)}
              />
            )}
          </Modal>
        </>
      )}
    </section>
  );
}
