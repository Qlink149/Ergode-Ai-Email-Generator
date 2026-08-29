import { useMemo, useState } from "react";
import { KeyRound, Check, X, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { updateUser, resetUserPassword } from "../../api.js";
import PermissionEditor from "./PermissionEditor.jsx";
import { TAB_LABELS, PERMISSION_LABELS } from "./constants.js";

export default function UserRow({ user, tabIds, permissionKeys, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [perms, setPerms] = useState(user.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [notice, setNotice] = useState(null);

  async function savePerms() {
    setBusy(true);
    setError(null);
    try {
      await updateUser(user._id, { permissions: perms });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    setError(null);
    try {
      await updateUser(user._id, { active: !user.active });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetUserPassword(user._id, newPw);
      setNewPw("");
      setPwOpen(false);
      setNotice("Password reset.");
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const permSummary = useMemo(() => {
    const tabs = (user.permissions.tabs || []).map((t) => TAB_LABELS[t] || t);
    const actions = permissionKeys.filter((k) => user.permissions[k]).map((k) => PERMISSION_LABELS[k]);
    return [...tabs, ...actions].join(" · ") || "No access";
  }, [user.permissions, permissionKeys]);

  return (
    <div className="executive-card-soft space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {user.name}
            {!user.active && <span className="pill">Deactivated</span>}
            {user.permissions.manageUsers && (
              <span className="flex items-center gap-1 text-xs text-[var(--violet)]">
                <ShieldCheck size={12} /> admin
              </span>
            )}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPwOpen((v) => !v)} className="brand-button-ghost px-3 py-1 text-xs">
            <KeyRound size={12} /> Reset password
          </button>
          <button onClick={toggleActive} disabled={busy} className="brand-button-ghost px-3 py-1 text-xs">
            {user.active ? <X size={12} /> : <Check size={12} />}
            {user.active ? "Deactivate" : "Reactivate"}
          </button>
          <button
            onClick={() => {
              setPerms(user.permissions);
              setEditing((v) => !v);
            }}
            className="brand-button-ghost px-3 py-1 text-xs"
          >
            {editing ? "Close" : "Edit access"}
          </button>
        </div>
      </div>

      {!editing && <p className="text-xs text-[var(--muted)]">{permSummary}</p>}

      {editing && (
        <div className="space-y-3 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
          <PermissionEditor value={perms} onChange={setPerms} tabIds={tabIds} permissionKeys={permissionKeys} />
          <button onClick={savePerms} disabled={busy} className="brand-button px-4 py-2 text-xs disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save access
          </button>
        </div>
      )}

      {pwOpen && (
        <form onSubmit={submitPassword} className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--navy-rgb)/0.08)] pt-3">
          <input
            className="brand-input rounded-lg px-3 py-1.5 text-sm"
            placeholder="New password (min 8)"
            type="text"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
          />
          <button type="submit" disabled={busy} className="brand-button px-3 py-1.5 text-xs disabled:opacity-50">
            Set password
          </button>
        </form>
      )}

      {notice && <p className="text-xs text-[var(--executive-success)]">{notice}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--executive-error)]">
          <AlertCircle size={13} /> {error}
        </p>
      )}
    </div>
  );
}
