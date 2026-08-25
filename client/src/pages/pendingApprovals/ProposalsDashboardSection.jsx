import { AlertCircle, Inbox, Search } from "lucide-react";
import StatBarDecoration from "./StatBarDecoration.jsx";
import { StatBarItem, DonutChart, ProposalTableHeader, ProposalRow } from "./ProposalTable.jsx";
import ProposalDetailPanel from "./ProposalDetailPanel.jsx";
import { BUCKETS, BUCKET_LABEL, FILTER_TABS } from "./constants.js";

/**
 * ProposalsDashboardSection.jsx
 * -------------------------------
 * The top half of the page: loading/error states, the stat card + donut,
 * the filter tabs + search box, and the proposals table + detail panel.
 * Pure render - all the actual data/state lives in PendingApprovalsPage.jsx
 * and gets passed down as props.
 */
export default function ProposalsDashboardSection({
  loading,
  error,
  stats,
  fetchedCount,
  totalCount,
  filterBucket,
  setFilterBucket,
  search,
  setSearch,
  filtered,
  selectedId,
  setSelectedId,
  selected,
  onDecided,
  sectionRef,
}) {
  if (error) {
    return (
      <div className="executive-card-soft flex items-center gap-2 p-4 text-sm text-[var(--executive-error)]">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="executive-card space-y-3 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-[rgb(var(--navy-rgb)/0.08)]" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-[rgb(var(--navy-rgb)/0.05)]" />
      </div>
    );
  }

  return (
    <>
      {/* Stat bar is its own region, separate from the donut card - the
          donut keeps its guaranteed width so its legend never gets
          squeezed, and is otherwise untouched. */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="executive-card relative flex min-h-[260px] flex-col overflow-hidden p-0">
          <StatBarDecoration />
          <div className="relative z-10 mt-auto flex w-full flex-wrap items-center divide-x divide-[rgb(var(--navy-rgb)/0.08)] border-t border-[rgb(var(--navy-rgb)/0.07)] bg-white/85 backdrop-blur-sm">
            <StatBarItem bucket={null} label="Total Proposals" value={stats.total} delta={Object.values(stats.weekCounts).reduce((a, b) => a + b, 0)} />
            {BUCKETS.map((b) => (
              <StatBarItem key={b} bucket={b} label={BUCKET_LABEL[b]} value={stats.counts[b]} delta={stats.weekCounts[b]} />
            ))}
          </div>
        </div>
        <div className="executive-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Proposal Overview</p>
          <DonutChart counts={stats.counts} total={stats.total} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterBucket(tab.id)}
              className={filterBucket === tab.id ? "brand-button px-3 py-1.5 text-xs" : "brand-button-ghost px-3 py-1.5 text-xs"}
            >
              {tab.label}
              {tab.id !== "all" && ` (${stats.counts[tab.id] || 0})`}
              {tab.id === "all" && ` (${stats.total})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals..."
            className="brand-input w-56 rounded-lg py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      <div ref={sectionRef} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="executive-card overflow-hidden p-0">
          <ProposalTableHeader />
          {totalCount > fetchedCount && (
            <p className="border-b border-[rgb(var(--navy-rgb)/0.06)] px-3 py-2 text-[11px] text-[var(--muted)]">
              Showing the {fetchedCount} most recent of {totalCount} proposals. Narrow with a filter or search to find an older one.
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--muted)]">
              <Inbox size={22} />
              No proposals match this filter.
            </div>
          ) : (
            filtered.map((p) => (
              <ProposalRow key={p._id} proposal={p} selected={p._id === selectedId} onSelect={setSelectedId} />
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <ProposalDetailPanel proposal={selected} onDecided={onDecided} />
        </div>
      </div>
    </>
  );
}
