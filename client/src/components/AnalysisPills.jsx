/** Sentiment/urgency/confidence/review-flag pills for one generated draft. Shared by TicketDetail.jsx and OrderLookupPage.jsx. */
export default function AnalysisPills({ analysis }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="pill pill-neutral">sentiment: {analysis.sentiment}</span>
      <span className="pill pill-neutral">urgency: {analysis.urgency}</span>
      <span className="pill pill-neutral">confidence: {Math.round((analysis.confidence ?? 0) * 100)}%</span>
      <span className={`pill ${analysis.needs_human_review ? "pill-danger" : "pill-success"}`}>
        {analysis.needs_human_review ? "needs human review" : "low risk"}
      </span>
      <span className="basis-full text-xs text-[var(--muted)]">{analysis.review_reason}</span>
    </div>
  );
}
