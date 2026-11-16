import { EventEmitter } from 'node:events';
import type { Role } from './tokenService.js';

interface AuthEventMap {
  /** One login session (refresh-token family) was revoked, e.g. by logout or refresh-token reuse. */
  'session-revoked': [{ sid: string }];
  /** Every session of a user was revoked, e.g. password reset or account deactivation. */
  'user-revoked': [{ role: Role; userId: string; reason: 'revoked' | 'deactivated' }];
}

/** Lets tokenService tell the socket layer to drop live connections without importing it. */
export const authEvents = new EventEmitter<AuthEventMap>();
