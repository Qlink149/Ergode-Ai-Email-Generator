import { ListChecks, RefreshCw } from "lucide-react";
import { usePendingApprovalsData } from "./pendingApprovals/usePendingApprovalsData.js";
import ProposalsDashboardSection from "./pendingApprovals/ProposalsDashboardSection.jsx";
import EscalationSection from "./pendingApprovals/EscalationSection.jsx";

/**
 * PendingApprovalsPage.jsx
 * --------------------------
 * The human side of the triage-agent loop (see pipeline/triage_agent.py):
 * every Comment or Draft Edit is classified automatically, but nothing
 * ever reaches the live system prompt without a person reviewing it here
 * and clicking Approve. Two areas, each its own file under ./pendingApprovals/:
 *
 * - ProposalsDashboardSection: every prompt-fix proposal, any status, in
 *   one filterable/searchable list with a detail panel - stat cards and a
 *   donut chart give the at-a-glance breakdown (pending / implemented /
 *   rejected / needs attention).
 * - EscalationSection ("Everything Else Reviewed"): escalations (code/data
 *   gaps, and "none" verdicts) - acknowledged by viewing, or overridden if
 *   a human disagrees, which drafts a real proposal (shows up in the
 *   dashboard above, still needs its own separate Approve).
 *
 * Stat cards, the donut, and every filter-tab count come from two small
 * MongoDB-aggregated endpoints (fetchProposalStats/fetchEscalationStats),
 * NOT from reducing the full proposals/escalations arrays in the browser -
 * see the Vercel/MongoDB performance audit this replaced.
 *
 * This file is pure JSX composition - every bit of state, data loading,
 * polling, and derived value lives in ./pendingApprovals/usePendingApprovalsData.js.
 */
export default function PendingApprovalsPage() {
  const data = usePendingApprovalsData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
          >
            <ListChecks size={18} />
          </span>
          <div>
            <h2 className="text-xl font-semibold leading-tight">Pending Approvals</h2>
            <p className="text-xs text-[var(--muted)]">Review, approve, and track every proposed prompt change.</p>
          </div>
        </div>
        <button
          onClick={() => {
            data.loadProposals();
            data.loadEscalations();
          }}
          className="brand-button-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <ProposalsDashboardSection
        loading={data.proposalsLoading}
        error={data.proposalsError}
        stats={data.proposalStats}
        fetchedCount={data.proposals.length}
        totalCount={data.proposalsTotal}
        filterBucket={data.filterBucket}
        setFilterBucket={data.setFilterBucket}
        search={data.search}
        setSearch={data.setSearch}
        filtered={data.filtered}
        selectedId={data.selectedId}
        setSelectedId={data.setSelectedId}
        selected={data.selected}
        onDecided={data.handleDecided}
        sectionRef={data.proposalsSectionRef}
      />

      <EscalationSection
        loading={data.escalationsLoading}
        error={data.escalationsError}
        escalations={data.escalations}
        totalCount={data.escalationsTotal}
        totalTriaged={data.totalTriaged}
        permanentEditTotal={data.permanentEditTotal}
        permanentEditBreakdown={data.permanentEditBreakdown}
        promptFixValue={data.proposalStats.total}
        escalationStats={data.escalationStats}
        escalationFilter={data.escalationFilter}
        setEscalationFilter={data.handleEscalationFilterChange}
        filteredEscalations={data.escalations}
        proposalsByRecency={data.proposalsByRecency}
        permanentFixProposals={data.permanentFixProposals}
        proposalsById={data.proposalsById}
        selectedId={data.selectedId}
        setSelectedId={data.setSelectedId}
        selectedProposal={data.selected}
        selectedEscalationId={data.selectedEscalationId}
        setSelectedEscalationId={data.setSelectedEscalationId}
        selectedEscalation={data.selectedEscalation}
        onDecided={data.handleDecided}
        onOverrideCreated={data.handleOverrideCreated}
        page={data.escalationPage}
        limit={data.escalationLimit}
        onPageChange={data.setEscalationPage}
        onLimitChange={data.handleEscalationLimitChange}
      />
    </div>
  );
}
