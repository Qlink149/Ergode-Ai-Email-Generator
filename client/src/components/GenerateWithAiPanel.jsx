import { Sparkles } from "lucide-react";
import EditableDraft from "./EditableDraft.jsx";
import AnalysisPills from "./AnalysisPills.jsx";
import AiContextPanel from "./AiContextPanel.jsx";

/**
 * The persistent right-hand "Generate with AI" panel - shows the button and,
 * once generated, the results for whichever customer message is currently
 * selected on the left. Shared by TicketDetail.jsx and OrderLookupPage.jsx
 * so both pages drive the exact same generation UI off a click-a-message
 * selection, not two separately-maintained flows.
 */
export default function GenerateWithAiPanel({
  selectedCase,
  selectedResult,
  isGenerating,
  onGenerate,
  orderId,
  threadId,
  threadMeta,
}) {
  return (
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
              onClick={onGenerate}
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
              {/* What was actually sent (CRM) is deliberately not repeated here - it's
                  already visible in the conversation on the left, no need to duplicate it. */}
              <EditableDraft
                orderId={orderId}
                threadId={threadId}
                seq={String(selectedCase.seq)}
                draftReply={selectedResult.draft_reply}
                customerMessage={selectedCase.context.customerMessage}
                aiContext={{
                  context: selectedResult.context,
                  system_prompt_version: selectedResult.system_prompt_version,
                  thread_meta: threadMeta,
                  reasoning: selectedResult.analysis?.reasoning,
                  policy_applied: selectedResult.analysis?.policy_applied,
                  fields_used: selectedResult.analysis?.fields_used,
                }}
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
  );
}
