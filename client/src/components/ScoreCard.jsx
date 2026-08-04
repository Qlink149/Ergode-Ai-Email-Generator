/**
 * ScoreCard.jsx
 * -------------
 * The four headline numbers from the report summary, shown as a row of
 * stat tiles at the top of the report list.
 */

function Stat({ label, value }) {
  return (
    <div className="executive-card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function asPercent(fraction) {
  if (typeof fraction !== "number") return "—";
  return `${Math.round(fraction * 100)}%`;
}

export default function ScoreCard({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Cases compared" value={summary.total_cases ?? 0} />
      <Stat label="Category match rate" value={asPercent(summary.category_match_rate)} />
      <Stat label="Fact match rate" value={asPercent(summary.fact_match_rate)} />
      <Stat label="Average similarity" value={asPercent(summary.average_similarity)} />
    </div>
  );
}
