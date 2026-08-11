import { X, ArrowUpRight } from "lucide-react";

/**
 * Small popup shown when a ticket row is clicked, before opening the full
 * thread - mirrors the real CRM's row-click behavior. "Open Thread" is the
 * only way into the full two-column detail view.
 */
export default function ThreadDetailsModal({ ticket, onClose, onOpenThread }) {
  if (!ticket) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="executive-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Thread {ticket.thread_id}
            </p>
            <h3 className="text-lg font-semibold">{ticket.recipient_name || "Unknown recipient"}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Order ID</dt>
            <dd className="font-medium">{ticket.order_id || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Product</dt>
            <dd className="text-right font-medium">{ticket.product_name || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Marketplace</dt>
            <dd className="font-medium">{ticket.marketplace || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Reason</dt>
            <dd className="font-medium">{ticket.thread_reason || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Messages</dt>
            <dd className="font-medium">{ticket.message_count}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--muted)]">Status</dt>
            <dd className="font-medium">
              {ticket.status === "awaiting_reply" ? "Awaiting reply" : "Responded"}
            </dd>
          </div>
        </dl>

        <button
          onClick={() => onOpenThread(ticket.thread_id)}
          className="brand-button mt-6 w-full justify-center px-4 py-2 text-sm"
        >
          Open Thread
          <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
}
