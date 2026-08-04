import { useEffect, useState } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import { fetchSystemPrompt, saveSystemPrompt } from "../api.js";

/**
 * SystemPromptPage.jsx
 * ---------------------
 * View and edit the live system prompt. Saving writes straight back to
 * docs/ergode_email_system_prompt.md through the pipeline service, and
 * because draft_generator.py reads that file fresh on every call, the
 * very next "Generate with AI" request uses the edited version - nothing
 * else needs restarting.
 */

export default function SystemPromptPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetchSystemPrompt()
      .then((data) => setContent(data.content))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await saveSystemPrompt(content);
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
      <div>
        <h2 className="text-xl font-semibold">System Prompt</h2>
        <p className="text-sm text-[var(--muted)]">
          This is the exact instruction set the AI uses to write every draft - tone, templates,
          policies, language rules. Edit and save to change it immediately, no restart needed.
        </p>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading current prompt...</p>}

      {!loading && (
        <div className="executive-card space-y-3 p-5">
          <textarea
            className="brand-input w-full rounded-lg px-3 py-2 font-mono text-xs leading-relaxed"
            rows={28}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save changes"}
            </button>

            {justSaved && (
              <span className="flex items-center gap-1.5 text-sm text-[var(--executive-success)]">
                <CheckCircle2 size={16} />
                Saved - next generation will use this version.
              </span>
            )}
          </div>

          {error && <p className="text-sm text-[var(--executive-error)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
