import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useUI } from '../../context';
import type { SellerOrder, SellerPayout, SellerProduct, SellerProfile } from '../data/mockSellerData';
import {
  getSellerToken,
  onSellerAuthChange,
  sellerApi,
  setSellerToken,
  type ProductForm,
  type ProfileUpdate,
  type ServerSeller,
} from '../services/sellerApi';

interface SellerStats {
  todayRevenue: number;
  monthRevenue: number;
  pendingOrdersCount: number;
  totalProductsCount: number;
  outOfStockCount: number;
  sellerScore: number;
}

/** 'signed_out' = no seller token; 'loading' = fetching the seller's data; 'ready'; 'error' = the data could not be loaded */
export type SellerStatus = 'signed_out' | 'loading' | 'ready' | 'error';

interface SellerContextType {
  status: SellerStatus;
  loadError: string | null;
  profile: SellerProfile;
  products: SellerProduct[];
  orders: SellerOrder[];
  payouts: SellerPayout[];
  stats: SellerStats;
  commissionRate: number;
  totalEarned: number;
  reload: () => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<SellerProfile>) => Promise<void>;
  toggleVacationMode: () => Promise<void>;
  addProduct: (product: ProductForm) => Promise<SellerProduct>;
  updateProduct: (id: string, updates: Partial<ProductForm>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleStockStatus: (id: string) => Promise<void>;
  updateStockCount: (id: string, count: number) => Promise<void>;
  /** Only "ready for pickup" can be set by a seller: the rider and the admin move an order on from there */
  markReadyForPickup: (orderId: string) => Promise<void>;
}

// Shown only until the seller's real data arrives (or when signed out): nothing invented
const BLANK_PROFILE: SellerProfile = {
  id: '',
  storeName: '',
  slug: '',
  ownerName: '',
  phone: '',
  email: '',
  rating: 0,
  totalReviews: 0,
  kycStatus: 'pending',
  category: '',
  gstin: '',
  pan: '',
  bankDetails: { accountHolder: '', accountNumber: '', ifsc: '', bankName: '', upiId: '' },
  pickupAddress: { street: '', city: '', state: '', pincode: '', pickupSlot: '' },
  isVacationMode: false,
  memberSince: '',
  bio: '',
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toProfile = (seller: ServerSeller, products: SellerProduct[]): SellerProfile => {
  const bank = seller.bank_details || {};
  const reviews = products.reduce((sum, product) => sum + product.reviewsCount, 0);
  const rated = products.reduce((sum, product) => sum + product.rating * product.reviewsCount, 0);
  return {
    id: seller.id,
    storeName: seller.store_name,
    slug: slugify(seller.store_name),
    ownerName: seller.owner_name || seller.store_name,
    phone: seller.phone ? `+91 ${seller.phone}` : '',
    email: seller.email,
    rating: reviews > 0 ? Math.round((rated / reviews) * 10) / 10 : 0,
    totalReviews: reviews,
    kycStatus: seller.kyc_status === 'unverified' ? 'pending' : seller.kyc_status,
    category: seller.category || '',
    gstin: seller.gstin || '',
    pan: seller.pan || '',
    bankDetails: {
      accountHolder: bank.accountHolder || '',
      accountNumber: bank.accountNumber ? `•••• ${String(bank.accountNumber).slice(-4)}` : '',
      ifsc: bank.ifsc || '',
      bankName: bank.bankName || (seller.payout_method === 'upi' ? 'UPI' : 'Bank account'),
      upiId: seller.upi_id || bank.upiId || '',
    },
    pickupAddress: {
      street: seller.street_address || '',
      city: seller.city || '',
      state: '',
      pincode: seller.pincode || '',
      pickupSlot: seller.pickup_slot || '',
    },
    isVacationMode: Boolean(seller.is_vacation_mode),
    memberSince: seller.created_at
      ? new Date(seller.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : '',
    bannerUrl: seller.banner_url || undefined,
    logoUrl: seller.logo_url || undefined,
    bio: seller.bio || '',
  };
};

const SellerContext = createContext<SellerContextType | undefined>(undefined);

export const SellerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useUI();

  const [token, setToken] = useState<string | null>(() => getSellerToken());
  const [status, setStatus] = useState<SellerStatus>(() => (getSellerToken() ? 'loading' : 'signed_out'));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [server, setServer] = useState<ServerSeller | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [commissionRate, setCommissionRate] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);

  const clearData = useCallback(() => {
    setServer(null);
    setProducts([]);
    setOrders([]);
    setPayouts([]);
    setCommissionRate(0);
    setTotalEarned(0);
  }, []);

  // Fetches everything the seller sees: store profile, products, orders and earnings
  const load = useCallback(async () => {
    if (!getSellerToken()) {
      clearData();
      setLoadError(null);
      setStatus('signed_out');
      return;
    }
    setStatus('loading');
    setLoadError(null);
    try {
      const [seller, productList, orderResult, payoutResult] = await Promise.all([
        sellerApi.getProfile(),
        sellerApi.listProducts(),
        sellerApi.listOrders(),
        sellerApi.listPayouts(),
      ]);
      setServer(seller);
      setProducts(productList);
      setOrders(orderResult.orders);
      setCommissionRate(orderResult.commissionRate);
      setPayouts(payoutResult.payouts);
      setTotalEarned(payoutResult.totalEarned);
      setStatus('ready');
    } catch (err) {
      // A 401 already cleared the token (the listener below then shows the signed-out state)
      if (!getSellerToken()) return;
      setLoadError(err instanceof Error ? err.message : 'Could not load your store.');
      setStatus('error');
    }
  }, [clearData]);

  // Sign in / sign out anywhere in the portal: load (or forget) the seller's data
  useEffect(
    () =>
      onSellerAuthChange(() => {
        setToken(getSellerToken());
      }),
    []
  );

  useEffect(() => {
    void load();
  }, [token, load]);

  const logout = useCallback(() => {
    clearData();
    setSellerToken(null);
  }, [clearData]);

  // Runs a change on the server and then updates the screen; a failure is shown as a toast and thrown to the caller
  const act = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T> => {
      try {
        return await work();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        showToast({ tone: 'warning', title: 'Could not save', description: message });
        throw err;
      }
    },
    [showToast]
  );

  const replaceProduct = (updated: SellerProduct) => setProducts((previous) => previous.map((product) => (product.id === updated.id ? updated : product)));

  const updateProfile = async (updates: Partial<SellerProfile>) => {
    const body: ProfileUpdate = {};
    if (updates.storeName !== undefined) body.storeName = updates.storeName;
    if (updates.ownerName !== undefined) body.ownerName = updates.ownerName;
    if (updates.bio !== undefined) body.bio = updates.bio;
    if (updates.category !== undefined) body.category = updates.category;
    if (updates.gstin !== undefined) body.gstin = updates.gstin;
    if (updates.pan !== undefined) body.pan = updates.pan;
    if (updates.logoUrl !== undefined) body.logoUrl = updates.logoUrl;
    if (updates.bannerUrl !== undefined) body.bannerUrl = updates.bannerUrl;
    if (updates.pickupAddress) {
      body.streetAddress = updates.pickupAddress.street;
      body.city = updates.pickupAddress.city;
      body.pincode = updates.pickupAddress.pincode;
      body.pickupSlot = updates.pickupAddress.pickupSlot;
    }
    if (updates.isVacationMode !== undefined) body.isVacationMode = updates.isVacationMode;
    const saved = await act(() => sellerApi.updateProfile(body));
    setServer(saved);
  };

  const toggleVacationMode = async () => {
    const saved = await act(() => sellerApi.updateProfile({ isVacationMode: !server?.is_vacation_mode }));
    setServer(saved);
  };

  const addProduct = async (form: ProductForm) => {
    const created = await act(() => sellerApi.createProduct(form));
    setProducts((previous) => [created, ...previous]);
    return created;
  };

  const updateProduct = async (id: string, updates: Partial<ProductForm>) => {
    replaceProduct(await act(() => sellerApi.updateProduct(id, updates)));
  };

  const deleteProduct = async (id: string) => {
    await act(() => sellerApi.deleteProduct(id));
    setProducts((previous) => previous.filter((product) => product.id !== id));
  };

  const updateStockCount = async (id: string, count: number) => {
    replaceProduct(await act(() => sellerApi.updateStock(id, Math.max(0, Math.floor(count)))));
  };

  // "In stock" switch: off sets the stock to 0; on puts 1 back (the seller then sets the real count)
  const toggleStockStatus = async (id: string) => {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) return;
    await updateStockCount(id, product.inStock ? 0 : 1);
  };

  const markReadyForPickup = async (orderId: string) => {
    const updated = await act(() => sellerApi.markReadyForPickup(orderId));
    setOrders((previous) => previous.map((order) => (order.id === orderId ? updated : order)));
  };

  const stats: SellerStats = useMemo(() => {
    const live = orders.filter((order) => order.status !== 'cancelled');
    const today = new Date().toDateString();
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const sum = (list: SellerOrder[]) => list.reduce((total, order) => total + order.subtotal, 0);
    return {
      todayRevenue: sum(live.filter((order) => new Date(order.orderDate).toDateString() === today)),
      monthRevenue: sum(live.filter((order) => {
        const date = new Date(order.orderDate);
        return date.getMonth() === month && date.getFullYear() === year;
      })),
      pendingOrdersCount: orders.filter((order) => order.status === 'new' || order.status === 'ready_for_pickup').length,
      totalProductsCount: products.length,
      outOfStockCount: products.filter((product) => !product.inStock || product.stock === 0).length,
      sellerScore: server ? toProfile(server, products).rating : 0,
    };
  }, [orders, products, server]);

  const profile = useMemo(() => (server ? toProfile(server, products) : BLANK_PROFILE), [server, products]);

  return (
    <SellerContext.Provider
      value={{
        status,
        loadError,
        profile,
        products,
        orders,
        payouts,
        stats,
        commissionRate,
        totalEarned,
        reload: load,
        logout,
        updateProfile,
        toggleVacationMode,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleStockStatus,
        updateStockCount,
        markReadyForPickup,
      }}
    >
      {children}
    </SellerContext.Provider>
  );
};

export const useSeller = () => {
  const context = useContext(SellerContext);
  if (!context) {
    throw new Error('useSeller must be used within a SellerProvider');
  }
  return context;
};
