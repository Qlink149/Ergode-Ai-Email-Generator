import { useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import Tabs from "./components/Tabs.jsx";
import SystemPromptPage from "./pages/SystemPromptPage.jsx";
import OrderLookupPage from "./pages/OrderLookupPage.jsx";
import PendingApprovalsPage from "./pages/PendingApprovalsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { getToken, clearToken } from "./api.js";

/**
 * App.jsx
 * -------
 * Top-level app: a tab bar picks the page (Order Lookup / System Prompt /
 * Pending Approvals). No router needed for this few screens - plain state
 * is simpler and easier to follow.
 */

const TABS = [
  { id: "lookup", label: "Order Lookup" },
  { id: "prompt", label: "System Prompt" },
  { id: "approvals", label: "Pending Approvals" },
];

const TAB_META = {
  lookup: { title: "Order Lookup", description: "" },
  prompt: { title: "System Prompt", description: "" },
  approvals: { title: "Pending Approvals", description: "" },
};

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [activeTab, setActiveTab] = useState("lookup");

  useEffect(() => {
    function handleAuthExpired() {
      setAuthed(false);
    }
    window.addEventListener("ergode-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("ergode-auth-expired", handleAuthExpired);
  }, []);

  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <AppShell
      badge="Ergode AI"
      title={TAB_META[activeTab].title}
      description={TAB_META[activeTab].description}
      onLogout={handleLogout}
      onNavigateToApprovals={() => setActiveTab("approvals")}
    >
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "lookup" && <OrderLookupPage />}
      {activeTab === "prompt" && <SystemPromptPage />}
      {activeTab === "approvals" && <PendingApprovalsPage />}
    </AppShell>
  );
}
