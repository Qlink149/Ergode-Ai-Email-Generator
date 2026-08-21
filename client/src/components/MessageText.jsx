import { Bot } from "lucide-react";

/**
 * MessageText.jsx
 * -----------------
 * Renders one message's text. Plain customer/agent text renders as-is.
 *
 * Structured Amazon notices (see server/services/messageCleaner.js's
 * return-authorization / cancellation / A-to-z-claim detection) come
 * through as a "[Amazon system notice: ...]" tag followed by detail lines -
 * that bracket notation is meant for the AI's context, not for a human
 * reading the thread, so it gets rendered as a distinct labeled card here
 * instead of a raw bracketed string. Used anywhere a message body is
 * shown in OrderLookupPage.jsx.
 */

const SYSTEM_NOTICE_PATTERN = /^\[Amazon system notice:\s*([^\]]+)\]\n?/;

export default function MessageText({ text }) {
  const match = text?.match(SYSTEM_NOTICE_PATTERN);

  if (!match) {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
  }

  const noticeType = match[1];
  const details = text.slice(match[0].length).trim();

  return (
    <div className="rounded-xl border border-[rgb(var(--navy-rgb)/0.1)] bg-[rgb(var(--navy-rgb)/0.03)] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <Bot size={14} />
        Amazon system notice — {noticeType}
      </div>
      {details && <p className="whitespace-pre-wrap text-sm leading-relaxed">{details}</p>}
    </div>
  );
}
