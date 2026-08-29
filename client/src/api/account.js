/**
 * api/account.js
 * --------------
 * Logging in and self-service account actions.
 */

import { API_BASE, setToken, handleResponse, apiFetch } from "./client.js";

/**
 * Log in and store the session token.
 *  - pass an email + password for a named user account
 *  - pass just a password (email blank) for the shared admin login
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email || undefined, password }),
  });
  const data = await handleResponse(response);
  setToken(data.token);
}

/** Who am I + what can I do - { kind, id, email, name, permissions }. */
export async function fetchMe() {
  return apiFetch("/api/account/me");
}

/** Change my own password (named users only). */
export async function changeMyPassword(currentPassword, newPassword) {
  return apiFetch("/api/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
