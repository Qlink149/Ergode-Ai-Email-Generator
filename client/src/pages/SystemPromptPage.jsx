import { useEffect, useState } from "react";
import { Save, CheckCircle2, FileText, AlertCircle, History, Lock } from "lucide-react";
import { fetchSystemPrompt, saveSystemPrompt } from "../api.js";
import PromptVersionHistory from "../components/PromptVersionHistory.jsx";
import { useAuth, can } from "../auth.js";

/**
 * SystemPromptPage.jsx
 * ---------------------
 * View and edit the live system prompt. Loading and saving both go
 * straight to MongoDB's "system_prompts" collection from the Node server
 * (server/services/systemPromptStore.js) - no Python hop. Because
 * draft_generator.py reads the latest version fresh from that same
 * collection on every call, the very next "Generate with AI" request uses
 * the edited version - nothing else needs restarting.
 */

export default function SystemPromptPage() {
  const { me } = useAuth();
  const canEdit = can(me, "editSystemPrompt");
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [view, setView] = useState("editor");

  function loadCurrentPrompt() {
    setLoading(true);
    fetchSystemPrompt()
      .then((data) => {
        setContent(data.content);
        setSavedContent(data.content);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCurrentPrompt();
  }, []);

  const isDirty = content !== savedContent;
  const lineCount = content ? content.split("\n").length : 0;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await saveSystemPrompt(content);
      setSavedContent(content);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
          >
            <FileText size={18} />
          </span>
          <h2 className="text-xl font-semibold leading-tight">System Prompt</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("editor")}
            className={view === "editor" ? "brand-button px-3 py-1.5 text-xs" : "brand-button-ghost px-3 py-1.5 text-xs"}
          >
            <FileText size={13} />
            Editor
          </button>
          <button
            onClick={() => setView("history")}
            className={view === "history" ? "brand-button px-3 py-1.5 text-xs" : "brand-button-ghost px-3 py-1.5 text-xs"}
          >
            <History size={13} />
            History
          </button>
        </div>
      </div>

      {view === "history" && <PromptVersionHistory onRestored={loadCurrentPrompt} />}

      {view === "editor" && loading && (
        <div className="executive-card space-y-3 p-5">
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-[rgb(var(--navy-rgb)/0.08)]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[rgb(var(--navy-rgb)/0.05)]" />
        </div>
      )}

      {view === "editor" && !loading && (
        <div className="executive-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] px-5 py-3">
            <span className="font-mono text-xs text-[var(--muted)]">system-prompt.md</span>
            <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
              {lineCount} lines
              {isDirty && (
                <span className="flex items-center gap-1 font-medium text-[var(--warning)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Unsaved changes
                </span>
              )}
            </span>
          </div>

          <div className="p-5 pb-0">
            <textarea
              className="brand-input w-full rounded-lg px-3 py-2 font-mono text-xs leading-relaxed"
              rows={28}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={!canEdit}
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            {canEdit ? (
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save changes"}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
                <Lock size={14} />
                Read-only - you don't have permission to edit the system prompt.
              </span>
            )}

            {justSaved && (
              <span className="flex items-center gap-1.5 text-sm text-[var(--executive-success)]">
                <CheckCircle2 size={16} />
                Saved - next generation will use this version.
              </span>
            )}

            {error && (
              <span className="flex items-center gap-1.5 text-sm text-[var(--executive-error)]">
                <AlertCircle size={16} />
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
