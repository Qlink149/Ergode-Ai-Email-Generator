import { useEffect, useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { fetchTickets } from "../api.js";

/**
 * TicketQueue.jsx
 * ----------------
 * The support inbox: one row per customer thread. Right now these threads
 * come from the imported zip (see server/routes/tickets.js) - in the real
 * build this same page reads from the live CRM Thread API instead, and
 * nothing here needs to change.
 */

function StatusPill({ status }) {
  const isAwaiting = status === "awaiting_reply";
  return (
    <span className={`pill ${isAwaiting ? "pill-danger" : "pill-success"}`}>
      {isAwaiting ? "Awaiting reply" : "Responded"}
    </span>
  );
}

export default function TicketQueue({ onSelectTicket }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTickets()
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message));
  }, []);

  const awaitingCount = tickets?.filter((t) => t.status === "awaiting_reply").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Ticket Queue</h2>
        <p className="text-sm text-[var(--muted)]">
          Every imported customer thread, newest activity first. Threads waiting on a reply are
          surfaced at the top.
        </p>
      </div>

      {error && (
        <div className="executive-card-soft p-6 text-sm text-[var(--executive-error)]">{error}</div>
      )}

      {!error && !tickets && <p className="text-sm text-[var(--muted)]">Loading tickets...</p>}

      {tickets && (
        <>
          <div className="executive-card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Awaiting reply
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {awaitingCount} / {tickets.length}
            </p>
          </div>

          <div className="executive-card divide-y overflow-hidden">
            {tickets.map((ticket) => (
              <button
                key={ticket.thread_id}
                onClick={() => onSelectTicket(ticket.thread_id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[rgb(var(--violet-rgb)/0.05)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Inbox size={16} className="shrink-0 text-[var(--muted)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Thread {ticket.thread_id}
                      {ticket.order_id && (
                        <span className="ml-2 text-xs text-[var(--muted)]">{ticket.order_id}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {ticket.last_message_preview}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {ticket.has_relay && <span className="pill pill-neutral">relayed</span>}
                  <span className="pill pill-neutral">{ticket.message_count} msgs</span>
                  <StatusPill status={ticket.status} />
                  <ChevronRight size={16} className="text-[var(--muted)]" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
