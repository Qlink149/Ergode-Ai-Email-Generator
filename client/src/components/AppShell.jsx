/**
 * AppShell.jsx
 * ------------
 * The page frame every screen sits inside: the soft purple background
 * blobs, the sticky header with the title/badge, and the content area.
 * Pages just pass in their content as children - they don't need to know
 * about any of the background/header styling.
 */

import { useState } from "react";
import logo from "../logo.webp";
import NotificationBell from "./NotificationBell.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import { useAuth } from "../auth.js";

export default function AppShell({ badge, title, description, onLogout, onNavigateToApprovals, children }) {
  const { me } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <div className="executive-shell min-h-screen text-slate-900">
      <div className="exec-blob-mid" />
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed -right-[4%] -top-[8%] z-0 hidden w-[30rem] opacity-[0.07] lg:block"
      />

      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.94)",
          borderBottom: "1px solid rgb(var(--navy-rgb)/0.09)",
          boxShadow: "0 1px 2px rgb(var(--navy-rgb)/0.04), 0 4px 20px rgb(var(--navy-rgb)/0.04)",
        }}
      >
        <div className="page-width px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            {badge && (
              <span
                className="flex shrink-0 items-center rounded-full px-3 py-1.5"
                style={{ background: "rgb(var(--navy-rgb)/1)" }}
              >
                <img src="/ergode.webp" alt={badge} className="h-4 w-auto" />
              </span>
            )}
            {title && <h1 className="truncate text-sm font-semibold leading-none">{title}</h1>}
            {description && (
              <span className="hidden truncate text-xs text-slate-400 lg:inline">
                · {description}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell onNavigateToApprovals={onNavigateToApprovals} />
              {me?.kind === "user" && (
                <>
                  <span className="hidden text-xs text-[var(--muted)] sm:inline">{me.name}</span>
                  <button onClick={() => setPwOpen(true)} className="brand-button-ghost px-3 py-1.5 text-xs">
                    Change password
                  </button>
                </>
              )}
              {onLogout && (
                <button onClick={onLogout} className="brand-button-ghost px-3 py-1.5 text-xs">
                  Log out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="page-width relative z-10 px-4 py-8 pb-16 sm:px-6 lg:px-8">{children}</main>

      <ChangePasswordModal isOpen={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
