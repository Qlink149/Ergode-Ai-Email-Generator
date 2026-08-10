import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Shows what the AI actually received for one generation, plus its own
 * explanation of why it wrote the reply the way it did. threadMeta is
 * reference-only, never sent to the AI - it's been unreliable in testing.
 * Shared by TicketDetail.jsx and OrderLookupPage.jsx.
 */
export default function AiContextPanel({ context, systemPromptVersion, threadMeta, reasoning }) {
  const [open, setOpen] = useState(false);
  const facts = context.order_facts;

  return (
    <div className="executive-card-soft p-4 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Show AI context (what it read to write this)
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {reasoning && (
            <div className="rounded-xl border border-[rgb(var(--violet-rgb)/0.18)] bg-[rgb(var(--violet-rgb)/0.05)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--violet)]">
                Why this reply
              </p>
              <p className="mt-1">{reasoning}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              System prompt
            </p>
            <p className="mt-1">Version {systemPromptVersion}</p>
          </div>

          {threadMeta && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                CRM thread metadata (reference only - NOT sent to the AI)
              </p>
              <ul className="mt-1 space-y-0.5">
                <li>Thread reason: {threadMeta.thread_reason || "none"}</li>
                <li>Cancellation marked: {String(threadMeta.cancellation_marked ?? "unknown")}</li>
                <li>
                  Order details:{" "}
                  {threadMeta.order_details?.length ? JSON.stringify(threadMeta.order_details) : "none"}
                </li>
              </ul>
              <p className="mt-1 text-xs text-[var(--muted)]">
                These fields have already disagreed with what the real conversation shows on other
                threads this session - shown for your own judgment, not used as a fact by the AI.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Order context
            </p>
            {facts ? (
              <ul className="mt-1 space-y-0.5">
                <li>Recipient: {facts.recipient_name || "unknown"}</li>
                <li>Product: {facts.product_name || "unknown"}</li>
                <li>Quantity: {facts.quantity || "unknown"}</li>
                <li>Carrier: {facts.carrier_name || "none"}</li>
                <li>Tracking ID: {facts.tracking_id || "none"}</li>
                <li>Tracking URL: {facts.tracking_url || "none"}</li>
                <li>Final-mile carrier: {facts.last_mile_carrier || "none"}</li>
                <li>Final-mile tracking: {facts.last_mile_tracking || "none"}</li>
                <li>Ship method: {facts.ship_method || "unknown"}</li>
                <li>Shipped: {facts.shipped_date || "unknown"}</li>
                <li>Purchased: {facts.purchase_date || "unknown"}</li>
                <li>Promised delivery date: {facts.promised_delivery_date || "unknown"}</li>
                <li>Order total: {facts.total_price ? `$${facts.total_price}` : "unknown"}</li>
                <li>Marketplace: {facts.marketplace || "unknown"}</li>
                <li>Latest carrier status: {facts.customer_tracking_status || "none on file"}</li>
                <li>
                  Confirmed refund:{" "}
                  {facts.customer_refund_amount || facts.refund_date
                    ? `$${facts.customer_refund_amount || "unknown amount"}${
                        facts.refund_date ? `, issued ${facts.refund_date}` : ""
                      }`
                    : "none on file"}
                </li>
              </ul>
            ) : (
              <p className="mt-1">No verified order facts were provided for this generation.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Customer message it's answering
            </p>
            <p className="mt-1 whitespace-pre-wrap">{context.customer_message}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              CRM history given ({context.thread_history?.length ?? 0} prior messages)
            </p>
            {context.thread_history?.length > 0 ? (
              <div className="mt-1 space-y-2">
                {context.thread_history.map((m, i) => (
                  <p key={i}>
                    <span className="font-semibold">{m.direction === "in" ? "Customer: " : "Us: "}</span>
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1">Nothing before this message in the thread.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
