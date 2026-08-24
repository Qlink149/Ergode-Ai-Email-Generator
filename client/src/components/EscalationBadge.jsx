import { AlertTriangle, ShieldAlert, CircleCheck } from "lucide-react";

/**
 * EscalationBadge.jsx
 * --------------------
 * A small pill showing the triage agent's outcome for one comment/edit -
 * a real code gap ("code_restriction", routed to Clara), a real data gap
 * ("data_restriction", routed to Clara and Ergode), or nothing actionable
 * ("none" - shown too, not hidden, so a human can see the AI's call on
 * every piece of feedback rather than only the ones it flagged). Used in
 * CommentsSidebar.jsx and PendingApprovalsPage.jsx.
 */
export default function EscalationBadge({ type }) {
  if (type === "code_restriction") {
    return (
      <span className="pill pill-warning">
        <AlertTriangle size={11} />
        Code Restriction
      </span>
    );
  }
  if (type === "data_restriction") {
    return (
      <span className="pill pill-danger">
        <ShieldAlert size={11} />
        Data Restriction
      </span>
    );
  }
  if (type === "none") {
    return (
      <span className="pill pill-neutral">
        <CircleCheck size={11} />
        No gap found
      </span>
    );
  }
  return null;
}
