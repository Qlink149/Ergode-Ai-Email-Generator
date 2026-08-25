/**
 * SnapshotBlock.jsx
 * -------------------
 * One labeled text block - "Customer said" / "AI replied" style. Shared
 * by CommentsSidebar.jsx and PendingApprovalsPage.jsx so a captured
 * customer message / AI reply always reads the same way wherever it's
 * shown.
 */
export default function SnapshotBlock({ label, text, tone }) {
  if (!text) return null;
  const toneClasses =
    tone === "violet"
      ? "border-[rgb(var(--violet-rgb)/0.18)] bg-[rgb(var(--violet-rgb)/0.05)]"
      : "border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)]";
  const labelClass = tone === "violet" ? "text-[var(--violet)]" : "text-[var(--muted)]";

  return (
    <div className={`min-w-0 rounded-lg border p-2.5 ${toneClasses}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
    </div>
  );
}
