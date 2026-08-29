/**
 * api/users.js
 * ------------
 * User Management (admin / manageUsers only) - see server/routes/users.js.
 */

import { apiFetch } from "./client.js";

export async function listUsers() {
  return apiFetch("/api/users");
}

export async function createUser({ email, name, password, permissions }) {
  return apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password, permissions }),
  });
}

export async function updateUser(id, patch) {
  return apiFetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function resetUserPassword(id, newPassword) {
  return apiFetch(`/api/users/${id}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
}
