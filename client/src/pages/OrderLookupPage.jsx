import { useState } from "react";
import { Search, Sparkles, ShieldAlert } from "lucide-react";
import { fetchOrderLookup, generateDraft } from "../api.js";
import SideBySideReplies from "../components/SideBySideReplies.jsx";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";

/**
 * OrderLookupPage.jsx
 * ---------------------
 * Look up one order by id against the real, live Order API and CRM
 * Thread API (server/routes/orderLookup.js), see exactly what they
 * return, then generate an AI reply grounded in those real facts and
 * compare it against whatever the CRM thread shows was actually sent.
 *
 * The CRM Thread API's messages come back newest-first with different
 * field names (message_type/message_body) than our zip-derived shape
 * (direction/text) - normalizeThreadMessages() below is the one place
 * that translates between them, so the rest of this file and
 * SideBySideReplies never need to know two shapes exist.
 */

function normalizeThreadMessages(emailSummary) {
  return [...emailSummary]
    .reverse() // API returns newest-first; we want chronological order
    .map((m) => ({
      direction: m.message_type === "message_in" ? "in" : "out",
      // The server already decodes HTML entities and turns the CRM API's
      // "HTML content is empty." placeholder into "" - see
      // server/services/crmThreadApiClient.js for why that happens.
      text: m.message_body,
    }));
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
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleLookup() {
    if (!orderIdInput.trim()) return;
    setLoading(true);
    setError(null);
    setLookup(null);
    setResult(null);
    try {
      const data = await fetchOrderLookup(orderIdInput.trim());
      setLookup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!lookup) return;

    let customerMessage = manualMessage.trim();
    let threadHistory = [];
    let realReply = null;

    if (lookup.thread?.email_summary?.length) {
      const messages = normalizeThreadMessages(lookup.thread.email_summary);
      const lastMessage = messages[messages.length - 1];
      const hasRealReply = lastMessage.direction === "out";
      const beforeTarget = hasRealReply ? messages.slice(0, -1) : messages;

      // Find the most recent inbound message that actually has text - the
      // live CRM API currently returns empty content for every message_in
      // we've seen, so this often finds nothing, and manualMessage (typed
      // in below) is used instead.
      const lastInIndex = beforeTarget
        .map((m, idx) => (m.direction === "in" && m.text ? idx : -1))
        .filter((idx) => idx !== -1)
        .pop();

      if (lastInIndex !== undefined) {
        customerMessage = beforeTarget[lastInIndex].text;
        threadHistory = beforeTarget
          .filter((_, idx) => idx !== lastInIndex)
          .map((m) => ({ direction: m.direction, text: m.text }));
      } else {
        // No usable inbound text anywhere in the thread - still carry
        // forward whatever history has real text, so the manually-typed
        // message at least gets the right context.
        threadHistory = beforeTarget.filter((m) => m.text);
      }
      realReply = hasRealReply ? lastMessage.text : null;
    }

    // No `if (!customerMessage) return` here on purpose: when the CRM gives
    // us no usable inbound text and nothing was typed manually, we still
    // have real order facts - generation proceeds as a proactive status
    // update instead of a reply to something specific (see
    // draft_generator.py's has_customer_message branch).

    setGenerating(true);
    setError(null);
    try {
      const response = await generateDraft({
        customerMessage,
        orderId: lookup.order_id,
        threadHistory,
        language,
        orderFacts: {
          ...lookup.order.customer_safe,
          internal_status_note: lookup.order.reasoning_status,
        },
      });
      setResult({ ...response, realReply });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const needsManualMessage =
    lookup &&
    (lookup.thread_error ||
      !hasUsableCustomerText(normalizeThreadMessages(lookup.thread?.email_summary || [])));

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
                  {normalizeThreadMessages(lookup.thread.email_summary).map((m, i) => (
                    <div key={i} className="text-sm">
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

          <div className="executive-card space-y-3 p-5">
            {needsManualMessage && (
              <>
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
              </>
            )}

            <div className="flex flex-wrap items-end gap-3">
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
          </div>

          {result && (
            <>
              {result.realReply ? (
                <SideBySideReplies
                  realReply={result.realReply}
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
