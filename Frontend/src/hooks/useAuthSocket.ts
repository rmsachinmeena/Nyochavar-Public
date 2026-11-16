import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '../services/api';
import { ApiError, emitSessionEnded, refreshAccessToken, tokenMsRemaining, tokenStore, type Role } from '../services/apiClient';
import { API_BASE_URL } from '../services/apiConfig';

/** How often the browser proves to the server that its token is still good. */
const CHECK_INTERVAL_MS = 5_000;
/** Renew the access token when less than this is left, so users never hit an expired token. */
const REFRESH_WINDOW_MS = 60_000;
/** Consecutive transport failures before falling back to plain HTTP polling. */
const POLL_FALLBACK_AFTER = 3;

const NAMESPACES: Record<Role, string> = {
  buyer: '/buyer',
  superadmin: '/admin',
  rider: '/rider',
};

const socketOrigin = (): string => {
  const override = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim().replace(/\/+$/, '');
  return override || new URL(API_BASE_URL, window.location.href).origin;
};

type CheckResult = { valid: true; expiresIn: number } | { valid: false; reason: string };

/**
 * Keeps one session honest: every 5 seconds the current access token is verified by the backend over
 * Socket.io (namespace per role). An expired token is renewed silently; a revoked, deactivated or
 * otherwise invalid one ends the session. If the socket cannot connect (e.g. the API sits behind a
 * serverless host), the same check runs over `GET /auth/check` instead.
 */
export function useAuthSocket(role: Role, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let ticking = false;
    let pollMode = false;
    let transportFailures = 0;
    let socket: Socket | null = null;

    const endSession = (reason: string) => {
      if (stopped) return;
      stopped = true;
      socket?.disconnect();
      emitSessionEnded(role, reason);
    };

    // A token the server refused as expired gets one renewal attempt before we give up
    // The server reports an invalid token twice (ack + 'auth:invalid'); handle it once
    let handlingInvalid = false;
    const handleInvalid = async (reason: string) => {
      if (stopped || handlingInvalid) return;
      handlingInvalid = true;
      try {
        if (reason === 'expired') {
          const renewed = await refreshAccessToken(role);
          if (renewed) {
            // Reconnect so the handshake carries the new token
            if (socket) {
              socket.disconnect();
              socket.connect();
            }
            return;
          }
          // Refresh failed on the network (phone just woke up / offline), not refused: retry on the next tick
          if (tokenStore.get(role)) return;
        }
        endSession(reason);
      } finally {
        handlingInvalid = false;
      }
    };

    const openSocket = () => {
      socket = io(`${socketOrigin()}${NAMESPACES[role]}`, {
        // Function form: every (re)connect handshake reads the latest token
        auth: (cb) => cb({ token: tokenStore.get(role) ?? '' }),
        transports: ['websocket', 'polling'],
        reconnectionDelayMax: 10_000,
      });

      socket.on('connect', () => {
        transportFailures = 0;
        pollMode = false;
      });

      socket.on('auth:invalid', ({ reason }: { reason: string }) => void handleInvalid(reason));

      // Live notifications (automatic messages and admin broadcasts) pushed by the server to this shopper
      if (role === 'buyer') {
        socket.on('notification:new', (notification: unknown) => {
          window.dispatchEvent(new CustomEvent('petal:notification', { detail: notification }));
        });
      }

      socket.on('connect_error', (error: Error) => {
        if (error.message.startsWith('AUTH_')) {
          void handleInvalid(error.message.replace('AUTH_', '').toLowerCase());
          return;
        }
        transportFailures += 1;
        if (transportFailures >= POLL_FALLBACK_AFTER) pollMode = true;
      });
    };

    const tick = async () => {
      if (stopped || ticking) return;
      ticking = true;
      try {
        let token = tokenStore.get(role);
        if (!token) return; // No active token to check; do not end session or force redirect

        const remaining = tokenMsRemaining(token);
        if (remaining !== null && remaining < REFRESH_WINDOW_MS) {
          const renewed = await refreshAccessToken(role);
          if (renewed) token = renewed;
          // Refused by the server: the session is over
          else if (!tokenStore.get(role)) return endSession('expired');
          // Network hiccup with an already-expired token: nothing to check yet, try again next tick
          else if (remaining <= 0) return;
        }

        if (socket?.connected) {
          const result = await new Promise<CheckResult | null>((resolve) => {
            socket!.timeout(4_000).emit('token:check', { token }, (error: Error | null, ack: CheckResult) => resolve(error ? null : ack));
          });
          if (result && result.valid === false) await handleInvalid(result.reason);
        } else if (pollMode) {
          try {
            await api.checkSession(role);
          } catch (error) {
            // authFetch already renewed/ended the session on token problems; another 401 means it is really over.
            // TOKEN_EXPIRED that survives authFetch is a refresh that failed on the network: retry next tick.
            if (error instanceof ApiError && error.status === 401 && error.code !== 'TOKEN_EXPIRED') {
              endSession(error.code === 'TOKEN_REVOKED' ? 'revoked' : 'invalid');
            }
          }
        }
      } finally {
        ticking = false;
      }
    };

    openSocket();
    const timer = window.setInterval(tick, CHECK_INTERVAL_MS);
    void tick();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [role, enabled]);
}
