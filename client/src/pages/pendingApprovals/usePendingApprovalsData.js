import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchProposalHistory,
  fetchProposalStats,
  fetchEscalations,
  fetchEscalationStats,
  markEscalationsSeen,
} from "../../api.js";
import { bucketOf, ESCALATION_TYPES } from "./constants.js";

const EMPTY_PROPOSAL_STATS = {
  counts: { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 },
  weekCounts: { pending: 0, implemented: 0, rejected: 0, needs_attention: 0 },
  total: 0,
  non_override_total: 0,
  draft_edit_count: 0,
};
const EMPTY_ESCALATION_STATS = {
  counts: { code_restriction: 0, data_restriction: 0, none: 0 },
  total: 0,
  draft_edit_counts: { code_restriction: 0, data_restriction: 0, none: 0 },
};

/**
 * usePendingApprovalsData.js
 * ---------------------------
 * All of PendingApprovalsPage.jsx's state, data loading, polling, and
 * derived (useMemo) values, pulled out of the page component so that file
 * can stay pure JSX composition. See PendingApprovalsPage.jsx's own
 * docstring for what the two sections this feeds are.
 */
export function usePendingApprovalsData() {
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
  const [escalationPage, setEscalationPage] = useState(1);
  const [escalationLimit, setEscalationLimit] = useState(10);

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

  // escalationFilter can be "all", "prompt_fix" (handled entirely
  // client-side from the proposals list - see proposalsByRecency below,
  // not a real escalation field), "permanent_edit" (sent as an actual
  // trigger_type filter, so its pagination/total stay accurate), or one of
  // ESCALATION_TYPES (sent as an actual `type` filter).
  function loadEscalations() {
    setEscalationsLoading(true);
    const type = ESCALATION_TYPES.includes(escalationFilter) ? escalationFilter : undefined;
    const triggerType = escalationFilter === "permanent_edit" ? "draft_edit" : undefined;
    Promise.all([
      fetchEscalations(undefined, { page: escalationPage, limit: escalationLimit, type, triggerType }),
      fetchEscalationStats(),
    ])
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
  }, []);

  // Re-fetches whenever the filter tab, page, or rows-per-page changes -
  // also covers the initial load, since this effect fires on mount too.
  useEffect(() => {
    loadEscalations();
  }, [escalationFilter, escalationPage, escalationLimit]);

  // A new proposal/escalation can appear at any moment - someone else's
  // comment or permanent-fix edit, or the same triage call this tab kicked
  // off a moment ago - and sorting alone (newest first, already the case
  // server-side) doesn't help if this page never re-fetches to see it.
  // Same polling pattern as NotificationBell.jsx (45s + refresh on tab
  // focus), via a ref so the interval always calls the CURRENT closures
  // (current filter/page/limit) without needing to restart on every change.
  const refreshAllRef = useRef(() => {});
  refreshAllRef.current = () => {
    loadProposals();
    loadEscalations();
  };
  useEffect(() => {
    const interval = setInterval(() => refreshAllRef.current(), 45000);
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshAllRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  function handleEscalationFilterChange(nextFilter) {
    setEscalationFilter(nextFilter);
    setEscalationPage(1); // changing filters invalidates whatever page you were on
  }

  function handleEscalationLimitChange(nextLimit) {
    setEscalationLimit(nextLimit);
    setEscalationPage(1);
  }

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

  // "Permanent Edit" stat card - a permanent-fix edit lands in whichever
  // collection its outcome belongs to: a proposal if the triage agent found
  // an actual "prompt_fix", an escalation (by its own type) otherwise. This
  // breaks that down instead of showing one opaque total, so it's visible
  // how many permanent-fix edits actually changed something vs. were
  // reviewed and found to need no change.
  const permanentEditBreakdown = {
    prompt_fix: proposalStats.draft_edit_count || 0,
    code_restriction: escalationStats.draft_edit_counts?.code_restriction || 0,
    data_restriction: escalationStats.draft_edit_counts?.data_restriction || 0,
    none: escalationStats.draft_edit_counts?.none || 0,
  };
  const permanentEditTotal = Object.values(permanentEditBreakdown).reduce((a, b) => a + b, 0);

  // "Prompt Fix" isn't an escalation type - those items are proposals. When
  // that filter is active, this section shows the actual proposal rows
  // (newest first) right here instead of trying to filter the escalation
  // list to something that can never match.
  const proposalsByRecency = useMemo(
    () => [...proposals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [proposals]
  );

  // "Permanent Edit" filter's proposal half - the subset of proposalsByRecency
  // that came from a permanent-fix draft edit (as opposed to a Comment).
  // Client-side, since `proposals` already holds the full fetched set - no
  // extra request needed, same reasoning as proposalsByRecency above.
  const permanentFixProposals = useMemo(
    () => proposalsByRecency.filter((p) => p.trigger_type === "draft_edit"),
    [proposalsByRecency]
  );

  // For EscalationTable's STATUS column - an overridden escalation's real
  // status is its resulting proposal's status (pending/approved/rejected),
  // looked up by id rather than fetched again, since the proposals list is
  // already in memory here.
  const proposalsById = useMemo(() => new Map(proposals.map((p) => [p._id, p])), [proposals]);

  function handleDecided() {
    loadProposals();
  }

  function handleOverrideCreated() {
    loadProposals();
    loadEscalations();
  }

  return {
    // Proposals dashboard section
    proposalsLoading,
    proposalsError,
    proposalStats,
    proposals,
    proposalsTotal,
    filterBucket,
    setFilterBucket,
    search,
    setSearch,
    filtered,
    selectedId,
    setSelectedId,
    selected,
    proposalsSectionRef,
    // Escalation ("Everything Else Reviewed") section
    escalationsLoading,
    escalationsError,
    escalations,
    escalationsTotal,
    escalationStats,
    escalationFilter,
    selectedEscalationId,
    setSelectedEscalationId,
    selectedEscalation,
    escalationPage,
    escalationLimit,
    totalTriaged,
    permanentEditTotal,
    permanentEditBreakdown,
    proposalsByRecency,
    permanentFixProposals,
    proposalsById,
    // Actions
    loadProposals,
    loadEscalations,
    handleDecided,
    handleOverrideCreated,
    handleEscalationFilterChange,
    handleEscalationLimitChange,
    setEscalationPage,
  };
}
