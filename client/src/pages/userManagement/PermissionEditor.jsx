import { TAB_LABELS, PERMISSION_LABELS } from "./constants.js";

/** The tab/permission checkbox grid, reused by the add form and the per-row editor. */
export default function PermissionEditor({ value, onChange, tabIds, permissionKeys }) {
  function toggleTab(id) {
    const has = value.tabs.includes(id);
    onChange({ ...value, tabs: has ? value.tabs.filter((t) => t !== id) : [...value.tabs, id] });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Visible tabs</p>
        <div className="space-y-1.5">
          {tabIds.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.tabs.includes(id)}
                onChange={() => toggleTab(id)}
                disabled={id === "lookup"}
              />
              {TAB_LABELS[id] || id}
              {id === "lookup" && <span className="text-xs text-[var(--muted)]">(always on)</span>}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Actions</p>
        <div className="space-y-1.5">
          {permissionKeys.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(value[key])}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              />
              {PERMISSION_LABELS[key] || key}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
