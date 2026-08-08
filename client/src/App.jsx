import { useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import Tabs from "./components/Tabs.jsx";
import ReportList from "./pages/ReportList.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import TicketQueue from "./pages/TicketQueue.jsx";
import TicketDetail from "./pages/TicketDetail.jsx";
import SystemPromptPage from "./pages/SystemPromptPage.jsx";
import OrderLookupPage from "./pages/OrderLookupPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { fetchReport, getToken, clearToken } from "./api.js";

/**
 * App.jsx
 * -------
 * Top-level app: a tab bar picks the page (Report / Generate / System
 * Prompt), and within the Report tab a second bit of state picks between
 * the case list and one case's detail view. No router needed for this
 * few screens - plain state is simpler and easier to follow.
 */

const TABS = [
  { id: "tickets", label: "Ticket Queue" },
  { id: "lookup", label: "Order Lookup" },
  { id: "report", label: "Comparison Report" },
  { id: "prompt", label: "System Prompt" },
];

const TAB_META = {
  tickets: { title: "Ticket Queue", description: "Live customer threads, one AI-generate button per message" },
  lookup: { title: "Order Lookup", description: "Look up a live order and generate a reply grounded in it" },
  report: { title: "Draft Comparison Report", description: "AI draft vs. real historical reply" },
  prompt: { title: "System Prompt", description: "The prompt every draft is generated from" },
};

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [activeTab, setActiveTab] = useState("tickets");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  useEffect(() => {
    function handleAuthExpired() {
      setAuthed(false);
    }
    window.addEventListener("ergode-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("ergode-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchReport()
      .then(setReport)
      .catch((err) => setReportError(err.message));
  }, [authed]);

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setSelectedIndex(null);
    setSelectedTicketId(null);
  }

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
    >
      <Tabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === "tickets" && (
        <>
          {selectedTicketId === null ? (
            <TicketQueue onSelectTicket={setSelectedTicketId} />
          ) : (
            <TicketDetail threadId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
          )}
        </>
      )}

      {activeTab === "report" && (
        <>
          {reportError && (
            <div className="executive-card-soft p-6 text-sm text-[var(--executive-error)]">
              {reportError}
            </div>
          )}
          {!reportError && !report && (
            <p className="text-sm text-[var(--muted)]">Loading report...</p>
          )}
          {report && selectedIndex === null && (
            <ReportList report={report} onSelectCase={setSelectedIndex} />
          )}
          {report && selectedIndex !== null && (
            <ReportDetail
              item={report.cases[selectedIndex]}
              onBack={() => setSelectedIndex(null)}
            />
          )}
        </>
      )}

      {activeTab === "lookup" && <OrderLookupPage />}
      {activeTab === "prompt" && <SystemPromptPage />}
    </AppShell>
  );
}
