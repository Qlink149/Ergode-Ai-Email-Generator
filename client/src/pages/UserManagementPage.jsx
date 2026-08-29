import { useEffect, useState } from "react";
import { Users, AlertCircle } from "lucide-react";
import { listUsers } from "../api.js";
import { useAuth } from "../auth.js";
import AddUserForm from "./userManagement/AddUserForm.jsx";
import UserRow from "./userManagement/UserRow.jsx";
import { PERMISSION_LABELS } from "./userManagement/constants.js";

/**
 * UserManagementPage.jsx
 * ----------------------
 * Admin-only (the "users" tab is only shown to someone with manageUsers).
 * Create named accounts, tick exactly which tabs and actions each one
 * gets, reset a password, or deactivate. Everything here is also enforced
 * server-side (server/routes/users.js + requirePerm).
 *
 * This file only owns the page's own state (the user list + load/error) -
 * the actual pieces live in ./userManagement/: PermissionEditor.jsx (the
 * shared tab/action checkbox grid), AddUserForm.jsx, and UserRow.jsx.
 */
export default function UserManagementPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState([]);
  const [tabIds, setTabIds] = useState(["lookup", "prompt", "approvals", "users"]);
  const [permissionKeys, setPermissionKeys] = useState(Object.keys(PERMISSION_LABELS));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    listUsers()
      .then((data) => {
        setUsers(data.users || []);
        if (data.tab_ids) setTabIds(data.tab_ids);
        if (data.permission_keys) setPermissionKeys(data.permission_keys);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgb(var(--royal-rgb)/0.1)", color: "rgb(var(--royal-rgb)/1)" }}
        >
          <Users size={18} />
        </span>
        <div>
          <h2 className="text-xl font-semibold leading-tight">User Management</h2>
          <p className="text-xs text-[var(--muted)]">
            Signed in as {me?.name}
            {me?.kind === "admin" ? " (shared admin login)" : ` · ${me?.email}`}
          </p>
        </div>
      </div>

      <AddUserForm tabIds={tabIds} permissionKeys={permissionKeys} onCreated={load} />

      {loading && <p className="text-sm text-[var(--muted)]">Loading users...</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--executive-error)]">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {!loading && users.length === 0 && (
        <div className="executive-card-soft px-6 py-10 text-center text-sm text-[var(--muted)]">
          No named users yet. Add one above — until then, everyone signs in with the shared admin password.
        </div>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <UserRow key={user._id} user={user} tabIds={tabIds} permissionKeys={permissionKeys} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
