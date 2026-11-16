import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { productModel } from '../models/productModel.js';
import { sellerModel } from '../models/sellerModel.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

/**
 * Everything a signed-in seller does in the seller portal: store settings, own products, own orders, earnings.
 * Every route runs requireSeller first (config/sellerAuth.js), so `req.seller` is always the signed-in seller and
 * a seller can only ever read or change their own rows.
 */

// Share of each sale kept by Nyochavar. Set SELLER_COMMISSION_RATE (for example 0.12) to change it.
const COMMISSION_RATE = (() => {
  const rate = Number(process.env.SELLER_COMMISSION_RATE);
  return Number.isFinite(rate) && rate >= 0 && rate <= 0.5 ? rate : 0.1;
})();

// The superadmin may give one seller a different rate (sellers.commission_rate); otherwise the store-wide rate applies
const commissionFor = (seller) => {
  const own = Number(seller?.commission_rate);
  return Number.isFinite(own) && own >= 0 && own <= 0.5 ? own : COMMISSION_RATE;
};

const RECENT_ORDERS_LIMIT = 500;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const isMissingSchema = (error) => error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST205');
const SCHEMA_HINT = 'The seller database update (migrations 028 and 029) has not been run yet. Please run them in the Supabase SQL editor.';

const fail = (res, status, error) => res.status(status).json({ success: false, error });

const serverError = (res, label, err) => {
  console.error(`[SellerPortal] ${label}:`, err?.message || err);
  return fail(res, 500, isMissingSchema(err) ? SCHEMA_HINT : 'Something went wrong. Please try again.');
};

// ---------------------------------------------------------------------------------------------------------------
// Orders (an order belongs to a seller when it holds at least one of the seller's products)
// ---------------------------------------------------------------------------------------------------------------
const ORDER_COLUMNS =
  'id, order_number, created_at, items, recipient_name, recipient_phone, address_line, city, pincode, payment_method, ' +
  'payment_status, order_status, gift_message, delivery_partner_name, delivered_at';

const itemProductId = (item) => item?.product_id || item?.productId || null;

const paymentLabel = (method) => {
  const value = String(method || '').toLowerCase();
  if (value.includes('cod') || value.includes('cash')) return 'COD';
  if (value.includes('card')) return 'Card';
  return 'UPI';
};

// Where the order is for the seller: the order's own status wins once the rider/admin has moved it on
const sellerStatusOf = (order, update) => {
  if (order.order_status === 'cancelled') return 'cancelled';
  if (order.order_status === 'delivered') return 'delivered';
  if (order.order_status === 'out_for_delivery') return 'in_transit';
  return update?.status === 'ready_for_pickup' ? 'ready_for_pickup' : 'new';
};

const shapeOrder = (order, productIds, update, rate) => {
  const mine = (Array.isArray(order.items) ? order.items : []).filter((item) => productIds.has(itemProductId(item)));
  const subtotal = money(mine.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0));
  const commissionAmount = money(subtotal * rate);
  const status = sellerStatusOf(order, update);
  return {
    id: order.id,
    orderNumber: order.order_number || String(order.id),
    orderDate: order.created_at,
    buyerName: order.recipient_name || 'Customer',
    buyerPhone: order.recipient_phone || '',
    shippingAddress: order.address_line || '',
    city: order.city || '',
    pincode: order.pincode || '',
    items: mine.map((item) => ({
      productId: itemProductId(item),
      title: item.name || 'Product',
      image: item.image || '',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      customMessage: order.gift_message || undefined,
    })),
    subtotal,
    commissionRate: rate,
    commissionAmount,
    payoutAmount: money(subtotal - commissionAmount),
    paymentMethod: paymentLabel(order.payment_method),
    status,
    // The code the rider shows when picking the parcel up (only while the parcel waits for the rider)
    pickupOtp: status === 'ready_for_pickup' ? update?.pickup_otp || undefined : undefined,
    trackingNumber: status === 'in_transit' || status === 'delivered' ? order.order_number || undefined : undefined,
    courierPartner: order.delivery_partner_name || undefined,
    deliveredAt: order.delivered_at || null,
  };
};

const loadSellerProductIds = async (sellerId) => {
  const { data, error } = await supabase.from('products').select('id').eq('seller_id', sellerId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.id));
};

const loadRecentOrders = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .neq('order_status', 'awaiting_payment')
    .order('created_at', { ascending: false })
    .limit(RECENT_ORDERS_LIMIT);
  if (error) throw error;
  // A cancelled order that was never paid (an abandoned checkout) is not a sale: leave it out
  return (data || []).filter((order) => !(order.order_status === 'cancelled' && order.payment_status !== 'paid'));
};

const loadUpdates = async (sellerId, orderIds) => {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('seller_order_updates')
    .select('order_id, status, pickup_otp')
    .eq('seller_id', sellerId)
    .in('order_id', orderIds);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.order_id, row]));
};

const loadSellerOrders = async (seller) => {
  const sellerId = seller.id;
  const rate = commissionFor(seller);
  const productIds = await loadSellerProductIds(sellerId);
  if (productIds.size === 0) return { productIds, orders: [] };

  const rows = (await loadRecentOrders()).filter((order) =>
    (Array.isArray(order.items) ? order.items : []).some((item) => productIds.has(itemProductId(item)))
  );
  const updates = await loadUpdates(sellerId, rows.map((order) => String(order.id)));
  return { productIds, orders: rows.map((order) => shapeOrder(order, productIds, updates.get(String(order.id)), rate)) };
};

// ---------------------------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------------------------
const shapeProduct = (row, salesCount = 0) => ({
  id: row.id,
  title: row.name,
  sku: row.sku || '',
  category: row.categories?.name || '',
  description: row.description || '',
  price: Number(row.base_price) || 0,
  mrp: Number(row.mrp) || Number(row.base_price) || 0,
  stock: Number(row.stock) || 0,
  inStock: (Number(row.stock) || 0) > 0 && row.is_active !== false,
  images: Array.isArray(row.images) ? row.images : [],
  status: 'approved',
  rating: Number(row.rating) || 0,
  reviewsCount: Number(row.review_count) || 0,
  salesCount,
  allowCustomNote: Boolean(row.is_customizable),
  weightGrams: Number(row.weight_grams) || 0,
  tagline: row.tagline || '',
  occasions: Array.isArray(row.occasions) ? row.occasions : [],
  variants: Array.isArray(row.variants) ? row.variants : [],
  details: row.details && typeof row.details === 'object' ? row.details : {},
  createdAt: row.created_at ? String(row.created_at).slice(0, 10) : '',
});

const PRODUCT_SELECT = '*, categories:category_id(id, name)';

const findOwnProduct = async (sellerId, productId) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// Checks the product form; returns the cleaned values or a readable error
const readProductForm = (body, { partial = false } = {}) => {
  const out = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has('title')) {
    const title = String(body.title ?? '').trim();
    if (!title) return { error: 'Product name is required' };
    if (title.length > 150) return { error: 'Product name is too long (150 characters at most)' };
    out.name = title;
  }
  if (!partial || has('price')) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) return { error: 'Enter a selling price greater than 0' };
    out.base_price = money(price);
  }
  if (has('mrp')) {
    const mrp = Number(body.mrp);
    if (!Number.isFinite(mrp) || mrp < 0 || mrp > 1_000_000) return { error: 'Enter a valid MRP' };
    out.mrp = money(mrp);
  }
  if (out.mrp !== undefined && out.base_price !== undefined && out.mrp !== 0 && out.mrp < out.base_price) {
    return { error: 'MRP cannot be lower than the selling price' };
  }
  if (!partial || has('stock')) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) return { error: 'Stock must be a whole number from 0 to 100000' };
    out.stock = stock;
  }
  if (!partial || has('images')) {
    const images = Array.isArray(body.images) ? body.images.map((url) => String(url).trim()).filter(Boolean) : [];
    if (images.length === 0) return { error: 'Add at least one product picture' };
    if (images.length > 8) return { error: 'You can add up to 8 pictures' };
    if (images.some((url) => !/^https?:\/\//i.test(url) || url.length > 1000)) return { error: 'Picture links must start with http:// or https://' };
    out.images = images;
  }
  if (has('description')) out.description = String(body.description ?? '').trim().slice(0, 4000) || null;
  if (has('allowCustomNote')) out.is_customizable = Boolean(body.allowCustomNote);
  if (has('category')) out.category = String(body.category ?? '').trim();
  if (!partial && !out.category) return { error: 'Choose a category' };

  const extra = {};
  if (has('sku')) extra.sku = String(body.sku ?? '').trim().slice(0, 60) || null;
  if (has('weightGrams')) {
    const weight = Number(body.weightGrams);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1_000_000) return { error: 'Enter a valid weight in grams' };
    extra.weight_grams = Math.round(weight);
  }
  return { fields: out, extra };
};

const GST_RATES = ['0', '5', '12', '18', '28'];
const RETURN_POLICIES = ['damaged', 'seven_days', 'none'];
const PRODUCT_TYPES = ['ready', 'made_to_order'];

const text = (value, max) => String(value ?? '').trim().slice(0, max);

// Reads and checks the options (sizes, flavours...) of a listing. Returns { error } or { variants }.
const readVariants = (input, images, sellerId) => {
  if (!input || !Array.isArray(input.items) || input.items.length === 0) return { variants: [] };

  const label = text(input.label, 30);
  if (!label) return { error: 'Say what the options are, for example Size or Flavour' };
  if (input.items.length > 10) return { error: 'You can add up to 10 options' };

  const heading = /^select\b/i.test(label) ? label : `Select ${label}`;
  const seenNames = new Set();
  const seenIds = new Set();
  const variants = [];

  for (const item of input.items) {
    const name = text(item?.name, 40);
    if (!name) return { error: 'Every option needs a name' };
    if (seenNames.has(name.toLowerCase())) return { error: `Two options are called "${name}"` };
    seenNames.add(name.toLowerCase());

    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) return { error: `Enter a price for the option "${name}"` };
    let mrp = null;
    if (item.mrp !== undefined && item.mrp !== null && item.mrp !== '') {
      mrp = Number(item.mrp);
      if (!Number.isFinite(mrp) || mrp <= 0 || mrp > 1_000_000) return { error: `Enter a valid MRP for the option "${name}"` };
      if (mrp < price) return { error: `The MRP of "${name}" cannot be lower than its price` };
    }
    const stock = Number(item.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) return { error: `Enter the stock of the option "${name}"` };

    // The option's own pictures: this seller's uploads (kept in their own storage folder) or product pictures already accepted.
    // Older clients sent one "image"; that still works.
    const given = Array.isArray(item.images) ? item.images : item.image ? [item.image] : [];
    if (given.length > 4) return { error: `The option "${name}" can have at most 4 pictures` };
    const optionImages = [];
    for (const raw of given) {
      const url = text(raw, 1000);
      if (!url) continue;
      const own = /^https:\/\/res\.cloudinary\.com\//.test(url) && url.includes(`/GIFT_APPLICATION/sellers/${sellerId}/`);
      if (!own && !images.includes(url)) return { error: `A picture of the option "${name}" is not one you uploaded` };
      if (!optionImages.includes(url)) optionImages.push(url);
    }

    let id = text(item.id, 40);
    if (!/^var_[a-z0-9]+$/.test(id) || seenIds.has(id)) id = `var_${randomBytes(5).toString('hex')}`;
    seenIds.add(id);

    variants.push({
      id,
      name,
      label: heading,
      price: money(price),
      ...(mrp ? { mrp: money(mrp) } : {}),
      ...(optionImages.length > 0 ? { image: optionImages[0], images: optionImages } : {}),
      stock,
      ...(text(item.sku, 60) ? { sku: text(item.sku, 60) } : {}),
    });
  }
  return { variants };
};

// Reads and checks the rest of the listing form: tagline, occasions, gifting options, options (variants) and product
// information. Returns { error } or { fields (for the product row), details (one JSON object of product information) }.
const readListingExtras = (body, images, sellerId) => {
  const fields = {};

  const tagline = text(body.tagline, 200);
  if (tagline.length > 80) return { error: 'The tagline can have at most 80 characters' };
  if (body.tagline !== undefined) fields.tagline = tagline;

  if (body.occasions !== undefined) {
    const list = Array.isArray(body.occasions) ? body.occasions : [];
    if (list.length > 14) return { error: 'Choose at most 14 occasions' };
    fields.occasions = [...new Set(list.map((occasion) => text(occasion, 40)).filter(Boolean))];
  }

  fields.has_gift_wrap = Boolean(body.giftWrap);
  fields.is_personalization_available = Boolean(body.personalisation);

  const variantResult = readVariants(body.variants, images, sellerId);
  if (variantResult.error) return { error: variantResult.error };
  fields.variants = variantResult.variants;

  // ---- product information ----
  const input = body.details && typeof body.details === 'object' ? body.details : {};
  const details = {};

  const brand = text(input.brand, 120);
  if (brand.length > 80) return { error: 'The brand name can have at most 80 characters' };
  if (brand) details.brand = brand;

  if (Array.isArray(input.inTheBox) && input.inTheBox.length > 0) {
    if (input.inTheBox.length > 12) return { error: 'List at most 12 items in the box' };
    details.inTheBox = input.inTheBox.map((item) => text(item, 60)).filter(Boolean);
  }

  details.productType = PRODUCT_TYPES.includes(input.productType) ? input.productType : 'ready';
  const dispatchDays = input.dispatchDays === undefined ? 2 : Number(input.dispatchDays);
  if (!Number.isInteger(dispatchDays) || dispatchDays < 0 || dispatchDays > 30) return { error: 'Choose a valid dispatch time' };
  details.dispatchDays = dispatchDays;

  if (body.personalisation) {
    const note = text(input.personalisationNote, 400);
    if (note.length < 10) return { error: 'Tell buyers what they can personalise (at least 10 characters)' };
    if (note.length > 300) return { error: 'The personalisation note can have at most 300 characters' };
    details.personalisationNote = note;
  }

  details.isFood = Boolean(input.isFood);
  if (details.isFood) {
    if (!['veg', 'non_veg'].includes(input.foodType)) return { error: 'Choose Veg or Non-veg for the food product' };
    details.foodType = input.foodType;

    const ingredients = text(input.ingredients, 1200);
    if (ingredients.length < 10) return { error: 'List the ingredients of the food product' };
    if (ingredients.length > 1000) return { error: 'The ingredients can have at most 1000 characters' };
    details.ingredients = ingredients;

    const allergens = text(input.allergens, 400);
    if (allergens.length > 300) return { error: 'The allergy information can have at most 300 characters' };
    if (allergens) details.allergens = allergens;

    const shelfValue = Number(input.shelfLife?.value);
    if (!Number.isInteger(shelfValue) || shelfValue < 1 || shelfValue > 999 || !['days', 'months'].includes(input.shelfLife?.unit)) {
      return { error: 'Enter the shelf life of the food product' };
    }
    details.shelfLife = { value: shelfValue, unit: input.shelfLife.unit };

    const fssai = text(input.fssai, 20);
    if (!/^\d{14}$/.test(fssai)) return { error: 'The FSSAI licence number has 14 digits' };
    details.fssai = fssai;

    const storage = text(input.storage, 300);
    if (storage.length > 200) return { error: 'The storage instructions can have at most 200 characters' };
    if (storage) details.storage = storage;
  }

  const material = text(input.material, 200);
  if (material.length > 120) return { error: '"Made of" can have at most 120 characters' };
  if (material) details.material = material;

  const origin = text(input.origin, 100);
  if (!origin) return { error: 'Enter the country where the product is made' };
  if (origin.length > 60) return { error: 'The country can have at most 60 characters' };
  details.origin = origin;

  if (!GST_RATES.includes(String(input.gstRate))) return { error: 'Choose the GST rate of the product' };
  details.gstRate = Number(input.gstRate);

  const hsn = text(input.hsn, 20);
  if (hsn && !/^\d{4,8}$/.test(hsn)) return { error: 'The HSN code has 4 to 8 digits' };
  if (hsn) details.hsn = hsn;

  if (!RETURN_POLICIES.includes(input.returnPolicy)) return { error: 'Choose a return policy' };
  details.returnPolicy = input.returnPolicy;

  return { fields, details };
};

// ---------------------------------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------------------------------
const PROFILE_TEXT_FIELDS = {
  storeName: ['store_name', 120],
  ownerName: ['owner_name', 120],
  category: ['category', 120],
  pincode: ['pincode', 12],
  streetAddress: ['street_address', 300],
  city: ['city', 80],
  pickupSlot: ['pickup_slot', 80],
  payoutMethod: ['payout_method', 20],
  upiId: ['upi_id', 80],
  gstin: ['gstin', 15],
  pan: ['pan', 10],
  logoUrl: ['logo_url', 1000],
  bannerUrl: ['banner_url', 1000],
  bio: ['bio', 600],
};

export const sellerPortalController = {
  // GET /api/seller/profile
  getProfile: async (req, res) => res.status(200).json({ success: true, seller: req.seller }),

  // PUT /api/seller/profile (email and mobile number are the login, so they are not changed here)
  updateProfile: async (req, res) => {
    try {
      const body = req.body || {};
      const updates = {};

      for (const [key, [column, max]] of Object.entries(PROFILE_TEXT_FIELDS)) {
        if (body[key] === undefined) continue;
        const value = String(body[key] ?? '').trim();
        if (value.length > max) return fail(res, 400, `${key} is too long`);
        updates[column] = value || null;
      }
      if (updates.store_name === null) return fail(res, 400, 'Store name cannot be empty');
      if (updates.gstin && !/^[0-9A-Z]{15}$/i.test(updates.gstin)) return fail(res, 400, 'GSTIN must be 15 letters and digits');
      if (updates.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(updates.pan)) return fail(res, 400, 'PAN must look like ABCDE1234F');
      if (updates.payout_method && !['upi', 'bank'].includes(updates.payout_method)) return fail(res, 400, 'Payout method must be upi or bank');
      if (updates.gstin) updates.gstin = updates.gstin.toUpperCase();
      if (updates.pan) updates.pan = updates.pan.toUpperCase();

      if (body.bankDetails && typeof body.bankDetails === 'object') {
        const bank = body.bankDetails;
        updates.bank_details = {
          accountHolder: String(bank.accountHolder ?? '').trim().slice(0, 120),
          accountNumber: String(bank.accountNumber ?? '').trim().slice(0, 30),
          ifsc: String(bank.ifsc ?? '').trim().toUpperCase().slice(0, 11),
          bankName: String(bank.bankName ?? '').trim().slice(0, 80),
          upiId: String(bank.upiId ?? '').trim().slice(0, 80),
        };
      }
      if (body.isVacationMode !== undefined) updates.is_vacation_mode = Boolean(body.isVacationMode);

      if (Object.keys(updates).length === 0) return fail(res, 400, 'Nothing to update');

      const seller = await sellerModel.update(req.seller.id, updates);

      // Vacation mode pauses the store: the seller's products leave the storefront until the store is resumed
      if (updates.is_vacation_mode !== undefined) {
        const { error } = await supabase.from('products').update({ is_active: !updates.is_vacation_mode }).eq('seller_id', req.seller.id);
        if (error) throw error;
      }

      return res.status(200).json({ success: true, seller });
    } catch (err) {
      return serverError(res, 'updateProfile', err);
    }
  },

  // POST /api/seller/change-password { currentPassword, newPassword }
  changePassword: async (req, res) => {
    try {
      // An admin looking at the panel must not change the seller's password from here
      if (req.sellerImpersonatedBy) return fail(res, 403, 'The password can only be changed by the seller.');

      const current = String(req.body?.currentPassword || '');
      const next = String(req.body?.newPassword || '');
      if (!current || !next) return fail(res, 400, 'Enter your current password and a new one');
      if (next.length < 6) return fail(res, 400, 'The new password must be at least 6 characters');
      if (next === current) return fail(res, 400, 'The new password must be different from the current one');

      const account = await sellerModel.findAuthByIdentifier(req.seller.email);
      if (!account || !(await bcrypt.compare(current, account.password_hash))) return fail(res, 401, 'The current password is wrong');

      await sellerModel.updatePassword(req.seller.id, await bcrypt.hash(next, 10));
      return res.status(200).json({ success: true, message: 'Password changed' });
    } catch (err) {
      return serverError(res, 'changePassword', err);
    }
  },

  // POST /api/seller/uploads (multipart, field "images"): product pictures go to Cloudinary, into the seller's own folder.
  // Answers with one result per file, in the same order, so the form can mark each picture done or failed.
  uploadImages: async (req, res) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) return fail(res, 400, 'Choose at least one picture to upload');

      const results = await Promise.all(
        files.map(async (file, index) => {
          const name = file.originalname || `picture-${index + 1}`;
          try {
            const uploaded = await uploadToCloudinary(file.buffer, {
              folder: `GIFT_APPLICATION/sellers/${req.seller.id}`,
              public_id: `product_${Date.now()}_${index}`,
            });
            return { name, url: uploaded.secure_url };
          } catch (err) {
            console.error('[SellerPortal] picture upload failed:', err?.message || err);
            return { name, error: 'This picture could not be uploaded. Please try again.' };
          }
        })
      );

      return res.status(200).json({ success: true, results });
    } catch (err) {
      return serverError(res, 'uploadImages', err);
    }
  },

  // GET /api/seller/products
  listProducts: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('seller_id', req.seller.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // How many of each product have been sold (orders that were not cancelled)
      const sold = new Map();
      if ((data || []).length > 0) {
        const mine = new Set(data.map((row) => row.id));
        for (const order of await loadRecentOrders()) {
          if (order.order_status === 'cancelled') continue;
          for (const item of Array.isArray(order.items) ? order.items : []) {
            const id = itemProductId(item);
            if (mine.has(id)) sold.set(id, (sold.get(id) || 0) + (Number(item.quantity) || 1));
          }
        }
      }

      return res.status(200).json({ success: true, products: (data || []).map((row) => shapeProduct(row, sold.get(row.id) || 0)) });
    } catch (err) {
      return serverError(res, 'listProducts', err);
    }
  },

  // POST /api/seller/products: goes live in the store at once
  createProduct: async (req, res) => {
    try {
      const form = readProductForm(req.body || {});
      if (form.error) return fail(res, 400, form.error);

      const listing = readListingExtras(req.body || {}, form.fields.images, req.seller.id);
      if (listing.error) return fail(res, 400, listing.error);

      // Live at once, unless the store is on vacation (then it stays hidden until the store is resumed)
      const created = await productModel.create({ ...form.fields, ...listing.fields, is_active: !req.seller.is_vacation_mode });
      const { error } = await supabase
        .from('products')
        .update({ seller_id: req.seller.id, ...form.extra, details: listing.details })
        .eq('id', created.id);
      if (error) {
        // Never leave a product behind that belongs to nobody
        await supabase.from('products').delete().eq('id', created.id);
        throw error;
      }

      const row = await findOwnProduct(req.seller.id, created.id);
      return res.status(201).json({ success: true, product: shapeProduct(row) });
    } catch (err) {
      return serverError(res, 'createProduct', err);
    }
  },

  // PUT /api/seller/products/:id
  updateProduct: async (req, res) => {
    try {
      if (!(await findOwnProduct(req.seller.id, req.params.id))) return fail(res, 404, 'Product not found');

      const form = readProductForm(req.body || {}, { partial: true });
      if (form.error) return fail(res, 400, form.error);

      if (Object.keys(form.fields).length > 0) await productModel.update(req.params.id, form.fields);
      if (Object.keys(form.extra).length > 0) {
        const { error } = await supabase.from('products').update(form.extra).eq('id', req.params.id).eq('seller_id', req.seller.id);
        if (error) throw error;
      }

      return res.status(200).json({ success: true, product: shapeProduct(await findOwnProduct(req.seller.id, req.params.id)) });
    } catch (err) {
      return serverError(res, 'updateProduct', err);
    }
  },

  // PATCH /api/seller/products/:id/stock
  updateStock: async (req, res) => {
    try {
      const stock = Number(req.body?.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) return fail(res, 400, 'Stock must be a whole number from 0 to 100000');
      if (!(await findOwnProduct(req.seller.id, req.params.id))) return fail(res, 404, 'Product not found');

      const { error } = await supabase.from('products').update({ stock }).eq('id', req.params.id).eq('seller_id', req.seller.id);
      if (error) throw error;
      return res.status(200).json({ success: true, product: shapeProduct(await findOwnProduct(req.seller.id, req.params.id)) });
    } catch (err) {
      return serverError(res, 'updateStock', err);
    }
  },

  // DELETE /api/seller/products/:id
  deleteProduct: async (req, res) => {
    try {
      if (!(await findOwnProduct(req.seller.id, req.params.id))) return fail(res, 404, 'Product not found');
      const { error } = await supabase.from('products').delete().eq('id', req.params.id).eq('seller_id', req.seller.id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      return serverError(res, 'deleteProduct', err);
    }
  },

  // GET /api/seller/orders
  listOrders: async (req, res) => {
    try {
      const { orders } = await loadSellerOrders(req.seller);
      return res.status(200).json({ success: true, commissionRate: commissionFor(req.seller), orders });
    } catch (err) {
      return serverError(res, 'listOrders', err);
    }
  },

  // PATCH /api/seller/orders/:id/status: the seller can mark a new order "ready for pickup" (this creates the pickup code
  // for the rider). Out for delivery, delivered and cancelled are set by Nyochavar's riders and admins, not by the seller.
  updateOrderStatus: async (req, res) => {
    try {
      if (req.body?.status !== 'ready_for_pickup') {
        return fail(res, 400, 'Sellers can only mark an order as ready for pickup. Delivery is updated by the rider.');
      }

      const { orders, productIds } = await loadSellerOrders(req.seller);
      const order = orders.find((candidate) => String(candidate.id) === String(req.params.id));
      if (!order) return fail(res, 404, 'Order not found');
      if (order.status !== 'new') return fail(res, 409, 'This order is already past the new stage');
      if (productIds.size === 0) return fail(res, 404, 'Order not found');

      const pickupOtp = String(randomInt(1000, 10000));
      const { error } = await supabase
        .from('seller_order_updates')
        .upsert(
          { order_id: String(order.id), seller_id: req.seller.id, status: 'ready_for_pickup', pickup_otp: pickupOtp, updated_at: new Date().toISOString() },
          { onConflict: 'order_id,seller_id' }
        );
      if (error) throw error;

      return res.status(200).json({ success: true, order: { ...order, status: 'ready_for_pickup', pickupOtp } });
    } catch (err) {
      return serverError(res, 'updateOrderStatus', err);
    }
  },

  // GET /api/seller/payouts: the payout ledger is not part of this public portfolio copy, so the list is always empty.
  listPayouts: async (req, res) =>
    res.status(200).json({ success: true, commissionRate: commissionFor(req.seller), totalEarned: 0, deliveredOrders: 0, payouts: [] }),
};
