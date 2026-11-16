import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { sellerModel } from '../models/sellerModel.js';

// Seller sign-in token. JWT_SELLER_SECRET (32+ characters) is used when it is set; otherwise a key is derived from the
// admin secret, so there is never a secret written in the code. Set JWT_SELLER_SECRET on Render to keep it separate.
const SELLER_SECRET =
  process.env.JWT_SELLER_SECRET && process.env.JWT_SELLER_SECRET.length >= 32
    ? process.env.JWT_SELLER_SECRET
    : crypto.createHmac('sha256', env.jwt.adminSecret).update('nyochavar-seller-token-v1').digest('hex');

const TOKEN_TTL = '7d';

/**
 * Signs a seller session token. `extra.impersonatedBy` marks a token the superadmin took to open this seller's panel
 * (the panel then shows "viewing as admin"); `extra.expiresIn` shortens the life of such a token.
 */
export const signSellerToken = (seller, extra = {}) => {
  const { expiresIn, ...claims } = extra;
  return jwt.sign(
    {
      id: seller.id,
      sellerId: seller.id,
      email: seller.email,
      phone: seller.phone,
      storeName: seller.store_name,
      role: 'seller',
      ...claims,
    },
    SELLER_SECRET,
    { expiresIn: expiresIn || TOKEN_TTL, issuer: env.jwt.issuer }
  );
};

const reject = (res, status, code, message) => res.status(status).json({ success: false, code, error: message });

/**
 * Seller-only routes: checks the `Authorization: Bearer <seller token>` header, loads the seller from the database
 * (so a suspended or removed seller is stopped at once) and puts it on `req.seller`.
 */
export const requireSeller = async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return reject(res, 401, 'AUTH_REQUIRED', 'Please sign in to your seller account.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, SELLER_SECRET, { issuer: env.jwt.issuer });
  } catch (err) {
    return err?.name === 'TokenExpiredError'
      ? reject(res, 401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.')
      : reject(res, 401, 'TOKEN_INVALID', 'Invalid session. Please sign in again.');
  }

  if (decoded.role !== 'seller') return reject(res, 403, 'FORBIDDEN_ROLE', 'You do not have permission to access this resource.');

  try {
    const seller = await sellerModel.findById(decoded.id || decoded.sellerId);
    if (!seller) return reject(res, 401, 'ACCOUNT_DISABLED', 'This seller account no longer exists.');
    if (seller.status === 'suspended' || seller.is_active === false) {
      return reject(res, 403, 'ACCOUNT_SUSPENDED', 'Your seller account has been suspended. Please contact partner support.');
    }
    req.seller = seller;
    // Who is really behind this request: the seller, or a superadmin looking at the seller's panel
    req.sellerImpersonatedBy = decoded.impersonatedBy || null;
    return next();
  } catch (err) {
    console.error('Seller auth check failed:', err);
    return reject(res, 500, 'AUTH_CHECK_FAILED', 'Could not check your session. Please try again.');
  }
};
