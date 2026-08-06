import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { fetchTicketThread, generateDraft } from "../api.js";
import SideBySideReplies from "../components/SideBySideReplies.jsx";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";
import { buildReplyCases, buildLatestCase } from "../threadPairing.js";

/**
 * TicketDetail.jsx
 * -----------------
 * The full message thread for one ticket, in order. Every "Us (agent)"
 * reply gets its own "Generate" button, right under that message - click
 * it and the AI redrafts that exact reply (using only what was known up
 * to that point, via threadPairing.js) and shows it side-by-side with
 * what was actually sent. This is the same idea as the Comparison Report
 * tab, just usable on any live ticket, at any point in its history, not
 * only the batch dataset.
 *
 * If the thread's last message is still unanswered, a separate section at
 * the bottom lets you generate the NEXT reply - the one that doesn't
 * exist yet - since there's no "Us (agent)" message to attach that button
 * to.
 */

function AnalysisPills({ analysis }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="pill pill-neutral">sentiment: {analysis.sentiment}</span>
      <span className="pill pill-neutral">urgency: {analysis.urgency}</span>
      <span className="pill pill-neutral">confidence: {Math.round((analysis.confidence ?? 0) * 100)}%</span>
      <span className={`pill ${analysis.needs_human_review ? "pill-danger" : "pill-success"}`}>
        {analysis.needs_human_review ? "needs human review" : "low risk"}
      </span>
      <span className="basis-full text-xs text-[var(--muted)]">{analysis.review_reason}</span>
    </div>
  );
}

export default function TicketDetail({ threadId, onBack }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState("");
  // Results are keyed by seq number (or "latest" for the not-yet-answered
  // case) so every reply's regeneration is independent of the others.
  const [results, setResults] = useState({});
  const [generatingKey, setGeneratingKey] = useState(null);

  useEffect(() => {
    fetchTicketThread(threadId)
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message));
  }, [threadId]);

  const replyCases = messages ? buildReplyCases(messages) : [];
  const replyCaseBySeq = Object.fromEntries(replyCases.map((c) => [c.seq, c]));

  const awaitingReply = messages && messages[messages.length - 1].direction === "in";
  const latestCase = awaitingReply ? buildLatestCase(messages) : null;

  async function handleGenerate(key, context) {
    setGeneratingKey(key);
    setError(null);
    try {
      // Context here is drawn from the thread's own data only (the
      // customer message, order id, and prior messages) - no live Order
      // API call. threadId/seq get this generation written back to
      // ai_drafts against the thread it belongs to (see draft_store.py).
      const response = await generateDraft({ ...context, language, threadId, seq: key });
      setResults((prev) => ({ ...prev, [key]: response }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="brand-button-ghost px-4 py-2 text-sm" style={{ borderRadius: "999px" }}>
        <ArrowLeft size={16} />
        Back to ticket queue
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Thread {threadId}</h2>
        <div className="w-56">
          <LanguageInput value={language} onChange={setLanguage} />
        </div>
      </div>

      {error && (
        <div className="executive-card-soft p-4 text-sm text-[var(--executive-error)]">{error}</div>
      )}

      {!messages && !error && <p className="text-sm text-[var(--muted)]">Loading thread...</p>}

      {messages && (
        <div className="space-y-3">
          {messages.map((message) => {
            const isCustomer = message.direction === "in";
            const replyCase = !isCustomer ? replyCaseBySeq[message.seq] : null;
            const result = replyCase ? results[replyCase.seq] : null;
            const isGenerating = generatingKey === replyCase?.seq;

            return (
              <div key={`${message.direction}-${message.seq}`}>
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

                {/* Regenerate button lives under each agent reply - not
                    just the last one, so any point in the thread's
                    history can be re-drafted and compared. */}
                {replyCase && (
                  <div className="ml-4 mt-2 border-l-2 border-[rgb(var(--navy-rgb)/0.1)] pl-4">
                    <button
                      onClick={() => handleGenerate(replyCase.seq, replyCase.context)}
                      disabled={isGenerating}
                      className="brand-button-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      {isGenerating ? "Generating..." : "What would AI have said here?"}
                    </button>

                    {result && (
                      <div className="mt-3 space-y-3">
                        <SideBySideReplies
                          realReply={replyCase.realReply}
                          draftReply={result.draft_reply}
                          realTitle="What was actually sent (CRM)"
                          draftTitle="What our AI generated"
                        />
                        <AnalysisPills analysis={result.analysis} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* No reply exists yet for the last customer message - this is
              the live "help me answer this" case, distinct from
              regenerating history above. */}
          {latestCase && (
            <div className="executive-card space-y-3 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                This thread is awaiting a reply
              </h3>
              <button
                onClick={() => handleGenerate("latest", latestCase.context)}
                disabled={generatingKey === "latest"}
                className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} />
                {generatingKey === "latest" ? "Generating..." : "Generate AI Reply"}
              </button>

              {results.latest && (
                <div className="space-y-3">
                  <div className="executive-card p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      AI-drafted reply
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {results.latest.draft_reply}
                    </p>
                  </div>
                  <AnalysisPills analysis={results.latest.analysis} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
