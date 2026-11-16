import { adminFetch } from './apiClient';
import { api } from './api';
import { Product, CategoryItem, Occasion, DeliveryOption, TrustBadgeOption, ServiceOption, UiLabels, DEFAULT_TRUST_BADGES } from '../types/product';
import { API_BASE_URL } from './apiConfig';

const STORAGE_KEY_PRODUCTS = 'petal_pen_custom_products';
const STORAGE_KEY_CATEGORIES = 'petal_pen_custom_categories';
const STORAGE_KEY_DELETED_PRODUCTS = 'petal_pen_deleted_product_ids';
const STORAGE_KEY_DELETED_CATEGORIES = 'petal_pen_deleted_category_ids';
const PRODUCT_EVENT_NAME = 'petal_pen_products_updated';
const CATEGORY_EVENT_NAME = 'petal_pen_categories_updated';
const STORAGE_KEY_API_PRODUCTS = 'petal_pen_api_products_cache';
const API_TIMEOUT_MS = 8000;

// Default initial categories
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat_flowers',
    name: 'Flowers',
    slug: 'flowers',
    occasion_type: 'Festivals & Weddings',
    image_url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=800',
    is_active: true
  },
  {
    id: 'cat_hampers',
    name: 'Hampers',
    slug: 'hampers',
    occasion_type: 'Anniversary & Celebrations',
    image_url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=800',
    is_active: true
  },
  {
    id: 'cat_personalized',
    name: 'Personalized Gifts',
    slug: 'personalized-gifts',
    occasion_type: 'Milestones & Keepsakes',
    image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800',
    is_active: true
  }
];

function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.warn('Error reading deleted product IDs:', e);
  }
  return new Set();
}

function addDeletedProductId(id: string): void {
  const set = getDeletedProductIds();
  set.add(id);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_PRODUCTS, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Error saving deleted product IDs:', e);
  }
}

function getDeletedCategoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_CATEGORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.warn('Error reading deleted category IDs:', e);
  }
  return new Set();
}

function addDeletedCategoryId(id: string): void {
  const set = getDeletedCategoryIds();
  set.add(id);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_CATEGORIES, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Error saving deleted category IDs:', e);
  }
}

// Helper to get local stored items
function getLocalItems<T>(key: string, defaultItems: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Error reading ${key} from localStorage:`, e);
  }
  return defaultItems;
}

function saveLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn(`Error writing ${key} to localStorage:`, e);
  }
}

const NEW_ARRIVAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isRecentlyAdded(createdAt?: string): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(created) && Date.now() - created < NEW_ARRIVAL_WINDOW_MS;
}

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: '1', name: 'Super Fast Delivery', price: '₹49', enabled: false },
  { id: '2', name: 'Standard Delivery', price: 'Free', enabled: true },
  { id: '3', name: 'Same-Day Rush', price: '₹99', enabled: false }
];

/**
 * The assurance badges of a partner seller's product come from what the seller chose when listing it (returns,
 * dispatch), never from the store-wide defaults: no COD, no "7-day return" the seller never offered.
 */
function sellerTrustBadges(details: any): TrustBadgeOption[] {
  const badges: TrustBadgeOption[] = [];
  if (details.returnPolicy === 'seven_days') badges.push({ id: 'returns', name: '7-Day Return', icon: 'return', enabled: true });
  else if (details.returnPolicy === 'none') badges.push({ id: 'returns', name: 'No Returns', icon: 'no_return', enabled: true });
  else badges.push({ id: 'returns', name: 'Replacement if damaged', icon: 'shield', enabled: true });
  const days = Number(details.dispatchDays);
  if (Number.isFinite(days)) {
    badges.push({
      id: 'dispatch',
      name: details.productType === 'made_to_order' ? `Made to order · ${days} day${days === 1 ? '' : 's'}` : days === 0 ? 'Same-day dispatch' : `Dispatch in ${days} day${days === 1 ? '' : 's'}`,
      icon: 'truck',
      enabled: true,
    });
  }
  badges.push({ id: 'online', name: 'Secure online payment', icon: 'shield', enabled: true });
  if (details.brand) badges.push({ id: 'seller', name: `Sold by ${details.brand}`, icon: 'shield', enabled: true });
  return badges;
}

function sellerDispatchLabel(details: any): string {
  const days = Number(details.dispatchDays);
  if (!Number.isFinite(days)) return 'In stock';
  if (details.productType === 'made_to_order') return `Made to order, ready in ${days} day${days === 1 ? '' : 's'}`;
  return days === 0 ? 'In stock, dispatched the same day' : `In stock, dispatched within ${days} day${days === 1 ? '' : 's'}`;
}

export function parseDeliveryInfo(raw: any): {
  delivery_time_text?: string;
  delivery_options: DeliveryOption[];
  trust_badges: TrustBadgeOption[];
  services: ServiceOption[];
  ui_labels: UiLabels;
} {
  let delivery_time_text: string | undefined = undefined;
  let services: ServiceOption[] = [];
  let ui_labels: UiLabels = {};
  let delivery_options: DeliveryOption[] = [
    { id: '1', name: 'Super Fast Delivery', price: '₹49', enabled: false },
    { id: '2', name: 'Standard Delivery', price: 'Free', enabled: true },
    { id: '3', name: 'Same-Day Rush', price: '₹99', enabled: false }
  ];
  let trust_badges: TrustBadgeOption[] = DEFAULT_TRUST_BADGES;

  if (!raw) {
    return { delivery_time_text, delivery_options, trust_badges, services, ui_labels };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          delivery_options = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (typeof parsed.text === 'string') {
            delivery_time_text = parsed.text;
          }
          if (Array.isArray(parsed.options) && parsed.options.length > 0) {
            delivery_options = parsed.options;
          }
          if (Array.isArray(parsed.trust_badges) && parsed.trust_badges.length > 0) {
            trust_badges = parsed.trust_badges;
          }
          if (Array.isArray(parsed.services)) {
            services = parsed.services;
          }
          if (parsed.ui_labels && typeof parsed.ui_labels === 'object') {
            ui_labels = parsed.ui_labels;
          }
        }
      } catch {
        delivery_time_text = trimmed;
      }
    } else {
      delivery_time_text = trimmed;
    }
  } else if (typeof raw === 'object') {
    if (Array.isArray(raw)) {
      delivery_options = raw;
    } else {
      if (typeof raw.text === 'string') delivery_time_text = raw.text;
      if (Array.isArray(raw.options)) delivery_options = raw.options;
      if (Array.isArray(raw.trust_badges)) trust_badges = raw.trust_badges;
      if (Array.isArray(raw.services)) services = raw.services;
      if (raw.ui_labels && typeof raw.ui_labels === 'object') ui_labels = raw.ui_labels;
    }
  }

  return { delivery_time_text, delivery_options, trust_badges, services, ui_labels };
}

// Convert Backend DB product to Frontend Product format
function mapDbProductToFrontend(db: any): Product {
  const images = Array.isArray(db.images) && db.images.length > 0
    ? db.images
    : (db.image ? [db.image] : ['/banners/hero-banner-1.png']);

  const categoryName = db.categories?.name || db.category || 'Personalized Gifts';

  // Process DB badges
  const rawBadges: string[] = Array.isArray(db.badges)
    ? db.badges
    : (typeof db.badges === 'string' && db.badges.trim()
      ? db.badges.replace(/[{}]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)
      : []);

  const badgeSet = new Set<string>(rawBadges.map((b) => String(b).toLowerCase()));
  if (db.is_bestseller || db.is_best_seller) badgeSet.add('bestseller');
  if (db.is_trending) badgeSet.add('trending');
  if (db.is_top_rated_this_week) badgeSet.add('top_rated');
  if (db.is_eco_friendly) badgeSet.add('eco');
  if (db.is_budget_friendly) badgeSet.add('budget');

  const finalBadges = Array.from(badgeSet) as any[];

  const isBestseller = finalBadges.includes('bestseller') || Boolean(db.is_bestseller || db.is_best_seller);
  const isNew = finalBadges.includes('new') || Boolean(db.is_new);

  const deliveryInfo = parseDeliveryInfo(db.delivery_time_text);
  if (Array.isArray(db.delivery_options) && db.delivery_options.length > 0) {
    deliveryInfo.delivery_options = db.delivery_options;
  }
  const sellerDetails = db.seller_id && db.details && typeof db.details === 'object' ? db.details : null;
  const trustBadges = Array.isArray(db.trust_badges) && db.trust_badges.length > 0
    ? db.trust_badges
    : sellerDetails
      ? sellerTrustBadges(sellerDetails)
      : (deliveryInfo.trust_badges || DEFAULT_TRUST_BADGES);
  // A seller product says how soon the seller dispatches it, instead of the store's "same-day" line
  const uiLabels = sellerDetails && !deliveryInfo.ui_labels?.in_stock
    ? { ...deliveryInfo.ui_labels, in_stock: sellerDispatchLabel(sellerDetails) }
    : deliveryInfo.ui_labels;

  return {
    id: db.id,
    name: db.name,
    tagline: (db.tagline && !db.tagline.endsWith('...')) ? db.tagline : (db.description || 'Artisanal handcrafted gift'),
    category: categoryName,
    category_id: db.category_id || undefined,
    occasions: Array.isArray(db.occasions) && db.occasions.length > 0
      ? db.occasions
      : (typeof db.occasions === 'string' && db.occasions.trim()
        ? db.occasions.replace(/[{}]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)
        : (db.description?.toLowerCase().includes('anniversary') ? ['Anniversary'] : ['Birthday'])),
    price: Number(db.base_price !== undefined ? db.base_price : (db.price || 999)),
    mrp: Number(db.mrp) > 0 ? Number(db.mrp) : undefined,
    rating: db.rating !== null && db.rating !== undefined ? Number(db.rating) : 0,
    reviewCount: db.review_count !== null && db.review_count !== undefined ? Number(db.review_count) : 0,
    review_count: db.review_count !== null && db.review_count !== undefined ? Number(db.review_count) : 0,
    badges: finalBadges,
    isBestSeller: isBestseller,
    isNew: isNew,
    image: images[0],
    gallery: images,
    description: db.description || 'Curated with premium hand-selected components and artisanal packaging.',
    stock: db.stock !== undefined ? Number(db.stock) : 25,
    is_customizable: Boolean(db.is_customizable),
    is_trending: finalBadges.includes('trending') || Boolean(db.is_trending),
    has_gift_wrap: Boolean(db.has_gift_wrap),
    express_delivery_available: Boolean(db.express_delivery_available),
    review_snippet: db.review_snippet || '',
    is_eco_friendly: finalBadges.includes('eco') || Boolean(db.is_eco_friendly),
    is_top_rated_this_week: finalBadges.includes('top_rated') || Boolean(db.is_top_rated_this_week),
    is_personalization_available: Boolean(db.is_personalization_available),
    loyalty_points_value: Number(db.loyalty_points_value) || 0,
    is_budget_friendly: finalBadges.includes('budget') || Boolean(db.is_budget_friendly),
    delivery_charge: db.delivery_charge !== undefined && db.delivery_charge !== null ? Number(db.delivery_charge) : null,
    is_free_delivery: Boolean(db.is_free_delivery),
    delivery_time_text: deliveryInfo.delivery_time_text || undefined,
    delivery_options: deliveryInfo.delivery_options,
    trust_badges: trustBadges,
    services: deliveryInfo.services,
    ui_labels: uiLabels,
    seller_id: db.seller_id || null,
    coupon_code: db.coupon_code || undefined,
    min_order_amount: db.min_order_amount !== undefined && db.min_order_amount !== null ? Number(db.min_order_amount) : null,
    max_discount: db.max_discount !== undefined && db.max_discount !== null ? Number(db.max_discount) : null,
    is_active: db.is_active !== undefined ? Boolean(db.is_active) : true,
    variants: db.variants || [],
    details: db.details && typeof db.details === 'object' && Object.keys(db.details).length > 0 ? db.details : undefined,
    created_at: db.created_at || new Date().toISOString()
  };
}

// A slow or unreachable backend should never leave the storefront waiting indefinitely.
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await adminFetch(url, { ...init, signal: controller.signal, cacheTtlMs: (init.method ?? 'GET').toUpperCase() === 'GET' ? 10_000 : 0 });
  } finally {
    window.clearTimeout(timer);
  }
}

// Combine: API products -> Local custom products (excluding deleted IDs)
function mergeCatalog(apiProducts: Product[]): Product[] {
  const deleted = getDeletedProductIds();
  const localCustomProducts = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []).filter(p => !deleted.has(p.id));
  const productMap = new Map<string, Product>();

  // Local custom products (added via admin)
  localCustomProducts.forEach(p => productMap.set(p.id, p));
  // API products (from database)
  apiProducts.filter(p => !deleted.has(p.id)).forEach(p => productMap.set(p.id, p));

  return Array.from(productMap.values());
}

export const productService = {
  // ==========================================
  // CATEGORIES
  // ==========================================

  // Get all categories (API with Local fallback)
  getAllCategories: async (): Promise<CategoryItem[]> => {
    const deleted = getDeletedCategoryIds();
    let apiCategories: CategoryItem[] = [];
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/categories`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.categories)) {
          apiCategories = json.categories.filter((c: any) => !deleted.has(c.id));
        }
      }
    } catch (err) {
      console.warn('Backend categories API unavailable, using local cache:', err);
    }

    const localCategories = getLocalItems<CategoryItem>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES).filter(c => !deleted.has(c.id));

    const map = new Map<string, CategoryItem>();
    
    // 1. Defaults (if not deleted)
    DEFAULT_CATEGORIES.filter(c => !deleted.has(c.id)).forEach(c => map.set(c.name.toLowerCase(), c));
    // 2. Local custom categories
    localCategories.forEach(c => map.set(c.name.toLowerCase(), c));
    // 3. API categories override
    apiCategories.forEach(c => map.set(c.name.toLowerCase(), c));

    const combined = Array.from(map.values());
    saveLocalItems(STORAGE_KEY_CATEGORIES, combined);
    return combined;
  },

  // Create new category
  createCategory: async (categoryData: Partial<CategoryItem>): Promise<CategoryItem> => {
    const slug = (categoryData.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const newCategory: CategoryItem = {
      id: `cat_${Date.now()}`,
      name: categoryData.name?.trim() || 'New Category',
      slug,
      image_url: categoryData.image_url || null,
      occasion_type: categoryData.occasion_type || 'All Celebrations',
      is_active: categoryData.is_active !== undefined ? categoryData.is_active : true,
      created_at: new Date().toISOString()
    };

    // Try API
    try {
      const res = await adminFetch(`${API_BASE_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.category) {
          newCategory.id = json.category.id || newCategory.id;
        }
      }
    } catch (e) {
      console.warn('Saving category to local storage only:', e);
    }

    // Save locally
    const current = getLocalItems<CategoryItem>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
    const updated = [newCategory, ...current.filter(c => c.name.toLowerCase() !== newCategory.name.toLowerCase() && c.id !== newCategory.id)];
    saveLocalItems(STORAGE_KEY_CATEGORIES, updated);

    // Notify listeners
    window.dispatchEvent(new CustomEvent(CATEGORY_EVENT_NAME, { detail: updated }));
    return newCategory;
  },

  // Update category
  updateCategory: async (id: string, updates: Partial<CategoryItem>): Promise<CategoryItem> => {
    try {
      await adminFetch(`${API_BASE_URL}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.warn('API category update failed, updating local state:', e);
    }

    const current = getLocalItems<CategoryItem>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
    const updated = current.map(c => (c.id === id ? { ...c, ...updates } : c));
    saveLocalItems(STORAGE_KEY_CATEGORIES, updated);
    window.dispatchEvent(new CustomEvent(CATEGORY_EVENT_NAME, { detail: updated }));
    return updated.find(c => c.id === id) || ({ id, ...updates } as CategoryItem);
  },

  // Delete category
  deleteCategory: async (id: string): Promise<boolean> => {
    addDeletedCategoryId(id);

    try {
      await adminFetch(`${API_BASE_URL}/categories/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API delete failed, updating local state:', e);
    }

    const current = getLocalItems<CategoryItem>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
    const updated = current.filter(c => c.id !== id);
    saveLocalItems(STORAGE_KEY_CATEGORIES, updated);
    window.dispatchEvent(new CustomEvent(CATEGORY_EVENT_NAME, { detail: updated }));
    return true;
  },

  // Delete one or many categories in one request. Throws (and changes nothing locally) if the server refuses.
  deleteCategories: async (ids: string[]): Promise<number> => {
    const result = await api.bulkDelete('categories', ids);

    ids.forEach(addDeletedCategoryId);
    const removed = new Set(ids);
    const current = getLocalItems<CategoryItem>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
    const updated = current.filter(c => !removed.has(c.id));
    saveLocalItems(STORAGE_KEY_CATEGORIES, updated);
    window.dispatchEvent(new CustomEvent(CATEGORY_EVENT_NAME, { detail: updated }));
    return result.deleted;
  },

  // ==========================================
  // PRODUCTS
  // ==========================================

  // Get all products (blends dynamic admin products with base catalog)
  getAllProducts: async (): Promise<Product[]> => {
    const deleted = getDeletedProductIds();
    let apiProducts = getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, []).filter(p => !deleted.has(p.id));
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/products`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.products)) {
          apiProducts = json.products.map(mapDbProductToFrontend).filter((p: Product) => !deleted.has(p.id));
          saveLocalItems(STORAGE_KEY_API_PRODUCTS, apiProducts);
        }
      }
    } catch (err) {
      console.warn('Backend products API unavailable, using local cache:', err);
    }

    return mergeCatalog(apiProducts);
  },

  // Get only active products for storefront
  getActiveProducts: async (): Promise<Product[]> => {
    const all = await productService.getAllProducts();
    return all.filter(p => p.is_active !== false);
  },

  // Network-free snapshot so the storefront can paint products instantly
  getCachedProducts: (): Product[] => {
    const deleted = getDeletedProductIds();
    return mergeCatalog(getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, [])).filter(p => p.is_active !== false && !deleted.has(p.id));
  },

  // Find product by ID
  getProductById: async (id: string): Promise<Product | null> => {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/products/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.product) {
          return mapDbProductToFrontend(json.product);
        }
      }
    } catch (err) {
      // Fallback
    }

    const all = await productService.getAllProducts();
    return all.find(p => p.id === id) || null;
  },

  // Create new product
  // Create new product
  createProduct: async (data: {
    name: string;
    tagline?: string;
    description?: string;
    price: number;
    mrp?: number;
    category: string;
    category_id?: string;
    stock: number;
    image: string;
    gallery?: string[];
    occasions?: Occasion[];
    badges?: any[];
    isNew?: boolean;
    isBestSeller?: boolean;
    is_customizable?: boolean;
    is_trending?: boolean;
    has_gift_wrap?: boolean;
    express_delivery_available?: boolean;
    review_snippet?: string;
    is_eco_friendly?: boolean;
    is_top_rated_this_week?: boolean;
    is_personalization_available?: boolean;
    loyalty_points_value?: number;
    delivery_charge?: number | null;
    is_free_delivery?: boolean;
    delivery_time_text?: string;
    delivery_options?: DeliveryOption[];
    trust_badges?: TrustBadgeOption[];
    services?: ServiceOption[];
    ui_labels?: UiLabels;
    coupon_code?: string;
    min_order_amount?: number | null;
    max_discount?: number | null;
    is_active?: boolean;
    rating?: number;
    reviewCount?: number;
    review_count?: number;
    variants?: any[];
  }): Promise<Product> => {
    const id = `prod_${Date.now()}`;
    const gallery = data.gallery && data.gallery.length > 0 ? data.gallery : [data.image];

    const badges = data.badges || [];
    const isBestSeller = badges.includes('bestseller') || Boolean(data.isBestSeller);
    const isNew = badges.includes('new') || Boolean(data.isNew);

    const deliveryOptionsToSave = data.delivery_options || DEFAULT_DELIVERY_OPTIONS;
    const trustBadgesToSave = data.trust_badges || DEFAULT_TRUST_BADGES;
    const serializedDelivery = JSON.stringify({
      text: data.delivery_time_text ? data.delivery_time_text.trim() : '',
      options: deliveryOptionsToSave,
      trust_badges: trustBadgesToSave,
      services: data.services || [],
      ui_labels: data.ui_labels || {}
    });

    const payload = {
      name: data.name.trim(),
      tagline: data.tagline ? data.tagline.trim() : '',
      description: data.description || '',
      base_price: Number(data.price),
      mrp: data.mrp ? Number(data.mrp) : null,
      category: data.category,
      category_id: data.category_id,
      images: gallery,
      occasions: (data.occasions && data.occasions.length > 0 ? data.occasions : ['Birthday']) as Occasion[],
      badges,
      stock: Number(data.stock),
      is_customizable: Boolean(data.is_customizable),
      is_trending: badges.includes('trending') || Boolean(data.is_trending),
      has_gift_wrap: Boolean(data.has_gift_wrap),
      express_delivery_available: Boolean(data.express_delivery_available),
      review_snippet: data.review_snippet ? data.review_snippet.trim() : null,
      is_eco_friendly: badges.includes('eco') || Boolean(data.is_eco_friendly),
      is_top_rated_this_week: badges.includes('top_rated') || Boolean(data.is_top_rated_this_week),
      is_personalization_available: Boolean(data.is_personalization_available),
      is_bestseller: isBestSeller,
      is_new: isNew,
      rating: Number(data.rating) || 0,
      review_count: Number(data.review_count !== undefined ? data.review_count : data.reviewCount) || 0,
      loyalty_points_value: Number(data.loyalty_points_value) || 0,
      delivery_charge: data.delivery_charge !== undefined ? data.delivery_charge : null,
      is_free_delivery: Boolean(data.is_free_delivery),
      delivery_time_text: serializedDelivery,
      coupon_code: data.coupon_code ? data.coupon_code.trim().toUpperCase() : null,
      min_order_amount: data.min_order_amount !== undefined ? data.min_order_amount : null,
      max_discount: data.max_discount !== undefined ? data.max_discount : null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      variants: data.variants || []
    };

    const res = await adminFetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || `Failed to create product (${res.status})`);
    }

    const createdDbProduct = json.product;
    const newProduct: Product = createdDbProduct
      ? mapDbProductToFrontend(createdDbProduct)
      : {
          id,
          name: payload.name,
          tagline: payload.tagline,
          category: payload.category,
          category_id: payload.category_id,
          occasions: payload.occasions as Occasion[],
          price: payload.base_price,
          mrp: payload.mrp || undefined,
          rating: payload.rating,
          reviewCount: payload.review_count,
          review_count: payload.review_count,
          badges: payload.badges,
          isNew,
          isBestSeller,
          image: data.image,
          gallery,
          description: payload.description,
          stock: payload.stock,
          is_customizable: payload.is_customizable,
          is_trending: payload.is_trending,
          has_gift_wrap: payload.has_gift_wrap,
          express_delivery_available: payload.express_delivery_available,
          review_snippet: payload.review_snippet || '',
          is_eco_friendly: payload.is_eco_friendly,
          is_top_rated_this_week: payload.is_top_rated_this_week,
          is_personalization_available: payload.is_personalization_available,
          loyalty_points_value: payload.loyalty_points_value,
          delivery_charge: payload.delivery_charge,
          is_free_delivery: payload.is_free_delivery,
          delivery_time_text: data.delivery_time_text ? data.delivery_time_text.trim() : undefined,
          delivery_options: deliveryOptionsToSave,
          trust_badges: trustBadgesToSave,
          services: data.services || [],
          ui_labels: data.ui_labels || {},
          coupon_code: payload.coupon_code || undefined,
          min_order_amount: payload.min_order_amount,
          max_discount: payload.max_discount,
          is_active: payload.is_active,
          variants: payload.variants,
          created_at: new Date().toISOString()
        };

    // Save locally ONLY on successful save
    const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
    const updated = [newProduct, ...current.filter((p) => p.id !== newProduct.id)];
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);

    const apiCache = getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, []);
    saveLocalItems(STORAGE_KEY_API_PRODUCTS, [newProduct, ...apiCache.filter((p) => p.id !== newProduct.id)]);

    // Notify all listening components
    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return newProduct;
  },

  // Update existing product in Database
  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const payload: any = { ...updates };
    if (updates.price !== undefined) payload.base_price = updates.price;
    if (updates.gallery !== undefined) payload.images = updates.gallery;
    if (updates.image !== undefined && !payload.images) payload.images = [updates.image];
    if (updates.occasions !== undefined) payload.occasions = updates.occasions;
    if (updates.tagline !== undefined) payload.tagline = updates.tagline;
    if (updates.reviewCount !== undefined) payload.review_count = updates.reviewCount;
    if (updates.review_count !== undefined) payload.review_count = updates.review_count;
    if (updates.badges !== undefined) payload.badges = updates.badges;
    if (updates.variants !== undefined) payload.variants = updates.variants;
    if (updates.trust_badges !== undefined) payload.trust_badges = updates.trust_badges;

    if (updates.delivery_options !== undefined || updates.delivery_time_text !== undefined || updates.trust_badges !== undefined || updates.services !== undefined || updates.ui_labels !== undefined) {
      const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
      const existing = current.find((p) => p.id === id);
      const text = updates.delivery_time_text !== undefined ? updates.delivery_time_text : (existing?.delivery_time_text || '');
      const options = updates.delivery_options !== undefined ? updates.delivery_options : (existing?.delivery_options || DEFAULT_DELIVERY_OPTIONS);
      const trustBadges = updates.trust_badges !== undefined ? updates.trust_badges : (existing?.trust_badges || DEFAULT_TRUST_BADGES);
      const services = updates.services !== undefined ? updates.services : (existing?.services || []);
      const uiLabels = updates.ui_labels !== undefined ? updates.ui_labels : (existing?.ui_labels || {});
      payload.delivery_time_text = JSON.stringify({
        text: (text || '').trim(),
        options: options,
        trust_badges: trustBadges,
        services: services,
        ui_labels: uiLabels
      });
    }

    const res = await adminFetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || `Failed to update product (${res.status})`);
    }

    const updatedDbProduct = json.product;
    const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
    const existing = current.find((p) => p.id === id);
    const updatedProduct = updatedDbProduct
      ? mapDbProductToFrontend(updatedDbProduct)
      : existing
      ? { ...existing, ...updates }
      : ({ id, ...updates } as Product);

    // Save locally ONLY on successful update
    const updated = current.map((p) => (p.id === id ? updatedProduct : p));
    if (!existing && !updated.some((p) => p.id === id)) {
      updated.unshift(updatedProduct);
    }
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);

    // Sync API cache
    const apiProducts = getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, []);
    const updatedApi = apiProducts.map((p) => (p.id === id ? updatedProduct : p));
    saveLocalItems(STORAGE_KEY_API_PRODUCTS, updatedApi);

    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return updatedProduct;
  },

  // Update Stock in Database
  updateProductStock: async (id: string, newStock: number): Promise<number> => {
    const validStock = Math.max(0, newStock);
    try {
      await adminFetch(`${API_BASE_URL}/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: validStock })
      });
    } catch (e) {
      console.warn('API stock update warning:', e);
    }

    const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
    const updated = current.map(p => (p.id === id ? { ...p, stock: validStock } : p));
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);

    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return validStock;
  },

  // Toggle Active Status in Database
  toggleProductStatus: async (id: string): Promise<boolean> => {
    let newStatus = true;
    try {
      const res = await adminFetch(`${API_BASE_URL}/products/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) newStatus = json.is_active;
      }
    } catch (e) {
      console.warn('API toggle status warning:', e);
    }

    const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
    const product = current.find(p => p.id === id);
    if (product) {
      newStatus = !product.is_active;
    }
    const updated = current.map(p => (p.id === id ? { ...p, is_active: newStatus } : p));
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);

    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return newStatus;
  },

  // Delete product in Database
  deleteProduct: async (id: string): Promise<boolean> => {
    addDeletedProductId(id);

    try {
      await adminFetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API delete fallback to local store:', e);
    }

    const current = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []);
    const updated = current.filter(p => p.id !== id);
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);

    // Also remove from cache
    const cached = getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, []);
    saveLocalItems(STORAGE_KEY_API_PRODUCTS, cached.filter(p => p.id !== id));

    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return true;
  },

  // Delete one or many products in one request. Throws (and changes nothing locally) if the server refuses.
  deleteProducts: async (ids: string[]): Promise<number> => {
    const result = await api.bulkDelete('products', ids);

    ids.forEach(addDeletedProductId);
    const removed = new Set(ids);
    const updated = getLocalItems<Product>(STORAGE_KEY_PRODUCTS, []).filter(p => !removed.has(p.id));
    saveLocalItems(STORAGE_KEY_PRODUCTS, updated);
    const cached = getLocalItems<Product>(STORAGE_KEY_API_PRODUCTS, []);
    saveLocalItems(STORAGE_KEY_API_PRODUCTS, cached.filter(p => !removed.has(p.id)));

    window.dispatchEvent(new CustomEvent(PRODUCT_EVENT_NAME, { detail: updated }));
    return result.deleted;
  },

  // Event Subscriptions
  subscribeToProducts: (callback: (products: Product[]) => void): (() => void) => {
    const handler = (e: any) => {
      if (e.detail) callback(e.detail);
    };
    window.addEventListener(PRODUCT_EVENT_NAME, handler);
    return () => window.removeEventListener(PRODUCT_EVENT_NAME, handler);
  },

  subscribeToCategories: (callback: (categories: CategoryItem[]) => void): (() => void) => {
    const handler = (e: any) => {
      if (e.detail) callback(e.detail);
    };
    window.addEventListener(CATEGORY_EVENT_NAME, handler);
    return () => window.removeEventListener(CATEGORY_EVENT_NAME, handler);
  }
};

export default productService;
