import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, RotateCcw, CheckCircle2 } from "lucide-react";
import { fetchSystemPromptVersions, saveSystemPrompt } from "../api.js";

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function VersionCard({ version, index, isCurrent, onRestored }) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [justRestored, setJustRestored] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    setRestoreError(null);
    try {
      await saveSystemPrompt(version.content);
      setJustRestored(true);
      onRestored?.();
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div
      className="triage-item-in executive-card-soft space-y-2 p-4"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={15} className="shrink-0 text-[var(--muted)]" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-[var(--muted)]" />
          )}
          <span className="font-mono text-sm font-semibold">v{version.version}</span>
          {isCurrent && <span className="pill pill-success">Current</span>}
        </div>
        <span className="text-xs text-[var(--muted)]">{formatTimestamp(version.updated_at)}</span>
      </button>

      {!expanded && (
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">
          {version.content.slice(0, 220)}
          {version.content.length > 220 ? "…" : ""}
        </p>
      )}

      {version.source === "proposal" && (
        <p className="text-xs text-[var(--violet)]">
          From a Prompt Fix Proposal
          {version.source_comment_id ? " · triggered by a comment" : ""} · approved into the live prompt
        </p>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
          <pre className="brand-input max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-lg px-3 py-2 font-mono text-xs leading-relaxed">
            {version.content}
          </pre>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRestore}
              disabled={restoring || isCurrent}
              className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={13} />
              {restoring ? "Restoring..." : isCurrent ? "Already current" : `Restore v${version.version}`}
            </button>
            {justRestored && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--executive-success)]">
                <CheckCircle2 size={14} />
                Restored - now live.
              </span>
            )}
            {restoreError && <span className="text-xs text-[var(--executive-error)]">{restoreError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PromptVersionHistory.jsx
 * --------------------------
 * Every past system-prompt version, newest first - shown inside
 * SystemPromptPage.jsx when its Editor/History toggle is on History.
 * Versions saved by an approved triage-agent proposal (source: "proposal",
 * see pipeline/prompt_proposal_store.py's approve_proposal()) carry an
 * attribution line; a manual save from this page's own editor doesn't.
 *
 * Click a version to see its full text. "Restore" saves that old text as
 * a brand-new latest version via the same saveSystemPrompt() a manual
 * edit uses - nothing is deleted or overwritten, the old version stays in
 * history too, exactly like every other save this page has ever done.
 */
export default function PromptVersionHistory({ onRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    fetchSystemPromptVersions()
      .then((data) => setVersions(data.versions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleRestored() {
    load();
    onRestored?.();
  }

  if (loading) {
    return (
      <div className="executive-card space-y-3 p-5">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-[rgb(var(--navy-rgb)/0.08)]" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-[rgb(var(--navy-rgb)/0.05)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="executive-card-soft flex items-center gap-2 p-4 text-sm text-[var(--executive-error)]">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v, i) => (
        <VersionCard key={v._id} version={v} index={i} isCurrent={i === 0} onRestored={handleRestored} />
      ))}
    </div>
  );
}
