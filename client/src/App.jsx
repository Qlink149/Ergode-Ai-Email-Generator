import { useCallback, useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import Tabs from "./components/Tabs.jsx";
import SystemPromptPage from "./pages/SystemPromptPage.jsx";
import OrderLookupPage from "./pages/OrderLookupPage.jsx";
import PendingApprovalsPage from "./pages/PendingApprovalsPage.jsx";
import UserManagementPage from "./pages/UserManagementPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { getToken, clearToken, fetchMe } from "./api.js";
import { AuthContext } from "./auth.js";

/**
 * App.jsx
 * -------
 * Top-level app: a tab bar picks the page. Which tabs show is decided by
 * the logged-in user's permissions (GET /api/account/me) - the shared
 * admin login sees everything; a named user sees only what an admin
 * ticked for them. No router needed for this few screens.
 */

const ALL_TABS = [
  { id: "lookup", label: "Order Lookup" },
  { id: "prompt", label: "System Prompt" },
  { id: "approvals", label: "Pending Approvals" },
  { id: "users", label: "User Management" },
];

const TAB_TITLE = {
  lookup: "Order Lookup",
  prompt: "System Prompt",
  approvals: "Pending Approvals",
  users: "User Management",
};

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(false);
  const [activeTab, setActiveTab] = useState("lookup");

  const refreshMe = useCallback(() => {
    return fetchMe()
      .then((data) => {
        setMe(data);
        setMeError(false);
      })
      .catch(() => setMeError(true));
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      setAuthed(false);
      setMe(null);
    }
    window.addEventListener("ergode-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("ergode-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (authed) refreshMe();
  }, [authed, refreshMe]);

  function handleLogout() {
    clearToken();
    setAuthed(false);
    setMe(null);
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  // Brief gap between "have a token" and "know who I am".
  if (!me && !meError) {
    return (
      <div className="executive-shell flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--navy-rgb)/0.15)] border-t-[var(--royal)]" />
      </div>
    );
  }

  if (meError) {
    return (
      <div className="executive-shell flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-[var(--executive-error)]">Could not load your account. Please sign in again.</p>
        <button onClick={handleLogout} className="brand-button px-4 py-2 text-sm">
          Back to sign in
        </button>
      </div>
    );
  }

  const visibleTabs = ALL_TABS.filter((tab) => me.permissions?.tabs?.includes(tab.id));
  // If the active tab isn't allowed (e.g. after a permission change), fall back to the first one.
  const effectiveTab = visibleTabs.some((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id;

  return (
    <AuthContext.Provider value={{ me, refreshMe }}>
      <AppShell
        badge="Ergode AI"
        title={TAB_TITLE[effectiveTab] || ""}
        description=""
        onLogout={handleLogout}
        onNavigateToApprovals={() => setActiveTab("approvals")}
      >
        <Tabs tabs={visibleTabs} activeTab={effectiveTab} onChange={setActiveTab} />

        {effectiveTab === "lookup" && <OrderLookupPage />}
        {effectiveTab === "prompt" && <SystemPromptPage />}
        {effectiveTab === "approvals" && <PendingApprovalsPage />}
        {effectiveTab === "users" && <UserManagementPage />}
        {!effectiveTab && (
          <p className="text-sm text-[var(--muted)]">
            You don't have access to any sections yet. Ask an admin to grant you permissions.
          </p>
        )}
      </AppShell>
    </AuthContext.Provider>
  );
}
