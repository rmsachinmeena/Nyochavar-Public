import dotenv from 'dotenv';

dotenv.config();

const MIN_SECRET_LENGTH = 32;

const requireSecret = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Missing or weak env var ${name}: set a random string of at least ${MIN_SECRET_LENGTH} characters ` +
        `(generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`
    );
  }
  return value;
};

const buyerSecret = requireSecret('JWT_BUYER_SECRET');
const adminSecret = requireSecret('JWT_ADMIN_SECRET');
const riderSecret = requireSecret('JWT_RIDER_SECRET');

if (new Set([buyerSecret, adminSecret, riderSecret]).size !== 3) {
  throw new Error('JWT_BUYER_SECRET, JWT_ADMIN_SECRET and JWT_RIDER_SECRET must all be different');
}

const isProduction = process.env.NODE_ENV === 'production';

const parseOrigins = (raw: string | undefined): string[] =>
  (raw ?? 'http://localhost:9000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  // Render (and most PaaS) put one reverse proxy in front of the app; without this every client shares one IP
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : isProduction ? 1 : 0,
  allowedOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
  jwt: {
    buyerSecret,
    adminSecret,
    riderSecret,
    issuer: 'petal-pen',
    accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 15 * 60,
    // Sliding window: every refresh restarts it, so only 30 days without opening the app signs a user out
    refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 30 * 24 * 60 * 60,
  },
  socket: {
    // Sweep interval for server-side token re-validation (clients also ping every 5s)
    sweepIntervalMs: 5000,
  },
} as const;
