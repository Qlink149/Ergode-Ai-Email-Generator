import { useState } from "react";
import { UserPlus, Check, Loader2, AlertCircle } from "lucide-react";
import { createUser } from "../../api.js";
import PermissionEditor from "./PermissionEditor.jsx";
import { EMPTY_PERMS } from "./constants.js";

export default function AddUserForm({ tabIds, permissionKeys, onCreated }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState(EMPTY_PERMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setEmail("");
    setName("");
    setPassword("");
    setPerms(EMPTY_PERMS);
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createUser({ email: email.trim(), name: name.trim(), password, permissions: perms });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="brand-button px-4 py-2 text-sm">
        <UserPlus size={15} />
        Add user
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="executive-card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="brand-input rounded-lg px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="brand-input rounded-lg px-3 py-2 text-sm"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="brand-input rounded-lg px-3 py-2 text-sm"
          placeholder="Temporary password (min 8)"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <PermissionEditor value={perms} onChange={setPerms} tabIds={tabIds} permissionKeys={permissionKeys} />

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--executive-error)]">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="brand-button px-4 py-2 text-xs disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Create user
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="brand-button-ghost px-3 py-2 text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
