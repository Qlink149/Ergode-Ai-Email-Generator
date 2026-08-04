/**
 * LanguageInput.jsx
 * ------------------
 * Lets someone pick a reply language, or leave it blank to auto-detect
 * from the customer's message (the default, and what the system prompt
 * already does on its own). Built as a text input with suggestions
 * rather than a fixed dropdown, so it supports "any language," not just
 * a preset list - typing a language not in the list still works.
 */

const COMMON_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Portuguese",
  "Italian",
  "Arabic",
  "Hindi",
  "Chinese",
  "Japanese",
];

export default function LanguageInput({ value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Reply language
      </label>
      <input
        list="ergode-language-options"
        className="brand-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Auto-detect from the customer's message"
      />
      <datalist id="ergode-language-options">
        {COMMON_LANGUAGES.map((lang) => (
          <option key={lang} value={lang} />
        ))}
      </datalist>
    </div>
  );
}
