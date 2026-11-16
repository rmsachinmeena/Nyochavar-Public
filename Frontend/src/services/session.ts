import { refreshAccessToken, isTokenFresh, tokenStore, type Role } from './apiClient';

/**
 * Is there a usable session for this role right now? Used by route guards.
 * A fresh token is enough; a stale or missing one is renewed from the refresh cookie when a login hint exists.
 */
export const ensureSession = async (role: Role, hasLoginHint: boolean): Promise<boolean> => {
  const token = tokenStore.get(role);
  if (token && isTokenFresh(token)) return true;
  if (!token && !hasLoginHint) return false;
  try {
    if ((await refreshAccessToken(role)) !== null) return true;
  } catch {
    // network failure on refresh
  }
  // Still holding a token or having a verified login hint keeps the user on their screen
  return tokenStore.get(role) !== null || hasLoginHint;
};
