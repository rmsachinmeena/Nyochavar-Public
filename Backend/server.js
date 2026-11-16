import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './src/config/env.js';
import { errorHandler, notFoundHandler } from './src/middlewares/errorHandler.js';
import { createRouter } from './src/middlewares/rateLimiter.js';
import { hideServerErrorDetails } from './src/middlewares/security.js';
import { bindRequestContext } from './src/services/requestContext.js';
import { initAuthSockets } from './src/sockets/authSocket.js';
import authRoutes from './routes/authRoutes.js';
import phoneAuthRoutes from './routes/phoneAuthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes, { razorpayWebhookRouter } from './routes/paymentRoutes.js';
import { startPaymentReconciler } from './services/paymentReconciler.js';
import notificationAdminRoutes from './routes/notificationAdminRoutes.js';
import whatsappAdminRoutes from './routes/whatsappAdminRoutes.js';
import { whatsappBotService } from './services/whatsappBotService.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import riderRoutes from './routes/riderRoutes.js';
import deliveryPartnerRoutes from './routes/deliveryPartnerRoutes.js';
import copyRoutes from './routes/copyRoutes.js';
import internalEmailRoutes from './routes/internalEmailRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import sellerAuthRoutes from './routes/sellerAuthRoutes.js';
import sellerPortalRoutes from './routes/sellerPortalRoutes.js';
import adminSellerRoutes from './routes/adminSellerRoutes.js';

const app = express();

// Render terminates TLS at a reverse proxy: trust it so req.ip (rate limits) and secure cookies work
if (env.trustProxy) app.set('trust proxy', env.trustProxy);

// Health check for Render / uptime pings. Registered before everything else and deliberately NOT
// rate limited: the platform probes it every few seconds from the same address.
app.get('/healthz', (req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: only the configured frontend origins, with credentials so the refresh cookie can travel
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header => not a browser (curl, health checks, server-to-server)
      if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  })
);

app.use(cookieParser());
app.use(bindRequestContext);
app.use(hideServerErrorDetails);

// Razorpay webhook: its signature is computed over the untouched raw body, so it must run before the JSON parser
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhookRouter);

// Small JSON bodies by default; only the admin/content routes may send base64 images
const smallJson = express.json({ limit: '100kb' });
const largeJson = express.json({ limit: '15mb' });
const LARGE_BODY_PREFIXES = ['/api/products', '/api/banners', '/api/categories', '/api/orders', '/api/user', '/api/payments/razorpay/order'];
app.use((req, res, next) => {
  const isLarge = LARGE_BODY_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
  return (isLarge ? largeJson : smallJson)(req, res, next);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/phone', phoneAuthRoutes);
app.use('/api/user', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/notifications', notificationAdminRoutes);
app.use('/api/admin/whatsapp', whatsappAdminRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/delivery-partners', deliveryPartnerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/seller/auth', sellerAuthRoutes);
app.use('/api/seller', sellerPortalRoutes);
app.use('/api/admin/sellers', adminSellerRoutes);
app.use('/api/internal', internalEmailRoutes);
app.use('/api', copyRoutes);
app.use('/', copyRoutes);

// Test endpoints (rate limited like everything else)
const meta = createRouter();
meta.get('/', (req, res) => {
 console.log(' / backend Check', new Date().toLocaleTimeString('en-GB', { hour12: false }));
  res.send('hello users');
});
meta.get('/test', (req, res) => {
 console.log(' / test backend Check', new Date().toLocaleTimeString('en-GB', { hour12: false }));
  res.status(200).json({ status: 'ok', message: 'Backend server is running' });
});
app.use('/', meta);

app.use(notFoundHandler);
app.use(errorHandler);

// HTTP + Socket.io share one server so token checks ride on the same port (Render exposes a single port)
const httpServer = http.createServer(app);
const io = initAuthSockets(httpServer);

// Render's proxy keeps connections alive ~60s; staying above that avoids sporadic 502s
httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout = 66_000;
httpServer.requestTimeout = 60_000;

httpServer.listen(env.port, '0.0.0.0', () => {
  console.log(`🚀⭐ Server running on https://localhost:${env.port} (${env.isProduction ? 'PRODUCTION 🚀🟢🌐' : 'LOCAL HOST DEVELOPMENT 💻🔗'})`);
  // Automatically restore WhatsApp bot connection without requiring QR re-scan
  setTimeout(() => {
    whatsappBotService.autoResume();
  }, 1500);
  // Settles or expires online orders left waiting for payment (closed tabs, slow UPI approvals)
  startPaymentReconciler();
});

// Render sends SIGTERM on every deploy/restart: stop accepting work, let in-flight requests finish
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: shutting down gracefully`);
  // Hand the WhatsApp session over cleanly: this instance stops using it and does not reconnect
  whatsappBotService.stopForShutdown();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A stray rejection should be logged, not silently kill the whole API
process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

export default app;
