import { ArrowLeft } from "lucide-react";
import SideBySideReplies from "../components/SideBySideReplies.jsx";
import MessageText from "../components/MessageText.jsx";

/**
 * ReportDetail.jsx
 * ----------------
 * The full picture for one case: the real reply and our AI's draft side by
 * side, what facts matched or didn't, and - for transparency - exactly
 * what context the AI was given before it wrote anything.
 */

function FactRow({ label, entry }) {
  if (entry.matched.length === 0 && entry.missing.length === 0 && entry.extra.length === 0) {
    return null;
  }
  return (
    <tr className="border-t border-[rgb(var(--navy-rgb)/0.08)]">
      <td className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </td>
      <td className="py-2 pr-4 text-sm text-[var(--executive-success)]">
        {entry.matched.join(", ") || "—"}
      </td>
      <td className="py-2 pr-4 text-sm text-[var(--executive-error)]">
        {entry.missing.join(", ") || "—"}
      </td>
      <td className="py-2 text-sm text-[var(--muted)]">{entry.extra.join(", ") || "—"}</td>
    </tr>
  );
}

export default function ReportDetail({ item, onBack }) {
  const { context, actual_reply, draft_reply, comparison } = item;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="brand-button-ghost px-4 py-2 text-sm"
        style={{ borderRadius: "999px" }}
      >
        <ArrowLeft size={16} />
        Back to all cases
      </button>

      <div>
        <h2 className="text-xl font-semibold">
          Thread {item.thread_id} · reply #{item.reply_seq}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`pill ${comparison.category_match ? "pill-success" : "pill-danger"}`}>
            real: {comparison.real_category} / draft: {comparison.draft_category}
          </span>
          <span className="pill pill-neutral">
            {Math.round(comparison.similarity * 100)}% text similarity
          </span>
        </div>
      </div>

      <SideBySideReplies realReply={actual_reply} draftReply={draft_reply} />

      <div className="executive-card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Fact check
        </h3>
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <th className="pb-2">Type</th>
              <th className="pb-2">Matched</th>
              <th className="pb-2">Missing from our draft</th>
              <th className="pb-2">Extra in our draft</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(comparison.fact_diff).map(([label, entry]) => (
              <FactRow key={label} label={label} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="executive-card-soft p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Context the AI was given
        </h3>
        <p className="text-sm">
          <span className="font-semibold">Order ID:</span> {context.order_id || "not provided"}
        </p>
        {context.is_relay && (
          <p className="mt-1 text-sm text-[var(--executive-error)]">
            Flagged as a marketplace representative relaying for the customer.
          </p>
        )}
        <p className="mt-3 text-sm font-semibold">Customer message:</p>
        <div className="text-[var(--muted)]">
          <MessageText text={context.customer_message} />
        </div>
        {context.thread_history.length > 0 && (
          <>
            <p className="mt-3 text-sm font-semibold">
              Prior thread history ({context.thread_history.length} message
              {context.thread_history.length === 1 ? "" : "s"}):
            </p>
            <ul className="mt-1 space-y-2 text-sm text-[var(--muted)]">
              {context.thread_history.map((entry, i) => (
                <li key={i}>
                  <span className="font-semibold">
                    {entry.direction === "in" ? "Customer" : "Us"}:
                  </span>{" "}
                  <MessageText text={entry.text} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
