import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { fetchTicketThread, generateDraft } from "../api.js";
import SideBySideReplies from "../components/SideBySideReplies.jsx";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";

/**
 * TicketDetail.jsx
 * -----------------
 * The full message thread for one ticket, in order, plus a "Generate AI
 * Reply" action.
 *
 * If this ticket already has a real reply (an agent already answered the
 * last customer message), generating shows our AI's version next to what
 * was actually sent - the same side-by-side comparison as the Comparison
 * Report tab, just on a live ticket instead of historical batch data. If
 * the ticket is still awaiting a reply, there's nothing to compare against
 * yet, so only the AI draft is shown - this is the actual "help me answer
 * this" use case.
 */

function MessageBubble({ message }) {
  const isCustomer = message.direction === "in";
  return (
    <div className={`executive-card-soft p-4 ${isCustomer ? "" : "bg-[rgb(var(--violet-rgb)/0.04)]"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {isCustomer ? "Customer" : "Us (agent)"}
        </span>
        {message.is_relay && <span className="pill pill-danger">relayed by marketplace</span>}
        {message.order_id && <span className="pill pill-neutral">{message.order_id}</span>}
      </div>
      <MessageText text={message.text} />
    </div>
  );
}

/**
 * Split a thread into: the customer message to answer, everything said
 * before it (history), and - if one already exists - the real reply that
 * was sent. Mirrors the pairing logic in pipeline/context_builder.py:
 * the "reply we're recreating" is the last outbound message (if any), its
 * trigger is the nearest customer message before it, and history is
 * everything else before that reply - including any earlier reply already
 * sent on this thread (e.g. an acknowledgment before a detailed follow-up).
 * Dropping that earlier reply from history was the bug that made the AI
 * draft look like a first response when comparing against a second one.
 */
function analyzeThread(messages) {
  const lastMessage = messages[messages.length - 1];
  const hasRealReply = lastMessage.direction === "out";

  // Everything before the reply we're recreating (or, if nothing has been
  // sent yet, every message so far).
  const beforeTarget = hasRealReply ? messages.slice(0, -1) : messages;

  const lastInIndex = [...beforeTarget].map((m) => m.direction).lastIndexOf("in");
  if (lastInIndex === -1) return null;

  const trigger = beforeTarget[lastInIndex];
  const history = beforeTarget
    .filter((_, idx) => idx !== lastInIndex)
    .map((m) => ({ direction: m.direction, text: m.text }));

  return {
    context: {
      customerMessage: trigger.text,
      orderId: trigger.order_id,
      isRelay: trigger.is_relay,
      threadHistory: history,
    },
    realReply: hasRealReply ? lastMessage.text : null,
  };
}

export default function TicketDetail({ threadId, onBack }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchTicketThread(threadId)
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message));
  }, [threadId]);

  const analysis = messages ? analyzeThread(messages) : null;

  async function handleGenerate() {
    if (!analysis) return;
    setGenerating(true);
    setResult(null);
    try {
      const response = await generateDraft({ ...analysis.context, language });
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="brand-button-ghost px-4 py-2 text-sm" style={{ borderRadius: "999px" }}>
        <ArrowLeft size={16} />
        Back to ticket queue
      </button>

      <h2 className="text-xl font-semibold">Thread {threadId}</h2>

      {error && (
        <div className="executive-card-soft p-4 text-sm text-[var(--executive-error)]">{error}</div>
      )}

      {!messages && !error && <p className="text-sm text-[var(--muted)]">Loading thread...</p>}

      {messages && (
        <>
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={`${message.direction}-${message.seq}`} message={message} />
            ))}
          </div>

          <div className="executive-card flex flex-wrap items-end gap-3 p-5">
            <div className="min-w-[220px] flex-1">
              <LanguageInput value={language} onChange={setLanguage} />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={16} />
              {generating ? "Generating..." : "Generate AI Reply"}
            </button>
          </div>

          {result && (
            <>
              {analysis.realReply ? (
                <SideBySideReplies
                  realReply={analysis.realReply}
                  draftReply={result.draft_reply}
                  realTitle="What was actually sent (CRM)"
                  draftTitle="What our AI generated"
                />
              ) : (
                <div className="executive-card p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                    AI-drafted reply
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.draft_reply}</p>
                </div>
              )}

              <div className="executive-card p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                  AI analysis
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className="pill pill-neutral">sentiment: {result.analysis.sentiment}</span>
                  <span className="pill pill-neutral">urgency: {result.analysis.urgency}</span>
                  <span className="pill pill-neutral">
                    confidence: {Math.round((result.analysis.confidence ?? 0) * 100)}%
                  </span>
                  <span
                    className={`pill ${result.analysis.needs_human_review ? "pill-danger" : "pill-success"}`}
                  >
                    {result.analysis.needs_human_review ? "needs human review" : "low risk"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{result.analysis.review_reason}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
