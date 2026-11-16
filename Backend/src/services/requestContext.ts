import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import type { AuthPrincipal } from './tokenService.js';

interface RequestContext {
  auth?: AuthPrincipal;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Opens a per-request context so deep code (e.g. the audit logger) can see who is acting. */
export const bindRequestContext: RequestHandler = (_req, _res, next) => {
  storage.run({}, next);
};

export const setContextAuth = (principal: AuthPrincipal): void => {
  const store = storage.getStore();
  if (store) store.auth = principal;
};

/** Id of the superadmin behind the current request, if any. */
export const currentAdminId = (): string | null => {
  const auth = storage.getStore()?.auth;
  return auth?.role === 'superadmin' ? auth.id : null;
};

/** Who is behind the current request, in the roles the audit log uses (admin / rider / buyer). */
export const currentActor = (): { role: 'admin' | 'rider' | 'buyer'; id: string } | null => {
  const auth = storage.getStore()?.auth;
  if (!auth) return null;
  const role = auth.role === 'superadmin' ? 'admin' : auth.role;
  return role === 'rider' || role === 'buyer' || role === 'admin' ? { role, id: auth.id } : null;
};
