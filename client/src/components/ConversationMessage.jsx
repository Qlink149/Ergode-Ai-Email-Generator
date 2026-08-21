import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import MessageText from "./MessageText.jsx";
import { translateMessage } from "../api.js";

/**
 * One message in a conversation thread - used by OrderLookupPage.jsx to
 * render an email-style block (From:/To: header with the real relay
 * address, timestamp, direction-colored background).
 *
 * Every message (customer or agent/CRM) gets an on-demand "Translate"
 * toggle - a real OpenAI call, so it only fires on click, never
 * automatically for every message on page load.
 */
export default function ConversationMessage({ message, relayEmail, selectable, isSelected, onClick }) {
  const [translated, setTranslated] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [checkedAlreadyEnglish, setCheckedAlreadyEnglish] = useState(false);

  const isCustomer = message.direction === "in";

  async function handleTranslate(e) {
    e.stopPropagation();
    if (translating || !message.text) return;
    setTranslating(true);
    try {
      const result = await translateMessage(message.text);
      setTranslated(result);
      setCheckedAlreadyEnglish(result === null);
    } catch {
      // Best-effort - the original text stays visible either way.
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: isCustomer ? "#ffffff" : "var(--mist)",
        borderLeft: `4px solid ${isCustomer ? "var(--lavender)" : "var(--violet)"}`,
      }}
      className={`executive-card-soft p-4 ${selectable ? "cursor-pointer" : ""} ${
        isSelected ? "ring-2 ring-[rgb(var(--violet-rgb)/0.5)]" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-[rgb(var(--navy-rgb)/0.08)] pb-2">
        <div className="text-xs leading-relaxed">
          <p>
            <span className="font-semibold">{isCustomer ? "From: " : "To: "}</span>
            {relayEmail || "unknown"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-[var(--muted)]">
              {isCustomer ? "Customer" : "Us (agent)"}
            </span>
            {message.is_relay && <span className="pill pill-danger">relayed by marketplace</span>}
            {message.order_id && <span className="pill pill-neutral">{message.order_id}</span>}
            {isSelected && <span className="pill pill-neutral">selected</span>}
          </div>
        </div>
        {message.created_time && (
          <span className="shrink-0 text-xs text-[var(--muted)]">{message.created_time}</span>
        )}
      </div>

      {message.text ? (
        <MessageText text={message.text} />
      ) : (
        <span className="italic text-[var(--executive-error)]">
          (no text returned by the CRM API for this message)
        </span>
      )}

      {message.text && (
        <div className="mt-2">
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="flex items-center gap-1 text-xs font-medium text-[var(--violet)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
            {translating ? "Translating..." : "Translate to English"}
          </button>

          {translated && (
            <div className="mt-2 rounded-lg border border-[rgb(var(--violet-rgb)/0.15)] bg-[rgb(var(--violet-rgb)/0.04)] p-2.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--violet)]">
                English translation
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{translated}</p>
            </div>
          )}
          {checkedAlreadyEnglish && !translated && (
            <p className="mt-1 text-xs text-[var(--muted)]">Already in English.</p>
          )}
        </div>
      )}
    </div>
  );
}
