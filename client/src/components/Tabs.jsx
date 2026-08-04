/**
 * Tabs.jsx
 * --------
 * Simple tab bar switching between the app's top-level pages. Kept as
 * plain state in App.jsx rather than a router - three pages doesn't need
 * one, and it keeps this project's dependency list small.
 */

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="mb-6 flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={activeTab === tab.id ? "brand-button px-4 py-2 text-sm" : "brand-button-ghost px-4 py-2 text-sm"}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
