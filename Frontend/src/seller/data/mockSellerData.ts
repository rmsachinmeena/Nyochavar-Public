import { SELLER_LOGIN_THEMES } from '../pages/auth/sellerLoginThemes';

export interface SellerProfile {
  id: string;
  storeName: string;
  slug: string;
  ownerName: string;
  phone: string;
  email: string;
  rating: number;
  totalReviews: number;
  kycStatus: 'verified' | 'under_review' | 'pending' | 'rejected';
  category: string;
  gstin: string;
  pan: string;
  bankDetails: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId?: string;
  };
  pickupAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    pickupSlot: string;
  };
  isVacationMode: boolean;
  memberSince: string;
  bannerUrl?: string;
  logoUrl?: string;
  bio?: string;
}

export interface SellerProduct {
  id: string;
  title: string;
  sku: string;
  category: string;
  price: number;
  mrp: number;
  stock: number;
  inStock: boolean;
  images: string[];
  status: 'approved' | 'under_review' | 'rejected';
  rating: number;
  reviewsCount: number;
  salesCount: number;
  description?: string;
  allowCustomNote: boolean;
  weightGrams: number;
  createdAt: string;
}

export interface SellerOrderItem {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  customMessage?: string;
}

export interface SellerOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  buyerName: string;
  buyerPhone: string;
  shippingAddress: string;
  city: string;
  pincode: string;
  items: SellerOrderItem[];
  subtotal: number;
  commissionRate: number; // e.g. 0.10 (10%)
  commissionAmount: number;
  payoutAmount: number;
  paymentMethod: 'UPI' | 'Card' | 'COD';
  status: 'new' | 'ready_for_pickup' | 'in_transit' | 'delivered' | 'cancelled';
  pickupOtp?: string;
  trackingNumber?: string;
  courierPartner?: string;
  deliveredAt?: string | null;
}

export interface SellerPayout {
  id: string;
  date: string;
  amount: number;
  ordersCount: number;
  status: 'transferred' | 'processing' | 'scheduled';
  utrNumber?: string;
  bankAccount: string;
}

// The kinds of seller (the same list the seller login page uses)
export const sellerCategories: string[] = SELLER_LOGIN_THEMES.map((theme) => theme.label);
