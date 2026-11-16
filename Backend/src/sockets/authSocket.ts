import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace } from 'socket.io';
import { env } from '../config/env.js';
import { authEvents } from '../services/authEvents.js';
// @ts-ignore plain JS module
import { notificationEvents } from '../../services/notificationEvents.js';
import { isAccountActive, verifyAccessToken, type AuthPrincipal, type Role } from '../services/tokenService.js';

export type InvalidReason = 'expired' | 'revoked' | 'invalid' | 'deactivated';

export type TokenCheckAck = (
  result: { valid: true; expiresIn: number } | { valid: false; reason: InvalidReason }
) => void;

interface ClientToServerEvents {
  /** Sent by the browser every 5s; may carry a freshly refreshed access token. */
  'token:check': (payload: { token?: string } | undefined, ack: TokenCheckAck) => void;
}

interface ServerToClientEvents {
  'notification:new': (notification: Record<string, unknown>) => void;
  /** The server dropped this connection because the token is no longer valid. */
  'auth:invalid': (payload: { reason: InvalidReason }) => void;
}

interface SocketData {
  principal: AuthPrincipal;
  token: string;
  checkWindowStart: number;
  checksInWindow: number;
}

type AuthNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

type Evaluation = { ok: true; principal: AuthPrincipal } | { ok: false; reason: InvalidReason };

const MAX_CHECKS_PER_SECOND = 10;

const evaluate = async (token: string, role: Role): Promise<Evaluation> => {
  const result = verifyAccessToken(token, role);
  if (!result.ok) return { ok: false, reason: result.reason };
  if (!(await isAccountActive(role, result.principal.id))) return { ok: false, reason: 'deactivated' };
  return result;
};

const drop = (namespaceSockets: ReturnType<AuthNamespace['sockets']['values']>, match: (p: AuthPrincipal) => boolean, reason: InvalidReason): void => {
  for (const socket of namespaceSockets) {
    if (!match(socket.data.principal)) continue;
    socket.emit('auth:invalid', { reason });
    socket.disconnect(true);
  }
};

const setupNamespace = (io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, path: string, role: Role): AuthNamespace => {
  const namespace = io.of(path);

  // Handshake: no valid token, no connection.
  namespace.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('AUTH_REQUIRED'));

    const result = await evaluate(token, role);
    if (!result.ok) return next(new Error(`AUTH_${result.reason.toUpperCase()}`));

    socket.data.principal = result.principal;
    socket.data.token = token;
    socket.data.checkWindowStart = Date.now();
    socket.data.checksInWindow = 0;
    next();
  });

  namespace.on('connection', (socket) => {
    socket.on('token:check', async (payload, ack) => {
      if (typeof ack !== 'function') return;

      // Flood guard: a well-behaved client checks once every 5s.
      const now = Date.now();
      if (now - socket.data.checkWindowStart >= 1000) {
        socket.data.checkWindowStart = now;
        socket.data.checksInWindow = 0;
      }
      if (++socket.data.checksInWindow > MAX_CHECKS_PER_SECOND) return void socket.disconnect(true);

      const candidate = typeof payload?.token === 'string' && payload.token ? payload.token : socket.data.token;
      const result = await evaluate(candidate, role);

      // A refreshed token is fine, but it must still belong to the user who opened this connection.
      if (!result.ok || result.principal.id !== socket.data.principal.id) {
        const reason: InvalidReason = result.ok ? 'invalid' : result.reason;
        ack({ valid: false, reason });
        socket.emit('auth:invalid', { reason });
        return void socket.disconnect(true);
      }

      socket.data.principal = result.principal;
      socket.data.token = candidate;
      ack({ valid: true, expiresIn: Math.max(0, result.principal.exp - Math.floor(Date.now() / 1000)) });
    });
  });

  // Server-side backstop: even a silent client gets dropped once its token expires or is revoked.
  let sweeping = false;
  setInterval(async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      for (const socket of namespace.sockets.values()) {
        const result = await evaluate(socket.data.token, role);
        if (!result.ok) {
          socket.emit('auth:invalid', { reason: result.reason });
          socket.disconnect(true);
        }
      }
    } finally {
      sweeping = false;
    }
  }, env.socket.sweepIntervalMs).unref();

  return namespace;
};

/** Attach Socket.io to the HTTP server: `/buyer`, `/admin` and `/rider` namespaces, each with its own token type. */
export const initAuthSockets = (httpServer: HttpServer): Server => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: [...env.allowedOrigins], credentials: true },
  });

  const namespaces: Array<{ role: Role; namespace: AuthNamespace }> = [
    { role: 'buyer', namespace: setupNamespace(io, '/buyer', 'buyer') },
    { role: 'superadmin', namespace: setupNamespace(io, '/admin', 'superadmin') },
    { role: 'rider', namespace: setupNamespace(io, '/rider', 'rider') },
  ];

  // Logout / password reset / deactivation: push the disconnect immediately instead of waiting for the next sweep.
  authEvents.on('session-revoked', ({ sid }) => {
    for (const { namespace } of namespaces) drop(namespace.sockets.values(), (p) => p.sid === sid, 'revoked');
  });
  authEvents.on('user-revoked', ({ role, userId, reason }) => {
    for (const entry of namespaces) {
      if (entry.role === role) drop(entry.namespace.sockets.values(), (p) => p.id === userId, reason);
    }
  });

  // Automatic / admin notifications: push to every open tab of that buyer
  notificationEvents.on('notification', ({ userId, notification }: { userId: string; notification: Record<string, unknown> }) => {
    const buyer = namespaces.find((entry) => entry.role === 'buyer');
    if (!buyer) return;
    for (const socket of buyer.namespace.sockets.values()) {
      if (socket.data.principal?.id === userId) socket.emit('notification:new', notification);
    }
  });

  // Admin broadcast: one pass over the connected sockets
  notificationEvents.on('notification-batch', ({ byUser }: { byUser: Map<string, Record<string, unknown>> }) => {
    const buyer = namespaces.find((entry) => entry.role === 'buyer');
    if (!buyer) return;
    for (const socket of buyer.namespace.sockets.values()) {
      const notification = byUser.get(socket.data.principal?.id);
      if (notification) socket.emit('notification:new', notification);
    }
  });

  return io;
};
