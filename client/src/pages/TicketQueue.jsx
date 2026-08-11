import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fetchTickets } from "../api.js";
import ThreadDetailsModal from "../components/ThreadDetailsModal.jsx";

/**
 * TicketQueue.jsx
 * ----------------
 * The support inbox as a data table, one row per customer thread - laid out
 * to match the real Ergode CRM's ticket list (columns, search, pagination).
 * Every row's data is fetched live from the Order API + CRM Thread API (see
 * server/routes/tickets.js) - the zip is only used server-side as the index
 * of which order ids to show, never as the source of what's displayed.
 *
 * Clicking a row pops up a "Thread Details" modal first (also matching the
 * real CRM); "Open Thread" from there is what actually navigates in.
 */

const PAGE_SIZE = 15;

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalTicket, setModalTicket] = useState(null);

  useEffect(() => {
    fetchTickets()
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!tickets) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      [t.thread_id, t.order_id, t.recipient_name, t.product_name, t.marketplace, t.thread_reason]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [tickets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="executive-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Awaiting reply
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {awaitingCount} / {tickets.length}
              </p>
            </div>

            <div className="relative w-full max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search order, recipient, product, reason..."
                className="brand-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="executive-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--navy-rgb)/0.08)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-5 py-3">Thread ID</th>
                    <th className="px-5 py-3">Order Id</th>
                    <th className="px-5 py-3">Marketplace</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Recipient</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Messages</th>
                    <th className="px-5 py-3">Last Email Time</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--navy-rgb)/0.06)]">
                  {pageRows.map((ticket) => (
                    <tr
                      key={ticket.thread_id}
                      onClick={() => setModalTicket(ticket)}
                      className="cursor-pointer hover:bg-[rgb(var(--violet-rgb)/0.05)]"
                    >
                      <td className="px-5 py-3 font-medium">{ticket.thread_id}</td>
                      <td className="px-5 py-3">{ticket.order_id || "—"}</td>
                      <td className="px-5 py-3 text-[var(--muted)]">{ticket.marketplace || "—"}</td>
                      <td className="px-5 py-3 text-[var(--muted)]">{ticket.thread_reason || "—"}</td>
                      <td className="px-5 py-3">{ticket.recipient_name || "—"}</td>
                      <td className="max-w-[220px] truncate px-5 py-3 text-[var(--muted)]">
                        {ticket.product_name || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="pill pill-neutral">{ticket.message_count}</span>
                        {ticket.has_relay && <span className="pill pill-neutral ml-1">relayed</span>}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted)]">{ticket.last_message_time || "—"}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={ticket.status} />
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-sm text-[var(--muted)]">
                        No tickets match "{search}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[rgb(var(--navy-rgb)/0.08)] px-5 py-3 text-xs text-[var(--muted)]">
                <span>
                  Page {page} of {totalPages} ({filtered.length} threads)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="brand-button-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="brand-button-ghost px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <ThreadDetailsModal
        ticket={modalTicket}
        onClose={() => setModalTicket(null)}
        onOpenThread={(threadId) => {
          setModalTicket(null);
          onSelectTicket(threadId);
        }}
      />
    </div>
  );
}
