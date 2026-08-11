import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { fetchTicketThread, generateDraft } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";
import OrderDetailsGrid from "../components/OrderDetailsGrid.jsx";
import EditableDraft from "../components/EditableDraft.jsx";
import AnalysisPills from "../components/AnalysisPills.jsx";
import AiContextPanel from "../components/AiContextPanel.jsx";
import { buildCustomerMessageCases } from "../threadPairing.js";
import { dateGateOrderFacts } from "../orderFacts.js";

/** The full message thread for one ticket. The left column lists every message; clicking a
 * customer message selects it as the active case for the right-hand "Generate with AI" panel,
 * which stays put as the user moves between messages - same pattern as the real CRM's
 * "Self Assign" panel, just swapped for our AI generation flow. */

export default function TicketDetail({ threadId, onBack }) {
  const [messages, setMessages] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [threadMeta, setThreadMeta] = useState(null);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState("");
  // Results keyed by customer message seq, so each generation is independent.
  const [results, setResults] = useState({});
  const [generatingKey, setGeneratingKey] = useState(null);
  // Which customer message the right-hand panel is currently showing.
  const [selectedSeq, setSelectedSeq] = useState(null);

  useEffect(() => {
    setSelectedSeq(null);
    setResults({});
    fetchTicketThread(threadId)
      .then((data) => {
        setMessages(data.messages);
        setOrder(data.order || null);
        setOrderId(data.order_id || null);
        setThreadMeta(data.thread_meta || null);
      })
      .catch((err) => setError(err.message));
  }, [threadId]);

  const customerCases = messages ? buildCustomerMessageCases(messages) : [];
  const caseBySeq = Object.fromEntries(customerCases.map((c) => [c.seq, c]));

  // Default the panel to the most recent customer message once the thread loads.
  useEffect(() => {
    if (selectedSeq === null && customerCases.length > 0) {
      setSelectedSeq(customerCases[customerCases.length - 1].seq);
    }
  }, [customerCases, selectedSeq]);

  const selectedCase = selectedSeq !== null ? caseBySeq[selectedSeq] : null;
  const selectedResult = selectedSeq !== null ? results[selectedSeq] : null;
  const isGenerating = generatingKey === selectedSeq;

  async function handleGenerate() {
    if (!selectedCase) return;
    const key = selectedCase.seq;
    setGeneratingKey(key);
    setError(null);
    try {
      // No internal_status_note - proven unreliable against real threads, no longer trusted as input.
      // Time-sensitive facts (shipping, refund) are only date-gated for messages that
      // already have a real reply on record (historical, used for comparison) - otherwise
      // a reply from before a later refund would see that refund as if it already happened.
      // A message still awaiting a reply is being drafted today, so today's facts apply -
      // no gating (e.g. a refund issued after the customer's message but before today).
      const messageDateForGating = selectedCase.realReplies.length > 0 ? selectedCase.messageDate : null;
      const orderFacts = order ? dateGateOrderFacts(order.customer_safe, messageDateForGating) : null;
      // Only the customer's own prior messages - agent replies are excluded from history.
      const customerOnlyHistory = selectedCase.context.threadHistory.filter((m) => m.direction === "in");
      const response = await generateDraft({
        ...selectedCase.context,
        threadHistory: customerOnlyHistory,
        orderFacts,
        language,
        threadId,
        seq: key,
        cancellationMarked: threadMeta?.cancellation_marked,
        threadReason: threadMeta?.thread_reason,
      });
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
        <div>
          <h2 className="text-xl font-semibold">Thread {threadId}</h2>
          {orderId && <p className="text-sm text-[var(--muted)]">Order {orderId}</p>}
        </div>
        <div className="w-56">
          <LanguageInput value={language} onChange={setLanguage} />
        </div>
      </div>

      {error && (
        <div className="executive-card-soft p-4 text-sm text-[var(--executive-error)]">{error}</div>
      )}

      {!messages && !error && <p className="text-sm text-[var(--muted)]">Loading thread...</p>}

      {messages && (
        <OrderDetailsGrid orderId={orderId} customerSafe={order?.customer_safe} internal={order?.internal} />
      )}

      {messages && (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Conversation</h3>
            {messages.map((message) => {
              const isCustomer = message.direction === "in";
              const messageCase = isCustomer ? caseBySeq[message.seq] : null;
              const isSelected = isCustomer && selectedSeq === message.seq;
              // The customer's own marketplace relay address, real (from the Order API) -
              // shown as "From:" on their messages and "To:" on ours, same as the real CRM.
              const relayEmail = order?.internal?.email || null;

              return (
                <div
                  key={`${message.direction}-${message.seq}`}
                  onClick={() => messageCase && setSelectedSeq(message.seq)}
                  // .executive-card-soft sets its own background/border as plain class rules,
                  // which beat same-specificity Tailwind utilities in the cascade - inline
                  // style always wins, so this actually renders. Solid theme colors (not a
                  // translucent tint) so the page's background blobs can't bleed through and
                  // muddy them.
                  style={{
                    background: isCustomer ? "#ffffff" : "var(--mist)",
                    borderLeft: `4px solid ${isCustomer ? "var(--lavender)" : "var(--violet)"}`,
                  }}
                  className={`executive-card-soft p-4 ${messageCase ? "cursor-pointer" : ""} ${
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
                  <MessageText text={message.text} />
                </div>
              );
            })}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Generate with AI</h3>

            {!selectedCase && (
              <div className="executive-card-soft p-4 text-sm text-[var(--muted)]">
                No customer message to reply to yet.
              </div>
            )}

            {selectedCase && (
              <>
                <div className="executive-card-soft p-6">
                  <p className="mb-4 text-xs text-[var(--muted)]">
                    Replying to the customer message from {selectedCase.messageDate || "this thread"}.
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`brand-button w-full justify-center px-4 py-3.5 text-sm transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isGenerating ? "" : "ai-cta-glow hover:scale-[1.02]"
                    }`}
                  >
                    <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} />
                    {isGenerating ? "Generating..." : selectedResult ? "Regenerate AI Reply" : "Generate AI Reply"}
                  </button>
                </div>

                {selectedResult && (
                  <div className="space-y-3">
                    {selectedCase.realReplies.length > 0 && (
                      <div className="executive-card p-5">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                          What was actually sent (CRM)
                        </h3>
                        <div className="space-y-3">
                          {selectedCase.realReplies.map((text, i) => (
                            <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
                              {text}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <EditableDraft
                      threadId={threadId}
                      seq={String(selectedCase.seq)}
                      draftReply={selectedResult.draft_reply}
                    />
                    <AnalysisPills analysis={selectedResult.analysis} />
                    <AiContextPanel
                      context={selectedResult.context}
                      systemPromptVersion={selectedResult.system_prompt_version}
                      threadMeta={threadMeta}
                      reasoning={selectedResult.analysis?.reasoning}
                      policyApplied={selectedResult.analysis?.policy_applied}
                      fieldsUsed={selectedResult.analysis?.fields_used}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
