import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchTicketThread, generateDraft } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import ConversationMessage from "../components/ConversationMessage.jsx";
import OrderDetailsGrid from "../components/OrderDetailsGrid.jsx";
import GenerateWithAiPanel from "../components/GenerateWithAiPanel.jsx";
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

              return (
                <ConversationMessage
                  key={`${message.direction}-${message.seq}`}
                  message={message}
                  // The customer's own marketplace relay address, real (from the Order
                  // API) - shown as "From:" on their messages and "To:" on ours, same
                  // as the real CRM.
                  relayEmail={order?.internal?.email || null}
                  selectable={!!messageCase}
                  isSelected={isSelected}
                  onClick={() => messageCase && setSelectedSeq(message.seq)}
                />
              );
            })}
          </div>

          <GenerateWithAiPanel
            selectedCase={selectedCase}
            selectedResult={selectedResult}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            threadId={threadId}
            threadMeta={threadMeta}
          />
        </div>
      )}
    </div>
  );
}
