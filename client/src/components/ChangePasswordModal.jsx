import { useState } from "react";
import { KeyRound, Check, AlertCircle } from "lucide-react";
import Modal from "./Modal.jsx";
import { changeMyPassword } from "../api.js";

/** Self-service password change for a named user (see routes/account.js). */
export default function ChangePasswordModal({ isOpen, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function close() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setDone(false);
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changeMyPassword(current, next);
      setDone(true);
      setTimeout(close, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <form onSubmit={submit} className="executive-card space-y-3 p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound size={15} /> Change your password
        </h3>
        <input
          className="brand-input w-full rounded-lg px-3 py-2 text-sm"
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          className="brand-input w-full rounded-lg px-3 py-2 text-sm"
          type="password"
          autoComplete="new-password"
          placeholder="New password (min 8)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <input
          className="brand-input w-full rounded-lg px-3 py-2 text-sm"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-[var(--executive-error)]">
            <AlertCircle size={14} /> {error}
          </p>
        )}
        {done && (
          <p className="flex items-center gap-1.5 text-sm text-[var(--executive-success)]">
            <Check size={14} /> Password changed.
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || done} className="brand-button px-4 py-2 text-xs disabled:opacity-50">
            {busy ? "Saving..." : "Change password"}
          </button>
          <button type="button" onClick={close} className="brand-button-ghost px-3 py-2 text-xs">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
