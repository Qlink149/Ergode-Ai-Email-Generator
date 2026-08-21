import { useEffect, useState } from "react";
import { Search, MessageSquare, Package, AlertCircle, Loader2, Inbox } from "lucide-react";
import { fetchOrderLookup, generateDraft } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import ConversationMessage from "../components/ConversationMessage.jsx";
import OrderDetailsGrid from "../components/OrderDetailsGrid.jsx";
import GenerateWithAiPanel from "../components/GenerateWithAiPanel.jsx";
import CommentsSidebar from "../components/CommentsSidebar.jsx";
import { buildCustomerMessageCases } from "../threadPairing.js";
import { dateGateOrderFacts } from "../orderFacts.js";

/**
 * OrderLookupPage.jsx
 * ---------------------
 * Look up one order by id against the real, live Order API and CRM
 * Thread API (server/routes/orderLookup.js), then generate an AI reply
 * grounded in those real facts - same two-column, click-a-message
 * architecture as TicketDetail.jsx (conversation on the left, a persistent
 * "Generate with AI" panel on the right that follows whichever message is
 * selected), just against a live lookup instead of a synced ticket.
 *
 * The CRM Thread API's messages come back newest-first with different
 * field names (message_type/message_body) than our zip-derived shape
 * (direction/text/seq) - normalizeThreadMessages() below is the one place
 * that translates between them.
 */

function normalizeThreadMessages(emailSummary, orderId) {
  return [...emailSummary]
    .reverse() // API returns newest-first; we want chronological order
    .map((m, i) => ({
      seq: i + 1,
      direction: m.message_type === "message_in" ? "in" : "out",
      // The server already decodes HTML entities, strips Amazon boilerplate
      // down to the customer's actual words, and detects relay messages -
      // see server/routes/orderLookup.js's cleanThread(), same cleaning
      // pass the ticket queue's sync applies.
      text: m.message_body,
      order_id: orderId,
      is_relay: m.is_relay || false,
      created_time: m.created_time || null,
    }));
}

/** True if at least one inbound message actually has usable text. */
function hasUsableCustomerText(messages) {
  return messages.some((m) => m.direction === "in" && m.text);
}

export default function OrderLookupPage() {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [language, setLanguage] = useState("");
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  // Results keyed by customer message seq, so each generation is independent -
  // same pattern as TicketDetail.jsx.
  const [results, setResults] = useState({});
  const [generatingKey, setGeneratingKey] = useState(null);
  const [error, setError] = useState(null);
  // Which customer message the right-hand panel is currently showing.
  const [selectedSeq, setSelectedSeq] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  async function handleLookup() {
    if (!orderIdInput.trim()) return;
    setLoading(true);
    setError(null);
    setLookup(null);
    setResults({});
    setSelectedSeq(null);
    try {
      const data = await fetchOrderLookup(orderIdInput.trim());
      setLookup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // No internal_status_note (reasoning_status) - same as TicketDetail.jsx,
  // proven unreliable against real threads, never sent to the AI.
  const orderFacts = lookup ? { ...lookup.order.customer_safe } : null;
  // Same shape TicketDetail.jsx passes to AiContextPanel - shown in the "Show AI
  // context" panel so thread_reason/cancellation_marked are visible there too,
  // not just sent silently to the model.
  const threadMeta = lookup?.thread
    ? {
        thread_reason: lookup.thread.thread_reason ?? null,
        cancellation_marked: lookup.thread.cancellation_marked ?? null,
        order_details: lookup.thread.order_details ?? [],
      }
    : null;
  // The CRM Thread API's own thread_id, if it came back - falls back to the
  // order id so a draft can still be saved/edited even when the thread
  // fetch failed (needsManualMessage's case). Same key ai_drafts is keyed
  // by for TicketDetail.jsx's synced tickets.
  const threadIdForDrafts = lookup ? lookup.thread?.thread_id || lookup.order_id : null;

  const needsManualMessage =
    lookup &&
    (lookup.thread_error ||
      !hasUsableCustomerText(normalizeThreadMessages(lookup.thread?.email_summary || [], lookup.order_id)));

  const messages =
    lookup && !needsManualMessage ? normalizeThreadMessages(lookup.thread.email_summary, lookup.order_id) : [];
  const customerCases = buildCustomerMessageCases(messages);
  const caseBySeq = Object.fromEntries(customerCases.map((c) => [c.seq, c]));

  // Default the panel to the most recent customer message once a lookup loads - same pattern as TicketDetail.jsx.
  useEffect(() => {
    if (selectedSeq === null && customerCases.length > 0) {
      setSelectedSeq(customerCases[customerCases.length - 1].seq);
    }
  }, [customerCases, selectedSeq]);

  const selectedCase = selectedSeq !== null ? caseBySeq[selectedSeq] : null;
  const selectedResult = selectedSeq !== null ? results[selectedSeq] : null;
  const isGenerating = generatingKey === selectedSeq;

  async function handleGenerate(key, context, messageDate, realReplies) {
    setGeneratingKey(key);
    setError(null);
    try {
      // Only the customer's own prior messages - agent replies are excluded
      // from history, same as TicketDetail.jsx.
      const customerOnlyHistory = context.threadHistory.filter((m) => m.direction === "in");
      // Only date-gate messages that already have a real reply on record (historical,
      // used for comparison) - a message still awaiting a reply is being drafted today,
      // so today's facts apply, same as TicketDetail.jsx.
      const messageDateForGating = realReplies?.length > 0 ? messageDate : null;
      const response = await generateDraft({
        ...context,
        threadHistory: customerOnlyHistory,
        orderFacts: dateGateOrderFacts(orderFacts, messageDateForGating),
        language,
        threadId: threadIdForDrafts,
        seq: key,
        cancellationMarked: lookup?.thread?.cancellation_marked,
        threadReason: lookup?.thread?.thread_reason,
      });
      setResults((prev) => ({ ...prev, [key]: response }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingKey(null);
    }
  }

  function handleSelectedGenerate() {
    if (!selectedCase) return;
    handleGenerate(selectedCase.seq, selectedCase.context, selectedCase.messageDate, selectedCase.realReplies);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
        >
          <Search size={18} />
        </span>
        <h2 className="text-xl font-semibold leading-tight">Order Lookup</h2>
      </div>

      <div className="executive-card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[220px] flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Order ID
          </label>
          <div className="relative mt-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              className="brand-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="e.g. 702-3961911-0960221"
            />
          </div>
        </div>
        <button
          onClick={handleLookup}
          disabled={loading || !orderIdInput.trim()}
          className="brand-button px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Looking up..." : "Look Up"}
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          className="brand-button-ghost px-4 py-2.5 text-sm"
        >
          <MessageSquare size={16} />
          Comments
        </button>
      </div>

      {error && (
        <div className="executive-card-soft flex items-start gap-2.5 p-4 text-sm text-[var(--executive-error)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!lookup && !loading && !error && (
        <div className="executive-card-soft flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "rgb(var(--navy-rgb)/0.05)", color: "var(--muted)" }}
          >
            <Inbox size={22} />
          </span>
          <p className="text-sm font-medium">No order looked up yet</p>
          <p className="max-w-xs text-xs text-[var(--muted)]">
            Enter an order ID above to pull its live details and conversation.
          </p>
        </div>
      )}

      {lookup && (
        <>
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[var(--muted)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Order Details
            </h3>
          </div>
          <OrderDetailsGrid
            orderId={lookup.order_id}
            customerSafe={lookup.order.customer_safe}
            internal={lookup.order.internal}
          />

          <div className="w-56">
            <LanguageInput value={language} onChange={setLanguage} />
          </div>

          {needsManualMessage ? (
            <div className="executive-card-soft flex items-start gap-2.5 p-4 text-sm text-[var(--muted)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {lookup.thread_error
                  ? `CRM thread unavailable: ${lookup.thread_error}`
                  : "The CRM API returned no usable customer message text for this order."}
              </span>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={15} className="text-[var(--muted)]" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Conversation
                  </h3>
                </div>
                {messages.map((message) => {
                  const isCustomer = message.direction === "in";
                  const messageCase = isCustomer ? caseBySeq[message.seq] : null;
                  const isSelected = isCustomer && selectedSeq === message.seq;

                  return (
                    <ConversationMessage
                      key={`${message.direction}-${message.seq}`}
                      message={message}
                      relayEmail={lookup.order.internal?.email || null}
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
                onGenerate={handleSelectedGenerate}
                orderId={lookup.order_id}
                threadId={threadIdForDrafts}
                threadMeta={threadMeta}
              />
            </div>
          )}
        </>
      )}

      <CommentsSidebar isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </div>
  );
}
