import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { fetchOrderLookup, generateDraft } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";
import OrderDetailsGrid from "../components/OrderDetailsGrid.jsx";
import AnalysisPills from "../components/AnalysisPills.jsx";
import AiContextPanel from "../components/AiContextPanel.jsx";
import CustomerCaseCard from "../components/CustomerCaseCard.jsx";
import { buildCustomerMessageCases } from "../threadPairing.js";
import { dateGateOrderFacts } from "../orderFacts.js";

/**
 * OrderLookupPage.jsx
 * ---------------------
 * Look up one order by id against the real, live Order API and CRM
 * Thread API (server/routes/orderLookup.js), see exactly what they
 * return, then generate an AI reply grounded in those real facts for
 * every customer message in the thread - same per-message pattern as
 * TicketDetail.jsx, just against a live lookup instead of a synced ticket.
 *
 * The CRM Thread API's messages come back newest-first with different
 * field names (message_type/message_body) than our zip-derived shape
 * (direction/text/seq) - normalizeThreadMessages() below is the one place
 * that translates between them, so the rest of this file and
 * buildCustomerMessageCases() never need to know two shapes exist.
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
  const [manualMessage, setManualMessage] = useState("");
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(false);
  // Results keyed by customer message seq, so each generation is independent -
  // same pattern as TicketDetail.jsx. "manual" is the key used for the
  // no-usable-customer-text fallback case below.
  const [results, setResults] = useState({});
  const [generatingKey, setGeneratingKey] = useState(null);
  const [error, setError] = useState(null);

  async function handleLookup() {
    if (!orderIdInput.trim()) return;
    setLoading(true);
    setError(null);
    setLookup(null);
    setResults({});
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
        cancellationMarked: lookup?.thread?.cancellation_marked,
        threadReason: lookup?.thread?.thread_reason,
      });
      setResults((prev) => ({ ...prev, [key]: { ...response, realReplies } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingKey(null);
    }
  }

  /** No usable customer text anywhere (CRM API gap, or thread fetch failed) - generate a proactive status update instead of answering a specific message. */
  function handleManualGenerate() {
    const threadHistory = lookup?.thread?.email_summary
      ? normalizeThreadMessages(lookup.thread.email_summary, lookup.order_id)
          .filter((m) => m.direction === "in" && m.text)
          .map((m) => ({ direction: m.direction, text: m.text }))
      : [];
    handleGenerate(
      "manual",
      { customerMessage: manualMessage.trim(), orderId: lookup.order_id, isRelay: false, threadHistory },
      null,
      []
    );
  }

  const needsManualMessage =
    lookup &&
    (lookup.thread_error ||
      !hasUsableCustomerText(normalizeThreadMessages(lookup.thread?.email_summary || [], lookup.order_id)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Order Lookup</h2>
        <p className="text-sm text-[var(--muted)]">
          Look up an order against the live Order API and CRM Thread API, then generate an AI
          reply grounded in the real data and compare it to what was actually sent.
        </p>
      </div>

      <div className="executive-card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[260px] flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Order ID
          </label>
          <input
            className="brand-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
            placeholder="e.g. 702-3961911-0960221"
          />
        </div>
        <button
          onClick={handleLookup}
          disabled={loading || !orderIdInput.trim()}
          className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search size={16} />
          {loading ? "Looking up..." : "Look Up"}
        </button>
      </div>

      {error && (
        <div className="executive-card-soft p-4 text-sm text-[var(--executive-error)]">{error}</div>
      )}

      {lookup && (
        <>
          <OrderDetailsGrid
            orderId={lookup.order_id}
            customerSafe={lookup.order.customer_safe}
            internal={lookup.order.internal}
          />

          <div className="executive-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              CRM Thread API
            </h3>
            {lookup.thread_error ? (
              <p className="text-sm text-[var(--executive-error)]">{lookup.thread_error}</p>
            ) : (
              <div className="space-y-2">
                {normalizeThreadMessages(lookup.thread.email_summary, lookup.order_id).map((m) => (
                  <div key={m.seq} className="text-sm">
                    <span className="font-semibold">{m.direction === "in" ? "Customer" : "Us"}:</span>{" "}
                    {m.text ? (
                      <MessageText text={m.text} />
                    ) : (
                      <span className="italic text-[var(--executive-error)]">
                        (no text returned by the CRM API for this message)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-56">
            <LanguageInput value={language} onChange={setLanguage} />
          </div>

          {needsManualMessage ? (
            <div className="executive-card space-y-3 p-5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Customer message (optional)
                {lookup.thread_error
                  ? " — CRM thread unavailable, type one in if you have it"
                  : " — CRM API returned no usable text for this thread's messages"}
              </label>
              <textarea
                className="brand-input w-full rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                placeholder="Type it in if you have it, or leave blank to generate a proactive status update from the order facts alone."
              />
              <button
                onClick={handleManualGenerate}
                disabled={generatingKey === "manual"}
                className={`brand-button w-full justify-center px-4 py-3.5 text-sm transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                  generatingKey === "manual" ? "" : "ai-cta-glow hover:scale-[1.02]"
                }`}
              >
                <Sparkles size={16} className={generatingKey === "manual" ? "animate-spin" : ""} />
                {generatingKey === "manual" ? "Generating..." : "Generate with AI"}
              </button>

              {results.manual && (
                <div className="space-y-3 pt-2">
                  <div className="executive-card p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      What our AI generated
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {results.manual.draft_reply}
                    </p>
                  </div>
                  <AnalysisPills analysis={results.manual.analysis} />
                  <AiContextPanel
                    context={results.manual.context}
                    systemPromptVersion={results.manual.system_prompt_version}
                    reasoning={results.manual.analysis?.reasoning}
                    threadMeta={threadMeta}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {buildCustomerMessageCases(
                normalizeThreadMessages(lookup.thread.email_summary, lookup.order_id)
              ).map((c) => (
                <CustomerCaseCard
                  key={c.seq}
                  customerMessage={c.context.customerMessage}
                  isGenerating={generatingKey === c.seq}
                  onGenerate={() => handleGenerate(c.seq, c.context, c.messageDate, c.realReplies)}
                  result={results[c.seq]}
                  threadMeta={threadMeta}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
