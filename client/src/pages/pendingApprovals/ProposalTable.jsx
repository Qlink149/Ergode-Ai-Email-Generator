import { Waypoints, ChevronRight } from "lucide-react";
import { AuthorAvatar } from "./SharedBits.jsx";
import {
  HEXAGON_CLIP,
  BUCKETS,
  BUCKET_LABEL,
  BUCKET_COLOR,
  BUCKET_ICON_STYLE,
  BUCKET_ICON,
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  TRIGGER_TYPE_LABEL,
  shortId,
  truncateMid,
  formatTimestamp,
} from "./constants.js";

/**
 * ProposalTable.jsx
 * -----------------
 * Everything about showing the proposals stat row, the donut breakdown, and
 * one row of the proposals list table.
 */

/** One column inside the shared stat bar - no card of its own, just a divider between it and its neighbor. */
export function StatBarItem({ bucket, label, value, delta }) {
  const style = bucket ? BUCKET_ICON_STYLE[bucket] : { background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" };
  const Icon = bucket ? BUCKET_ICON[bucket] : Waypoints;
  return (
    <div className="min-w-[160px] flex-1 p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ ...style, clipPath: HEXAGON_CLIP }}
        >
          <Icon size={17} />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold leading-none font-display">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{delta > 0 ? `+${delta} this week` : "No change this week"}</p>
    </div>
  );
}

/** Simple SVG donut - stacked stroke-dasharray arcs, one per bucket. Center label kept outside the rotated SVG so the text reads upright. */
export function DonutChart({ counts, total }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90" role="img" aria-label="Proposal status breakdown donut chart">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgb(var(--navy-rgb)/0.06)" strokeWidth="14" />
          {total > 0 &&
            BUCKETS.map((bucket) => {
              const count = counts[bucket] || 0;
              if (!count) return null;
              const fraction = count / total;
              const dash = fraction * circumference;
              const offset = -(cumulative * circumference);
              cumulative += fraction;
              return (
                <circle
                  key={bucket}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={BUCKET_COLOR[bucket]}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none font-display">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Total</span>
        </div>
      </div>

      {/* Full card width, one row per bucket - never squeezed beside the
          chart, which is what was truncating labels to single characters
          when this card ended up narrower than intended. */}
      <ul className="w-full space-y-1.5">
        {BUCKETS.map((bucket) => {
          const count = counts[bucket] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={bucket} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BUCKET_COLOR[bucket] }} />
              <span className="min-w-0 flex-1">{BUCKET_LABEL[bucket]}</span>
              <span className="shrink-0 font-medium text-[var(--muted)]">
                {count} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProposalTableHeader() {
  return (
    <div className="hidden items-center gap-3 border-b border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] lg:flex">
      <span className="w-20 shrink-0">Proposal</span>
      <span className="min-w-0 flex-1">Change Summary</span>
      <span className="w-32 shrink-0">Status</span>
      <span className="w-32 shrink-0">Created By</span>
      <span className="w-24 shrink-0 text-right">Last Action</span>
      <span className="w-4 shrink-0" />
    </div>
  );
}

export function ProposalRow({ proposal, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(proposal._id)}
      className={`flex w-full min-w-0 items-center gap-3 border-b border-[rgb(var(--navy-rgb)/0.06)] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-[rgb(var(--navy-rgb)/0.03)] ${
        selected ? "bg-[rgb(var(--violet-rgb)/0.07)]" : ""
      }`}
    >
      <div className="w-20 shrink-0">
        <p className="font-mono text-xs font-semibold">{shortId(proposal._id)}</p>
        <span className="pill pill-neutral mt-1">{TRIGGER_TYPE_LABEL[proposal.trigger_type] || "Comment"}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{proposal.reason}</p>
        {proposal.anchor_text && proposal.new_text && (
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {truncateMid(proposal.anchor_text, 34)} <span aria-hidden="true">→</span> {truncateMid(proposal.new_text, 34)}
          </p>
        )}
      </div>

      <div className="w-32 shrink-0">
        <span className={`pill ${STATUS_PILL_CLASS[proposal.status]}`}>{STATUS_LABEL[proposal.status]}</span>
      </div>

      <div className="hidden w-32 shrink-0 items-center gap-2 lg:flex">
        <AuthorAvatar name={proposal.author} />
        <span className="truncate text-xs font-medium">{proposal.author}</span>
      </div>

      <div className="hidden w-24 shrink-0 text-right text-xs text-[var(--muted)] lg:block">
        {formatTimestamp(proposal.reviewed_at || proposal.created_at)}
      </div>

      <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" />
    </button>
  );
}
