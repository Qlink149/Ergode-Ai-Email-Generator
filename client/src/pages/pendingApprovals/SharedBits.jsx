import { MessageCircle, FileSearch } from "lucide-react";
import AiContextPanel from "../../components/AiContextPanel.jsx";
import SnapshotBlock from "../../components/SnapshotBlock.jsx";

/**
 * SharedBits.jsx
 * --------------
 * Small building blocks reused by BOTH the proposal detail panel and the
 * escalation detail panel, so "Customer Message & AI Reply" / "Context &
 * Analysis" look identical whichever one you're looking at.
 */

/** Small icon-badge + label header used throughout the detail panels. */
export function SectionHeading({ icon: Icon, title, tint }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={tint || { background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
      >
        <Icon size={12} />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
    </div>
  );
}

/** Read-only case detail shared by the proposal detail panel and the escalation detail panel. */
export function CaseDetail({ record }) {
  // Prefer the record's own top-level fields; fall back to the nested
  // ai_context (older records, before these were promoted to top-level).
  const customerMessage = record.customer_message ?? record.ai_context?.context?.customer_message;
  const aiDraftReply = record.ai_draft_reply;
  // Never silently disappear a missing field - say so explicitly, so it
  // reads as "we don't have this" rather than looking broken/incomplete.
  const NOT_RECORDED = "Not recorded for this item (it predates this field being captured).";

  return (
    <>
      <div className="space-y-2">
        <SectionHeading
          icon={MessageCircle}
          title="Customer Message & AI Reply"
          tint={{ background: "rgb(var(--violet-rgb)/0.12)", color: "var(--violet)" }}
        />
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <SnapshotBlock label="Customer said" text={customerMessage || NOT_RECORDED} />
          <SnapshotBlock label="AI replied (at the time)" text={aiDraftReply || NOT_RECORDED} tone="violet" />
        </div>
      </div>

      {record.ai_context?.context && (
        <div className="space-y-2">
          <SectionHeading
            icon={FileSearch}
            title="Context & Analysis"
            tint={{ background: "rgb(var(--royal-rgb)/0.12)", color: "rgb(var(--royal-rgb)/1)" }}
          />
          <AiContextPanel
            context={record.ai_context.context}
            systemPromptVersion={record.ai_context.system_prompt_version}
            threadMeta={record.ai_context.thread_meta}
            reasoning={record.ai_context.reasoning}
            policyApplied={record.ai_context.policy_applied}
            fieldsUsed={record.ai_context.fields_used}
            defaultOpen
          />
        </div>
      )}

      <div className="min-w-0 rounded-lg border border-[rgb(var(--navy-rgb)/0.08)] bg-[rgb(var(--navy-rgb)/0.02)] p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {record.trigger_type === "draft_edit"
            ? "Draft was rewritten to"
            : record.trigger_type === "override"
              ? "Human override note"
              : "Comment"}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{record.source_text}</p>
      </div>
    </>
  );
}

/** Small colored-circle initials avatar - the app has no profile pictures, this is the closest equivalent. */
export function AuthorAvatar({ name }) {
  const initials =
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ background: "rgb(var(--violet-rgb)/1)" }}
    >
      {initials}
    </span>
  );
}
