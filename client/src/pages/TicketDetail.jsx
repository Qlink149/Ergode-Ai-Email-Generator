import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Pencil, Check } from "lucide-react";
import { fetchTicketThread, fetchRawMessages, generateDraft, saveDraftEdit } from "../api.js";
import LanguageInput from "../components/LanguageInput.jsx";
import MessageText from "../components/MessageText.jsx";
import OrderDetailsGrid from "../components/OrderDetailsGrid.jsx";
import AnalysisPills from "../components/AnalysisPills.jsx";
import AiContextPanel from "../components/AiContextPanel.jsx";
import { buildCustomerMessageCases } from "../threadPairing.js";

/** The full message thread for one ticket - every customer message gets its own "Generate reply" button. */

/** The original Amazon-branded notification HTML, if we have one on disk for this message - display only, see rawEmailReader.js. */
function RawAmazonMessage({ html }) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Original Amazon message
      </p>
      <iframe
        title="Original Amazon message"
        srcDoc={html}
        sandbox=""
        className="w-full rounded-lg border border-[rgb(var(--navy-rgb)/0.1)]"
        style={{ height: "480px" }}
      />
    </div>
  );
}

/**
 * The AI's draft, editable in place. "Edit" swaps to a textarea seeded
 * with the current text; "Save" writes the edit back to ai_drafts
 * (draft_store.py) against this exact thread/seq, alongside the AI's
 * original draft_reply, which is never overwritten.
 */
function EditableDraft({ threadId, seq, draftReply }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draftReply);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveDraftEdit({ threadId, seq, editedReply: text });
      setSaved(true);
      setEditing(false);
    } catch {
      // Best-effort - the edited text stays visible either way.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="executive-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          What our AI generated{saved && " (edited)"}
        </h3>
        {!editing && (
          <button
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
            className="brand-button-ghost px-3 py-1 text-xs"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="brand-input w-full rounded-lg px-3 py-2 text-sm leading-relaxed"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-button px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={13} />
            {saving ? "Saving..." : "Save edit"}
          </button>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      )}
    </div>
  );
}

/** Strips order facts that weren't true yet as of the given message date - a reply from before a refund shouldn't see that refund. */
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
  // Raw Amazon-branded HTML keyed by message index (= seq) - see rawEmailReader.js.
  const [rawMessages, setRawMessages] = useState({});

  useEffect(() => {
    fetchTicketThread(threadId)
      .then((data) => {
        setMessages(data.messages);
        setOrder(data.order || null);
        setOrderId(data.order_id || null);
        setThreadMeta(data.thread_meta || null);
      })
      .catch((err) => setError(err.message));

    fetchRawMessages(threadId)
      .then((data) => {
        const byIndex = Object.fromEntries(data.messages.map((m) => [m.index, m]));
        setRawMessages(byIndex);
      })
      .catch(() => {
        // No raw files for this thread, or the read failed - not fatal, the panel just won't offer it.
      });
  }, [threadId]);

  const customerCases = messages ? buildCustomerMessageCases(messages) : [];
  const caseBySeq = Object.fromEntries(customerCases.map((c) => [c.seq, c]));

  async function handleGenerate(key, context, messageDate) {
    setGeneratingKey(key);
    setError(null);
    try {
      // No internal_status_note - proven unreliable against real threads, no longer trusted as input.
      // Time-sensitive facts (shipping, refund) are only included if they were
      // actually true as of this message's own date - otherwise a reply from
      // before a later refund would see that refund as if it already happened.
      const orderFacts = order ? dateGateOrderFacts(order.customer_safe, messageDate) : null;
      // Only the customer's own prior messages - agent replies are excluded from history.
      const customerOnlyHistory = context.threadHistory.filter((m) => m.direction === "in");
      const response = await generateDraft({
        ...context,
        threadHistory: customerOnlyHistory,
        orderFacts,
        language,
        threadId,
        seq: key,
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
            const result = messageCase ? results[messageCase.seq] : null;
            const isGenerating = generatingKey === messageCase?.seq;

            return (
              <div key={`${message.direction}-${message.seq}`}>
                <div className={`executive-card-soft p-4 ${isCustomer ? "" : "bg-[rgb(var(--violet-rgb)/0.04)]"}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {isCustomer ? "Customer" : "Us (agent)"}
                    </span>
                    {message.created_time && (
                      <span className="text-xs text-[var(--muted)]">{message.created_time}</span>
                    )}
                    {message.is_relay && <span className="pill pill-danger">relayed by marketplace</span>}
                    {message.order_id && <span className="pill pill-neutral">{message.order_id}</span>}
                  </div>
                  <MessageText text={message.text} />
                </div>

                {messageCase && (
                  <div className="ml-4 mt-2 border-l-2 border-[rgb(var(--navy-rgb)/0.1)] pl-4">
                    <button
                      onClick={() => handleGenerate(messageCase.seq, messageCase.context, messageCase.messageDate)}
                      disabled={isGenerating}
                      className="brand-button-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      {isGenerating ? "Generating..." : "Generate AI Reply"}
                    </button>

                    {result && (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          {messageCase.realReplies.length > 0 && (
                            <div className="executive-card p-5">
                              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                                What was actually sent (CRM)
                              </h3>
                              <div className="space-y-3">
                                {messageCase.realReplies.map((text, i) => (
                                  <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {text}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          <EditableDraft
                            threadId={threadId}
                            seq={String(messageCase.seq)}
                            draftReply={result.draft_reply}
                          />
                        </div>
                        <AnalysisPills analysis={result.analysis} />
                        <AiContextPanel
                          context={result.context}
                          systemPromptVersion={result.system_prompt_version}
                          threadMeta={threadMeta}
                          reasoning={result.analysis?.reasoning}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Original Amazon messages
          </h3>
          {Object.values(rawMessages).filter((m) => m.type === "message_in").length > 0 ? (
            Object.values(rawMessages)
              .filter((m) => m.type === "message_in")
              .map((m) => <RawAmazonMessage key={m.id} html={m.html} />)
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No original Amazon email on file for this thread.
            </p>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
