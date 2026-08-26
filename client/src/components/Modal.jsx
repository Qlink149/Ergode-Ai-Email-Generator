import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Modal.jsx
 * ---------
 * Generic centered modal - backdrop + escape-to-close + click-outside-to-
 * close, rendered via a portal straight into document.body for the same
 * reason CommentsSidebar.jsx does: AppShell.jsx's <main> has its own
 * z-10 stacking context, so nothing inside it can ever outrank the sticky
 * header's z-50 no matter how high its own z-index goes - a portal escapes
 * that entirely.
 *
 * Deliberately unstyled beyond backdrop + centering + max-height/scroll -
 * it doesn't wrap children in its own card chrome (background, border,
 * padding), so a child that's already a self-contained card (like
 * ProposalDetailPanel, built for a sticky side panel) can be dropped in
 * here as-is without ending up nested inside a second card.
 */
export default function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
