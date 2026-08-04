/**
 * AppShell.jsx
 * ------------
 * The page frame every screen sits inside: the soft purple background
 * blobs, the sticky header with the title/badge, and the content area.
 * Pages just pass in their content as children - they don't need to know
 * about any of the background/header styling.
 */

export default function AppShell({ badge, title, description, children }) {
  return (
    <div className="executive-shell min-h-screen text-slate-900">
      <div className="exec-blob-mid" />

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
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.20em]"
                style={{
                  background: "rgb(var(--royal-rgb)/0.08)",
                  border: "1px solid rgb(var(--royal-rgb)/0.14)",
                  color: "rgb(var(--royal-rgb)/1)",
                }}
              >
                {badge}
              </span>
            )}
            {title && <h1 className="truncate text-sm font-semibold leading-none">{title}</h1>}
            {description && (
              <span className="hidden truncate text-xs text-slate-400 lg:inline">
                · {description}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="page-width relative z-10 px-4 py-8 pb-16 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
