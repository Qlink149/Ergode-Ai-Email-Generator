import { Sparkles } from "lucide-react";
import MessageText from "./MessageText.jsx";
import AnalysisPills from "./AnalysisPills.jsx";
import AiContextPanel from "./AiContextPanel.jsx";

/**
 * One customer message on OrderLookupPage.jsx, with its own "Generate with AI"
 * button and results - same per-message pattern as TicketDetail.jsx's cases,
 * just rendered inline (stacked) instead of driving a shared side panel.
 */
export default function CustomerCaseCard({ customerMessage, isGenerating, onGenerate, result, threadMeta }) {
  return (
    <div className="executive-card-soft p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Customer message
      </p>
      <MessageText text={customerMessage} />

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className={`brand-button mt-4 w-full justify-center px-4 py-3.5 text-sm transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
          isGenerating ? "" : "ai-cta-glow hover:scale-[1.02]"
        }`}
      >
        <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} />
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.draft_reply}</p>
            </div>
          </div>
          <AnalysisPills analysis={result.analysis} />
          <AiContextPanel
            context={result.context}
            systemPromptVersion={result.system_prompt_version}
            reasoning={result.analysis?.reasoning}
            threadMeta={threadMeta}
          />
        </div>
      )}
    </div>
  );
}
