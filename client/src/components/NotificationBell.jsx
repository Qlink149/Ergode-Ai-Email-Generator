import { useEffect, useState } from "react";
import { Bell, ListChecks, ShieldAlert } from "lucide-react";
import { fetchNotificationsSummary } from "../api.js";

const POLL_INTERVAL_MS = 45000;

/**
 * NotificationBell.jsx
 * -----------------------
 * Lives inline in AppShell.jsx's header (already sticky/z-50, so a
 * dropdown rendered as a normal child here already outranks <main> - no
 * portal needed, unlike CommentsSidebar.jsx). Polls the triage agent's
 * unread counts (pending prompt-fix proposals + unseen escalations, see
 * pipeline/api.py's /notifications/summary) - this is the first polling
 * code in the app, since there's no push/websocket infra to do better.
 *
 * Opening the dropdown does NOT clear the escalation count - only
 * actually viewing the Escalations section on PendingApprovalsPage does
 * that (see its markEscalationsSeen call). This is just a summary.
 */
export default function NotificationBell({ onNavigateToApprovals }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [open, setOpen] = useState(false);

  function refresh() {
    fetchNotificationsSummary()
      .then((data) => {
        setPendingCount(data.pending_proposals_count || 0);
        setUnseenCount(data.unseen_escalations_count || 0);
      })
      .catch(() => {
        // Best-effort - a failed poll just leaves the last known counts showing.
      });
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const total = pendingCount + unseenCount;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[rgb(var(--navy-rgb)/0.06)]"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: "var(--danger)" }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--danger)" }} />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="executive-glass absolute right-0 top-full z-50 mt-2 w-80 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Notifications
            </p>
            {total === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nothing needs your attention right now.</p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    onNavigateToApprovals?.();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm hover:bg-[rgb(var(--navy-rgb)/0.05)] disabled:cursor-default disabled:opacity-40"
                  disabled={pendingCount === 0}
                >
                  <ListChecks size={16} className="shrink-0 text-[var(--royal)]" />
                  <span>
                    <span className="font-semibold">{pendingCount}</span> prompt{" "}
                    {pendingCount === 1 ? "fix" : "fixes"} awaiting approval
                  </span>
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onNavigateToApprovals?.();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm hover:bg-[rgb(var(--navy-rgb)/0.05)] disabled:cursor-default disabled:opacity-40"
                  disabled={unseenCount === 0}
                >
                  <ShieldAlert size={16} className="shrink-0 text-[var(--danger)]" />
                  <span>
                    <span className="font-semibold">{unseenCount}</span> new escalation
                    {unseenCount === 1 ? "" : "s"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
