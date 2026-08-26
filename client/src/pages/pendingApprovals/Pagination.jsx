import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

/** Which page-number buttons to show - always first, last, current +/-1, with "…" gaps instead of every page for large totals. */
function getPageNumbers(current, totalPages) {
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

/**
 * Pagination.jsx
 * ---------------
 * "Showing X to Y of Z results" + page number buttons + a rows-per-page
 * selector, wired to the backend's page/limit params (see
 * services/escalationStore.js / proposalStore.js on the server side -
 * this was already fully supported by the API, just missing a UI for it).
 */
export default function Pagination({ page, limit, total, onPageChange, onLimitChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--navy-rgb)/0.06)] px-3 py-2.5 text-xs text-[var(--muted)]">
      <span>
        Showing {start} to {end} of {total} results
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          {pageNumbers.map((p, i) => {
            const prev = pageNumbers[i - 1];
            const gap = prev != null && p - prev > 1;
            return (
              <span key={p} className="flex items-center gap-1">
                {gap && <span className="px-1">…</span>}
                <button
                  onClick={() => onPageChange(p)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold"
                  style={
                    p === page
                      ? { background: "rgb(var(--violet-rgb)/1)", color: "#fff" }
                      : { color: "var(--muted)" }
                  }
                >
                  {p}
                </button>
              </span>
            );
          })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <label className="flex items-center gap-1.5">
          Rows per page:
          <span className="relative">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="appearance-none rounded-lg border border-[rgb(var(--navy-rgb)/0.1)] bg-white py-1 pl-2 pr-6 text-xs font-medium text-[var(--navy)]"
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>
      </div>
    </div>
  );
}
