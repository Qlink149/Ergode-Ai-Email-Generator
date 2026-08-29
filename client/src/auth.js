import { createContext, useContext } from "react";

/**
 * auth.js
 * -------
 * Carries the logged-in identity (`me` from GET /api/account/me) down the
 * tree so any component can check a permission without prop-drilling.
 *
 *   const { me } = useAuth();
 *   if (can(me, "approveProposals")) { ... }
 *
 * `me` is null only during the brief load right after login. Permissions
 * are ALSO enforced server-side - these checks just hide UI.
 */

export const AuthContext = createContext({ me: null, refreshMe: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

/** True if the current user has the named action permission. */
export function can(me, key) {
  return Boolean(me && me.permissions && me.permissions[key]);
}

/** True if the current user may see the given tab id. */
export function canSeeTab(me, tabId) {
  return Boolean(me && me.permissions && Array.isArray(me.permissions.tabs) && me.permissions.tabs.includes(tabId));
}
