import { API_BASE_URL } from '../../services/apiConfig';

/**
 * Every call the seller portal makes to the server goes through here. It adds the seller's sign-in token, turns server
 * errors into readable messages, and signs the seller out (back to the login page) when the session is no longer valid.
 */

const TOKEN_KEY = 'petal_seller_token';
const AUTH_EVENT = 'seller-auth-changed';

export class SellerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SellerApiError';
    this.status = status;
  }
}

export const getSellerToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/** Saves (or, with null, removes) the sign-in token and tells the portal to load (or forget) the seller's data. */
export const setSellerToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the seller will have to sign in again on the next visit */
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const onSellerAuthChange = (listener: () => void): (() => void) => {
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
};

const call = async <T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
  const token = getSellerToken();
  if (!token) throw new SellerApiError('Please sign in to your seller account.', 401);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/seller${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new SellerApiError('Could not reach the server. Check your internet and try again.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // The session is over (expired, or the account was suspended or removed): back to the login page
    if (response.status === 401) setSellerToken(null);
    throw new SellerApiError(data?.error || 'Something went wrong. Please try again.', response.status);
  }
  return data as T;
};

/* ---- shapes the server sends (see Backend/controllers/sellerPortalController.js) ---- */

export interface ServerSeller {
  id: string;
  store_name: string;
  owner_name: string | null;
  email: string;
  phone: string;
  category: string | null;
  pincode: string | null;
  street_address: string | null;
  city: string | null;
  pickup_slot: string | null;
  payout_method: string | null;
  upi_id: string | null;
  bank_details: { accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string; upiId?: string } | null;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  is_vacation_mode: boolean;
  created_at: string;
  gstin?: string | null;
  pan?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
}

export interface ProductDetailsForm {
  brand?: string;
  inTheBox?: string[];
  productType?: 'ready' | 'made_to_order';
  dispatchDays?: number;
  personalisationNote?: string;
  isFood?: boolean;
  foodType?: 'veg' | 'non_veg';
  ingredients?: string;
  allergens?: string;
  shelfLife?: { value: number; unit: 'days' | 'months' };
  fssai?: string;
  storage?: string;
  material?: string;
  origin?: string;
  gstRate?: number;
  hsn?: string;
  returnPolicy?: 'damaged' | 'seven_days' | 'none';
}

export interface VariantForm {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  stock: number;
  sku?: string;
  /** The option's own pictures; the first is its cover */
  images?: string[];
}

export interface ProductForm {
  title: string;
  category: string;
  price: number;
  mrp?: number;
  stock: number;
  images: string[];
  description?: string;
  sku?: string;
  weightGrams?: number;
  allowCustomNote?: boolean;
  tagline?: string;
  occasions?: string[];
  giftWrap?: boolean;
  personalisation?: boolean;
  /** Options such as sizes or flavours; null when the product has none */
  variants?: { label: string; items: VariantForm[] } | null;
  details?: ProductDetailsForm;
}

export interface ProfileUpdate {
  storeName?: string;
  ownerName?: string;
  category?: string;
  pincode?: string;
  streetAddress?: string;
  city?: string;
  pickupSlot?: string;
  payoutMethod?: 'upi' | 'bank';
  upiId?: string;
  gstin?: string;
  pan?: string;
  logoUrl?: string;
  bannerUrl?: string;
  bio?: string;
  isVacationMode?: boolean;
  bankDetails?: { accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string; upiId?: string };
}

import type { SellerOrder, SellerPayout, SellerProduct } from '../data/mockSellerData';

export interface PayoutsResponse {
  commissionRate: number;
  totalEarned: number;
  deliveredOrders: number;
  payouts: SellerPayout[];
}

/** Uploads one product picture to the store's image storage; returns its link. */
const uploadPicture = async (file: File): Promise<string> => {
  const token = getSellerToken();
  if (!token) throw new SellerApiError('Please sign in to your seller account.', 401);

  const form = new FormData();
  form.append('images', file);

  let response: Response;
  try {
    // No Content-Type header here: the browser adds the multipart boundary itself
    response = await fetch(`${API_BASE_URL}/seller/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new SellerApiError('The upload did not finish. Check your internet and try again.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) setSellerToken(null);
    throw new SellerApiError(data?.error || 'The picture could not be uploaded.', response.status);
  }
  const result = data?.results?.[0];
  if (!result?.url) throw new SellerApiError(result?.error || 'The picture could not be uploaded.', 500);
  return result.url as string;
};

export const sellerApi = {
  uploadPicture,

  getProfile: () => call<{ seller: ServerSeller }>('/profile').then((r) => r.seller),
  updateProfile: (updates: ProfileUpdate) => call<{ seller: ServerSeller }>('/profile', { method: 'PUT', body: updates }).then((r) => r.seller),

  listProducts: () => call<{ products: SellerProduct[] }>('/products').then((r) => r.products),
  createProduct: (form: ProductForm) => call<{ product: SellerProduct }>('/products', { method: 'POST', body: form }).then((r) => r.product),
  updateProduct: (id: string, form: Partial<ProductForm>) =>
    call<{ product: SellerProduct }>(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body: form }).then((r) => r.product),
  updateStock: (id: string, stock: number) =>
    call<{ product: SellerProduct }>(`/products/${encodeURIComponent(id)}/stock`, { method: 'PATCH', body: { stock } }).then((r) => r.product),
  deleteProduct: (id: string) => call<{ success: boolean }>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listOrders: () => call<{ orders: SellerOrder[]; commissionRate: number }>('/orders'),
  markReadyForPickup: (orderId: string) =>
    call<{ order: SellerOrder }>(`/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: { status: 'ready_for_pickup' } }).then((r) => r.order),

  listPayouts: () => call<PayoutsResponse>('/payouts'),

  /** The store's own categories (public list), for the product form */
  listStoreCategories: async (): Promise<Array<{ id: string; name: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.categories ?? [];
      return list.filter((category: { id?: string; name?: string }) => category?.id && category?.name);
    } catch {
      return [];
    }
  },
};
