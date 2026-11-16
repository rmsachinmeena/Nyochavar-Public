import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { sellerModel, formatSeller } from '../models/sellerModel.js';
import { signSellerToken } from '../config/sellerAuth.js';
import { auditLogger } from '../services/auditLogger.js';

/**
 * What the superadmin can do with sellers. Every route runs requireAdmin first (routes/adminSellerRoutes.js).
 * The admin has the last word on every seller: approve, suspend, change the commission, reset the password, remove,
 * and open the seller's own panel to see exactly what the seller sees.
 */

const STATUSES = ['active', 'suspended', 'pending_approval'];
const isMissingSchema = (error) => error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST205');
const fail = (res, status, error) => res.status(status).json({ success: false, error });
const serverError = (res, label, err) => {
  console.error(`[AdminSellers] ${label}:`, err?.message || err);
  return fail(
    res,
    500,
    isMissingSchema(err) ? 'The seller database update (migrations 028 to 030) has not been run yet. Please run them in the Supabase SQL editor.' : 'Something went wrong. Please try again.'
  );
};

// Products and sales of every seller in one pass (the list page shows them next to each store)
const loadSellerCounts = async () => {
  const counts = {};
  const { data: products, error } = await supabase.from('products').select('id, seller_id, is_active').not('seller_id', 'is', null);
  if (error) throw error;
  const owner = {};
  for (const product of products || []) {
    owner[product.id] = product.seller_id;
    const entry = (counts[product.seller_id] ||= { products: 0, liveProducts: 0, orders: 0 });
    entry.products += 1;
    if (product.is_active !== false) entry.liveProducts += 1;
  }

  if (Object.keys(owner).length > 0) {
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, items, order_status')
      .neq('order_status', 'awaiting_payment')
      .neq('order_status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (orderError) throw orderError;
    for (const order of orders || []) {
      const sellersInOrder = new Set();
      for (const item of Array.isArray(order.items) ? order.items : []) {
        const sellerId = owner[item?.product_id || item?.productId];
        if (sellerId) sellersInOrder.add(sellerId);
      }
      for (const sellerId of sellersInOrder) (counts[sellerId] ||= { products: 0, liveProducts: 0, orders: 0 }).orders += 1;
    }
  }
  return counts;
};

// A seller's products follow the seller: suspended = hidden from the store, active = shown (unless the store is on vacation)
const setProductsVisible = async (sellerId, visible) => {
  const { error } = await supabase.from('products').update({ is_active: visible }).eq('seller_id', sellerId);
  if (error) throw error;
};

const adminActor = (req) => ({ admin_id: req.auth?.id });

export const adminSellerController = {
  // GET /api/admin/sellers
  list: async (req, res) => {
    try {
      const { data, error } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const counts = await loadSellerCounts();
      const sellers = (data || []).map((row) => ({ ...formatSeller(row), ...(counts[row.id] || { products: 0, liveProducts: 0, orders: 0 }) }));
      return res.status(200).json({ success: true, sellers });
    } catch (err) {
      return serverError(res, 'list', err);
    }
  },

  // GET /api/admin/sellers/:id
  get: async (req, res) => {
    try {
      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');
      const counts = await loadSellerCounts();
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, base_price, stock, is_active, images, created_at')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, seller: { ...seller, ...(counts[seller.id] || { products: 0, liveProducts: 0, orders: 0 }) }, products: products || [] });
    } catch (err) {
      return serverError(res, 'get', err);
    }
  },

  // PATCH /api/admin/sellers/:id/status  { status: 'active' | 'suspended' | 'pending_approval', reason? }
  setStatus: async (req, res) => {
    try {
      const { status, reason } = req.body || {};
      if (!STATUSES.includes(status)) return fail(res, 400, 'Status must be active, suspended or pending_approval');

      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      const updated = await sellerModel.update(seller.id, {
        status,
        is_active: status === 'active',
        suspended_reason: status === 'suspended' ? String(reason || '').trim().slice(0, 300) || null : null,
        status_changed_at: new Date().toISOString(),
      });
      // Only an active store sells: its products are hidden otherwise (and stay hidden while it is on vacation)
      await setProductsVisible(seller.id, status === 'active' && !seller.is_vacation_mode);

      await auditLogger.log({ ...adminActor(req), action: status === 'active' ? 'ACTIVATE_SELLER' : status === 'suspended' ? 'SUSPEND_SELLER' : 'HOLD_SELLER', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true, seller: updated });
    } catch (err) {
      return serverError(res, 'setStatus', err);
    }
  },

  // PATCH /api/admin/sellers/:id/commission  { rate: 0.12 | null }  (null = back to the store-wide rate)
  setCommission: async (req, res) => {
    try {
      const raw = req.body?.rate;
      let rate = null;
      if (raw !== null && raw !== undefined && raw !== '') {
        rate = Number(raw);
        if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) return fail(res, 400, 'The commission must be between 0% and 50%');
        rate = Math.round(rate * 10000) / 10000;
      }
      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      const updated = await sellerModel.update(seller.id, { commission_rate: rate });
      await auditLogger.log({ ...adminActor(req), action: 'SET_SELLER_COMMISSION', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true, seller: updated });
    } catch (err) {
      return serverError(res, 'setCommission', err);
    }
  },

  // PUT /api/admin/sellers/:id  (store details the admin may correct)
  update: async (req, res) => {
    try {
      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      const allowed = ['store_name', 'owner_name', 'category', 'city', 'pincode', 'street_address', 'pickup_slot', 'kyc_status', 'gstin', 'pan'];
      const updates = {};
      for (const key of allowed) {
        if (req.body?.[key] !== undefined) updates[key] = String(req.body[key] ?? '').trim().slice(0, 300) || null;
      }
      if (updates.kyc_status && !['unverified', 'pending', 'verified', 'rejected'].includes(updates.kyc_status)) {
        return fail(res, 400, 'Invalid KYC status');
      }
      if (updates.store_name === null) return fail(res, 400, 'Store name cannot be empty');
      if (Object.keys(updates).length === 0) return fail(res, 400, 'Nothing to update');

      const updated = await sellerModel.update(seller.id, updates);
      await auditLogger.log({ ...adminActor(req), action: 'UPDATE_SELLER', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true, seller: updated });
    } catch (err) {
      return serverError(res, 'update', err);
    }
  },

  // POST /api/admin/sellers/:id/reset-password  -> a temporary password, shown to the admin once
  resetPassword: async (req, res) => {
    try {
      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      // Easy to read out on the phone: letters that are not confused with digits, plus 4 digits
      const letters = 'abcdefghjkmnpqrstuvwxyz';
      const word = Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join('');
      const password = `${word}-${randomInt(1000, 10000)}`;

      await sellerModel.updatePassword(seller.id, await bcrypt.hash(password, 10));
      await auditLogger.log({ ...adminActor(req), action: 'RESET_SELLER_PASSWORD', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true, password, message: 'Share this password with the seller. They can change it from Settings.' });
    } catch (err) {
      return serverError(res, 'resetPassword', err);
    }
  },

  // DELETE /api/admin/sellers/:id  (the seller's products go with the account)
  remove: async (req, res) => {
    try {
      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      const { error: productError } = await supabase.from('products').delete().eq('seller_id', seller.id);
      if (productError) throw productError;
      const { error } = await supabase.from('sellers').delete().eq('id', seller.id);
      if (error) throw error;

      await auditLogger.log({ ...adminActor(req), action: 'DELETE_SELLER', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true });
    } catch (err) {
      return serverError(res, 'remove', err);
    }
  },

  // POST /api/admin/sellers/:id/open-panel  { masterPassword }  -> a seller token for the admin to open the seller's panel
  openPanel: async (req, res) => {
    try {
      const master = process.env.SELLER_MASTER_PASSWORD;
      if (!master || master.length < 8) {
        return fail(res, 503, 'SELLER_MASTER_PASSWORD is not set on the server (at least 8 characters).');
      }
      const given = String(req.body?.masterPassword || '');
      // Same-length compare so a wrong password takes the same time as a right one
      const a = Buffer.from(given);
      const b = Buffer.from(master);
      const same = a.length === b.length && timingSafeEqual(a, b);
      if (!same) return fail(res, 401, 'Wrong master password');

      const seller = await sellerModel.findById(req.params.id);
      if (!seller) return fail(res, 404, 'Seller not found');

      // Short-lived, and marked, so the seller panel can show "viewing as admin"
      const token = signSellerToken(seller, { impersonatedBy: req.auth?.id || 'admin', impersonatorName: req.auth?.name || 'Admin', expiresIn: '2h' });
      await auditLogger.log({ ...adminActor(req), action: 'OPEN_SELLER_PANEL', table_affected: 'sellers', record_id: seller.id });
      return res.status(200).json({ success: true, token, seller });
    } catch (err) {
      return serverError(res, 'openPanel', err);
    }
  },
};
