import { ChevronRight } from "lucide-react";
import ScoreCard from "../components/ScoreCard.jsx";

/**
 * ReportList.jsx
 * --------------
 * The landing screen: the scorecard summary up top, then every case as a
 * row a reviewer can click into for the full side-by-side comparison.
 */

function factsFullyMatched(factDiff) {
  return Object.values(factDiff).every((entry) => entry.missing.length === 0);
}

function MatchPill({ ok, label }) {
  return <span className={`pill ${ok ? "pill-success" : "pill-danger"}`}>{label}</span>;
}

export default function ReportList({ report, onSelectCase }) {
  const { summary, cases } = report;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Draft vs Real Reply</h2>
        <p className="text-sm text-[var(--muted)]">
          Every real reply from the imported threads, compared against a draft our pipeline
          generated for the same message.
        </p>
      </div>

      <ScoreCard summary={summary} />

      {cases.length === 0 ? (
        <div className="executive-card-soft p-6 text-sm text-[var(--muted)]">
          No cases yet. Run <code>python pipeline/run_pipeline.py</code> to generate the report.
        </div>
      ) : (
        <div className="executive-card divide-y overflow-hidden">
          {cases.map((c, index) => (
            <button
              key={`${c.thread_id}-${c.reply_seq}`}
              onClick={() => onSelectCase(index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[rgb(var(--violet-rgb)/0.05)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Thread {c.thread_id} · reply #{c.reply_seq}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {c.context.order_id || "no order id in message"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MatchPill ok={c.comparison.category_match} label={c.comparison.real_category} />
                <MatchPill
                  ok={factsFullyMatched(c.comparison.fact_diff)}
                  label={`${Math.round(c.comparison.similarity * 100)}% similar`}
                />
                <ChevronRight size={16} className="text-[var(--muted)]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
