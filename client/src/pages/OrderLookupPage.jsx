import { useState } from "react";
import { Search, Sparkles, ShieldAlert } from "lucide-react";
import { fetchOrderLookup, generateDraft } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";
import AnalysisPills from "../components/AnalysisPills.jsx";
import AiContextPanel from "../components/AiContextPanel.jsx";
import { buildCustomerMessageCases } from "../threadPairing.js";

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

/** Strips order facts that weren't true yet as of the given message date - a reply from before a refund shouldn't see that refund. Same logic as TicketDetail.jsx. */
function dateGateOrderFacts(facts, messageDate) {
  if (!facts || !messageDate) return facts;
  const asOf = new Date(messageDate);
  const gated = { ...facts };

  const shippedDate = facts.shipped_date ? new Date(facts.shipped_date) : null;
  if (shippedDate && asOf < shippedDate) {
    gated.carrier_name = null;
    gated.tracking_id = null;
    gated.tracking_url = null;
    gated.ship_method = null;
    gated.shipped_date = null;
    gated.customer_tracking_status = null;
    gated.last_mile_carrier = null;
    gated.last_mile_tracking = null;
  }

  const refundDate = facts.refund_date ? new Date(facts.refund_date) : null;
  if (refundDate && asOf < refundDate) {
    gated.customer_refund_amount = null;
    gated.refund_date = null;
  }

  return gated;
}

/** True if at least one inbound message actually has usable text. */
function hasUsableCustomerText(messages) {
  return messages.some((m) => m.direction === "in" && m.text);
}

function FactRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
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

  async function handleGenerate(key, context, messageDate, realReplies) {
    setGeneratingKey(key);
    setError(null);
    try {
      // Only the customer's own prior messages - agent replies are excluded
      // from history, same as TicketDetail.jsx.
      const customerOnlyHistory = context.threadHistory.filter((m) => m.direction === "in");
      const response = await generateDraft({
        ...context,
        threadHistory: customerOnlyHistory,
        orderFacts: dateGateOrderFacts(orderFacts, messageDate),
        language,
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="executive-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Order API — customer-safe facts
              </h3>
              <FactRow label="Recipient" value={lookup.order.customer_safe.recipient_name} />
              <FactRow label="Product" value={lookup.order.customer_safe.product_name} />
              <FactRow label="Carrier" value={lookup.order.customer_safe.carrier_name} />
              <FactRow label="Tracking #" value={lookup.order.customer_safe.tracking_id} />
              <FactRow label="Shipped" value={lookup.order.customer_safe.shipped_date} />
              <FactRow label="Purchased" value={lookup.order.customer_safe.purchase_date} />
              <FactRow
                label="Latest carrier status"
                value={lookup.order.customer_safe.customer_tracking_status || "no scan on file"}
              />

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-[rgb(var(--navy-rgb)/0.04)] p-3 text-xs text-[var(--muted)]">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  Internal-only fields (status code, internal order id) and supplier/seller data
                  are deliberately not shown here or sent to the AI — see disclosureClassifier.js.
                </span>
              </div>
            </div>

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
                className="brand-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} />
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
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {buildCustomerMessageCases(
                normalizeThreadMessages(lookup.thread.email_summary, lookup.order_id)
              ).map((c) => {
                const result = results[c.seq];
                const isGenerating = generatingKey === c.seq;
                return (
                  <div key={c.seq} className="executive-card-soft p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Customer message
                    </p>
                    <MessageText text={c.context.customerMessage} />

                    <button
                      onClick={() => handleGenerate(c.seq, c.context, c.messageDate, c.realReplies)}
                      disabled={isGenerating}
                      className="brand-button-ghost mt-3 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      {isGenerating ? "Generating..." : "Generate with AI"}
                    </button>

                    {result && (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          {result.realReplies?.length > 0 && (
                            <div className="executive-card p-5">
                              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                                What was actually sent (CRM)
                              </h3>
                              <div className="space-y-3">
                                {result.realReplies.map((text, i) => (
                                  <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {text}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="executive-card p-5">
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                              What our AI generated
                            </h3>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {result.draft_reply}
                            </p>
                          </div>
                        </div>
                        <AnalysisPills analysis={result.analysis} />
                        <AiContextPanel
                          context={result.context}
                          systemPromptVersion={result.system_prompt_version}
                          reasoning={result.analysis?.reasoning}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
