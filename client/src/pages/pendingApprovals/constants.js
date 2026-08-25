import {
  FileClock,
  PackageCheck,
  GitPullRequestClosed,
  ScanLine,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Pencil,
  ShieldCheck,
  ShieldX,
  Shield,
  Database,
} from "lucide-react";

/**
 * constants.js
 * ------------
 * Every plain lookup table / pure helper function shared across the
 * Pending Approvals page - no JSX here, just data and small functions, so
 * any file that only needs a label or a color doesn't have to pull in a
 * component's worth of markup.
 */

export function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function shortId(id) {
  return `PF-${id.slice(-6).toUpperCase()}`;
}

export function truncateMid(text, n) {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

// A proposal's real status is one of 5 values in the database (pending,
// approved, rejected, already_covered, needs_manual_review), but the UI
// only shows 4 buckets - the last two squash into one "Needs Attention".
export function bucketOf(status) {
  if (status === "pending") return "pending";
  if (status === "approved") return "implemented";
  if (status === "rejected") return "rejected";
  return "needs_attention"; // already_covered, needs_manual_review
}

export const HEXAGON_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

export const BUCKETS = ["pending", "implemented", "rejected", "needs_attention"];
export const BUCKET_LABEL = {
  pending: "Pending Review",
  implemented: "Implemented",
  rejected: "Rejected",
  needs_attention: "Needs Attention",
};
// Plain CSS custom properties already defined in index.css - no new
// palette introduced, and validated colorblind-safe together (see
// dataviz skill's validate_palette.js: all 4 checks pass, WARN on
// surface contrast is why every use below pairs color with a text label
// or icon, never color alone).
export const BUCKET_COLOR = {
  pending: "var(--lavender)",
  implemented: "var(--success)",
  rejected: "var(--danger)",
  needs_attention: "var(--warning)",
};
export const BUCKET_ICON_STYLE = {
  pending: { background: "rgb(var(--lavender-rgb)/0.14)", color: "var(--lavender)" },
  implemented: { background: "rgb(var(--success-rgb)/0.14)", color: "var(--executive-success)" },
  rejected: { background: "rgb(var(--danger-rgb)/0.14)", color: "var(--executive-error)" },
  needs_attention: { background: "rgb(var(--warning-rgb)/0.14)", color: "var(--warning)" },
};
export const BUCKET_ICON = {
  pending: FileClock,
  implemented: PackageCheck,
  rejected: GitPullRequestClosed,
  needs_attention: ScanLine,
};

export const STATUS_LABEL = {
  pending: "Pending Review",
  approved: "Implemented",
  rejected: "Rejected",
  already_covered: "Already Covered",
  needs_manual_review: "Needs Manual Review",
};
export const STATUS_PILL_CLASS = {
  pending: "pill-neutral",
  approved: "pill-success",
  rejected: "pill-danger",
  already_covered: "pill-warning",
  needs_manual_review: "pill-warning",
};

export const FILTER_TABS = [{ id: "all", label: "All" }, ...BUCKETS.map((b) => ({ id: b, label: BUCKET_LABEL[b] }))];

export const TRIGGER_TYPE_LABEL = { comment: "Comment", draft_edit: "Draft Edit", override: "Override" };

export const ESCALATION_TYPE_META = {
  code_restriction: { label: "Code Restriction", icon: AlertTriangle, bg: "rgb(var(--warning-rgb)/0.14)", color: "var(--warning)" },
  data_restriction: { label: "Data Restriction", icon: ShieldAlert, bg: "rgb(var(--danger-rgb)/0.14)", color: "var(--executive-error)" },
  none: { label: "No Gap Found", icon: CheckCircle2, bg: "rgb(var(--success-rgb)/0.12)", color: "var(--executive-success)" },
};
export const ESCALATION_TYPES = ["code_restriction", "data_restriction", "none"];
// Prompt Fix isn't stored in "escalations" (it's a proposal, tracked in the
// dashboard above) - shown here too so this bar reads as the complete
// breakdown across all four triage outcomes, not just the non-prompt-fix ones.
export const PROMPT_FIX_STAT_META = { icon: Pencil, bg: "rgb(var(--violet-rgb)/0.14)", color: "var(--violet)" };

export const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "context", label: "Context" },
  { id: "timeline", label: "Timeline" },
];

export const DECISION_TINT = {
  approved: { icon: ShieldCheck, bg: "rgb(var(--success-rgb)/0.08)", iconBg: "rgb(var(--success-rgb)/0.18)", iconFg: "var(--executive-success)" },
  rejected: { icon: ShieldX, bg: "rgb(var(--danger-rgb)/0.08)", iconBg: "rgb(var(--danger-rgb)/0.18)", iconFg: "var(--executive-error)" },
  already_covered: { icon: ShieldAlert, bg: "rgb(var(--warning-rgb)/0.08)", iconBg: "rgb(var(--warning-rgb)/0.18)", iconFg: "var(--warning)" },
  needs_manual_review: { icon: ShieldAlert, bg: "rgb(var(--warning-rgb)/0.08)", iconBg: "rgb(var(--warning-rgb)/0.18)", iconFg: "var(--warning)" },
  pending: { icon: Shield, bg: "rgb(var(--navy-rgb)/0.03)", iconBg: "rgb(var(--navy-rgb)/0.08)", iconFg: "var(--muted)" },
};

export const CURRENT_VALUE_TINT = { icon: Database, bg: "rgb(var(--lavender-rgb)/0.07)", iconBg: "rgb(var(--lavender-rgb)/0.16)", iconFg: "var(--lavender)" };
export const PROPOSED_CHANGE_TINT = { icon: Pencil, bg: "rgb(var(--violet-rgb)/0.06)", iconBg: "rgb(var(--violet-rgb)/0.14)", iconFg: "var(--violet)" };

export function finalDecisionMeta(proposal) {
  const tint = DECISION_TINT[proposal.status] || DECISION_TINT.pending;
  switch (proposal.status) {
    case "approved":
      return { text: `Applied — live as system prompt version ${proposal.reviewed_outcome_version}`, tint };
    case "rejected":
      return { text: "Rejected — original text kept, nothing changed", tint };
    case "already_covered":
      return { text: `Not applied — already covered. ${proposal.recheck_note || ""}`, tint };
    case "needs_manual_review":
      return { text: `Not applied — needs manual review. ${proposal.recheck_note || ""}`, tint };
    default:
      return { text: "Awaiting decision", tint };
  }
}
