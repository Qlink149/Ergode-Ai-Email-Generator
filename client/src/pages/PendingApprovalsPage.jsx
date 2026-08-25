import { useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, RefreshCw } from "lucide-react";
import {
  fetchProposalHistory,
  fetchProposalStats,
  fetchEscalations,
  fetchEscalationStats,
  markEscalationsSeen,
} from "../api.js";
import { bucketOf } from "./pendingApprovals/constants.js";
import ProposalsDashboardSection from "./pendingApprovals/ProposalsDashboardSection.jsx";
import EscalationSection from "./pendingApprovals/EscalationSection.jsx";

const EMPTY_PROPOSAL_STATS = {
  counts: { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 },
  weekCounts: { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 },
  total: 0,
  non_override_total: 0,
};
const EMPTY_ESCALATION_STATS = { counts: { code_restriction: 0, data_restriction: 0, none: 0 }, total: 0 };

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
 * see the Vercel/MongoDB performance audit this replaced. The row lists
 * still fetch actual records (paginated, 200 at a time - see
 * fetchProposalHistory/fetchEscalations) since the table needs real rows
 * to render, but nothing here downloads "every record that has ever
 * existed" just to count them anymore.
 *
 * This file only owns state, data loading, and the derived (useMemo)
 * values both sections need - all the actual markup lives in the section
 * components and their own sub-components under ./pendingApprovals/.
 */
export default function PendingApprovalsPage() {
  const [proposals, setProposals] = useState([]);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [proposalStats, setProposalStats] = useState(EMPTY_PROPOSAL_STATS);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filterBucket, setFilterBucket] = useState("all");
  const [search, setSearch] = useState("");

  const proposalsSectionRef = useRef(null);

  const [escalations, setEscalations] = useState([]);
  const [escalationsTotal, setEscalationsTotal] = useState(0);
  const [escalationStats, setEscalationStats] = useState(EMPTY_ESCALATION_STATS);
  const [escalationsLoading, setEscalationsLoading] = useState(true);
  const [escalationsError, setEscalationsError] = useState(null);
  const [selectedEscalationId, setSelectedEscalationId] = useState(null);
  const [escalationFilter, setEscalationFilter] = useState("all");

  function loadProposals() {
    setProposalsLoading(true);
    Promise.all([fetchProposalHistory(), fetchProposalStats()])
      .then(([history, stats]) => {
        setProposals(history.proposals);
        setProposalsTotal(history.total);
        setProposalStats(stats);
      })
      .catch((err) => setProposalsError(err.message))
      .finally(() => setProposalsLoading(false));
  }

  function loadEscalations() {
    setEscalationsLoading(true);
    Promise.all([fetchEscalations(), fetchEscalationStats()])
      .then(([list, stats]) => {
        setEscalations(list.escalations);
        setEscalationsTotal(list.total);
        setEscalationStats(stats);
        const unseenIds = list.escalations.filter((e) => e.status === "unseen").map((e) => e._id);
        if (unseenIds.length > 0) markEscalationsSeen(unseenIds).catch(() => {});
      })
      .catch((err) => setEscalationsError(err.message))
      .finally(() => setEscalationsLoading(false));
  }

  useEffect(() => {
    loadProposals();
    loadEscalations();
  }, []);

  // Filters/searches within the page of proposals actually fetched (up to
  // 200 - see fetchProposalHistory) rather than a full unbounded history.
  // The COUNTS shown on filter tabs come from proposalStats (a real
  // database aggregate), not from this array's length, so the tab labels
  // stay accurate even once total proposals exceed one page.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals
      .filter((p) => filterBucket === "all" || bucketOf(p.status) === filterBucket)
      .filter(
        (p) =>
          !q ||
          (p.reason || "").toLowerCase().includes(q) ||
          (p.order_id || "").toLowerCase().includes(q) ||
          (p.author || "").toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [proposals, filterBucket, search]);

  const selected = proposals.find((p) => p._id === selectedId) || null;
  const selectedEscalation = escalations.find((e) => e._id === selectedEscalationId) || null;

  // A proposal created from an override doesn't represent a NEW piece of
  // feedback - it's a second record for the SAME feedback that already has
  // an escalation entry. Naively adding escalations + proposals double-
  // counts every overridden item (once as its still-there "none"/code/data
  // escalation, once as the proposal the override created). Grand total =
  // every escalation, once each, plus only the proposals that came from an
  // original comment/edit (proposalStats.non_override_total, computed by
  // the same MongoDB aggregation as everything else in proposalStats).
  const totalTriaged = escalationStats.total + proposalStats.non_override_total;

  const filteredEscalations = useMemo(
    () => (escalationFilter === "all" ? escalations : escalations.filter((e) => e.type === escalationFilter)),
    [escalations, escalationFilter]
  );

  // "Prompt Fix" isn't an escalation type - those items are proposals. When
  // that filter is active, this section shows the actual proposal rows
  // (newest first) right here instead of trying to filter the escalation
  // list to something that can never match.
  const proposalsByRecency = useMemo(
    () => [...proposals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [proposals]
  );

  function handleDecided() {
    loadProposals();
  }

  function handleOverrideCreated() {
    loadProposals();
    loadEscalations();
  }

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
            loadProposals();
            loadEscalations();
          }}
          className="brand-button-ghost px-3 py-1.5 text-xs"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <ProposalsDashboardSection
        loading={proposalsLoading}
        error={proposalsError}
        stats={proposalStats}
        fetchedCount={proposals.length}
        totalCount={proposalsTotal}
        filterBucket={filterBucket}
        setFilterBucket={setFilterBucket}
        search={search}
        setSearch={setSearch}
        filtered={filtered}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        selected={selected}
        onDecided={handleDecided}
        sectionRef={proposalsSectionRef}
      />

      <EscalationSection
        loading={escalationsLoading}
        error={escalationsError}
        escalations={escalations}
        fetchedCount={escalations.length}
        totalCount={escalationsTotal}
        totalTriaged={totalTriaged}
        promptFixValue={proposalStats.total}
        escalationStats={escalationStats}
        escalationFilter={escalationFilter}
        setEscalationFilter={setEscalationFilter}
        filteredEscalations={filteredEscalations}
        proposalsByRecency={proposalsByRecency}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        selectedProposal={selected}
        selectedEscalationId={selectedEscalationId}
        setSelectedEscalationId={setSelectedEscalationId}
        selectedEscalation={selectedEscalation}
        onDecided={handleDecided}
        onOverrideCreated={handleOverrideCreated}
      />
    </div>
  );
}
