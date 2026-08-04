/**
 * SideBySideReplies.jsx
 * -----------------------
 * The "what was actually sent vs. what our AI generated" pair of cards.
 * Used by the Comparison Report page (against historical zip data) and
 * the Ticket Queue detail page (against a live thread) - one component so
 * both places always look and behave the same, and a future feature that
 * needs this same comparison doesn't have to rebuild it.
 */

function ReplyColumn({ title, text }) {
  return (
    <div className="executive-card p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export default function SideBySideReplies({ realReply, draftReply, realTitle, draftTitle }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReplyColumn title={realTitle || "What was actually sent"} text={realReply} />
      <ReplyColumn title={draftTitle || "What our AI generated"} text={draftReply} />
    </div>
  );
}
