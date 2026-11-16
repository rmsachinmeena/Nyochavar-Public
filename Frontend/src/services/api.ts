import { ApiError, Role, endServerSession, request, saveSessionTokens } from './apiClient';

const ADMIN_AUTH_HINT_KEY = 'petal_pen_admin_auth';
const ADMIN_PROFILE_KEY = 'petal_pen_admin_profile';
const BUYER_PROFILE_KEY = 'petal_pen_current_user';
const RIDER_PROFILE_KEY = 'petal_pen_rider_profile';

const safeRemove = (...keys: string[]) => {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
};

/** Endpoints shared by shoppers and the admin console: use whichever session belongs to the current area. */
const memberRole = (): Role => (window.location.pathname.startsWith('/admin') ? 'superadmin' : 'buyer');

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** API prefixes that accept `POST /<prefix>/bulk-delete { ids }` (superadmin only). */
export type BulkDeleteResource = 'products' | 'categories' | 'banners' | 'orders' | 'user' | 'events' | 'delivery-partners';

export const api = {
  // ---------------------------------------------------------------------------
  // Auth: shopper
  // ---------------------------------------------------------------------------
  // Signup (Step 1: Initiates OTP verification with Email)
  signup: (userData: { email: string; name?: string; password?: string }) =>
    request('/auth/signup', { method: 'POST', body: userData, fallbackMessage: 'Signup failed' }),

  // Complete Signup (Step 3: Set Full Name & Password). Uses the token issued by verifyOtp.
  completeSignup: async (signupData: { userId?: string; email?: string; name: string; password?: string }) => {
    const data = await request('/auth/complete-signup', {
      method: 'POST',
      role: 'buyer',
      body: { name: signupData.name, password: signupData.password },
      fallbackMessage: 'Failed to complete account creation',
    });
    if (data.token) saveSessionTokens('buyer', data);
    return data;
  },

  // Verify OTP
  verifyOtp: async (verificationData: { email: string; otp: string }) => {
    const data = await request('/auth/verify', { method: 'POST', body: verificationData, fallbackMessage: 'Verification failed' });
    if (data.token) saveSessionTokens('buyer', data);
    return data;
  },

  // Resend OTP
  resendOtp: (email: string) => request('/auth/resend', { method: 'POST', body: { email }, fallbackMessage: 'Failed to resend OTP' }),

  // Sign-in step 1: is there an account for this email / mobile number, and what does it need next?
  // 'not_found' | 'password' (ask for the password) | 'verify' (a code was just sent; set a new password after it)
  identifyAccount: (identifier: string) =>
    request<{
      status: 'not_found' | 'password' | 'verify';
      channel?: 'email' | 'whatsapp';
      otpLength?: number;
      sentTo?: string;
      needsPassword?: boolean;
    }>('/auth/identify', { method: 'POST', body: { identifier }, fallbackMessage: 'Could not check this account' }),

  // Sign-in step 2 for an account that needed a code: a right code verifies it and opens a session
  verifyAccountOtp: async (data: { identifier: string; otp: string }) => {
    const result = await request('/auth/identify/verify', { method: 'POST', body: data, fallbackMessage: 'Verification failed' });
    if (result.token) saveSessionTokens('buyer', result);
    return result;
  },

  // Login (the email field also accepts a mobile number)
  login: async (credentials: { email: string; password?: string }) => {
    try {
      const data = await request('/auth/login', { method: 'POST', body: credentials, fallbackMessage: 'Login failed' });
      if (data.token) saveSessionTokens('buyer', data);
      return data;
    } catch (error) {
      // AuthPage switches to the OTP step when the account still needs verifying
      if (error instanceof ApiError) Object.assign(error, { requiresOtp: error.data.requiresOtp, email: error.data.email });
      throw error;
    }
  },

  // Google OAuth Login
  googleLogin: async (credential: string) => {
    const data = await request('/auth/google', { method: 'POST', body: { credential }, fallbackMessage: 'Google login failed' });
    if (data.token) saveSessionTokens('buyer', data);
    return data;
  },

  // Status-only lookup: 204 = an account exists, 404 = it does not. Run it before asking the server to send a reset email.
  checkEmailExists: async (email: string): Promise<boolean> => {
    try {
      await request('/auth/check-email', { method: 'POST', body: { email }, fallbackMessage: 'Could not check this email' });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return false;
      throw error;
    }
  },

  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: { email }, fallbackMessage: 'Failed to send reset email' }),

  resetPassword: (resetData: { email: string; otp: string; newPassword?: string }) =>
    request('/auth/reset-password', { method: 'POST', body: resetData, fallbackMessage: 'Failed to reset password' }),

  // Logout: revokes the session on the server (fire-and-forget) and forgets the local profile and checkout draft
  logout: () => {
    void endServerSession('buyer');
    safeRemove(BUYER_PROFILE_KEY, 'petal_pen_selected_address', 'petal_pen_checkout_draft');
  },

  // HTTP twin of the 5-second socket check
  checkSession: (role: Role) => request('/auth/check', { role, fallbackMessage: 'Session check failed' }),

  // ---------------------------------------------------------------------------
  // Auth: superadmin
  // ---------------------------------------------------------------------------
  adminLogin: async (credentials: { email: string; password?: string }) => {
    const data = await request('/auth/admin-login', { method: 'POST', body: credentials, fallbackMessage: 'Admin login failed' });
    if (data.token) {
      saveSessionTokens('superadmin', data);
      try {
        // "auth" is only a hint that a refresh may be possible: the server still checks every request
        localStorage.setItem(ADMIN_AUTH_HINT_KEY, 'true');
        if (data.admin) localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(data.admin));
      } catch {
        /* ignore */
      }
    }
    return data;
  },

  adminLogout: async () => {
    await endServerSession('superadmin');
    safeRemove(ADMIN_AUTH_HINT_KEY, ADMIN_PROFILE_KEY);
  },

  getAuditLogs: (params?: { action?: string; table_affected?: string; limit?: number }) =>
    request('/audit-logs', { role: 'superadmin', query: params, fallbackMessage: 'Failed to fetch audit logs' }),

  /**
   * Superadmin: permanently delete one or many records in one request (each one is audit-logged).
   * Products, categories and banners go through their services, which also update the local catalogue cache.
   */
  bulkDelete: (resource: BulkDeleteResource, ids: string[]) =>
    request<{ success: boolean; deleted: number; ids: string[]; message?: string }>(`/${resource}/bulk-delete`, {
      method: 'POST',
      role: 'superadmin',
      body: { ids },
      fallbackMessage: 'Delete failed. Please try again.',
    }),

  // ---------------------------------------------------------------------------
  // Images (admin)
  // ---------------------------------------------------------------------------
  // Upload single image to Cloudinary (folder: GIFT_APPLICATION)
  uploadImage: async (file: File, customName?: string): Promise<{ url: string; secure_url: string; public_id: string }> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB, exceeding Cloudinary's 10MB maximum limit. Please select an image under 10MB.`
      );
    }

    const formData = new FormData();
    formData.append('image', file);
    if (customName) formData.append('name', customName);

    const data = await request('/upload/single', { method: 'POST', role: 'superadmin', body: formData, timeoutMs: 60_000, fallbackMessage: 'Image upload failed' });
    if (!data.success) throw new Error(data.message || data.error || 'Image upload failed');
    return data;
  },

  // Upload multiple images to Cloudinary (folder: GIFT_APPLICATION)
  uploadMultipleImages: async (files: File[]): Promise<string[]> => {
    for (const f of files) {
      if (f.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `File "${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)}MB, exceeding Cloudinary's 10MB limit. Please choose images under 10MB.`
        );
      }
    }

    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));

    const data = await request('/upload/multiple', { method: 'POST', role: 'superadmin', body: formData, timeoutMs: 90_000, fallbackMessage: 'Images upload failed' });
    if (!data.success) throw new Error(data.message || data.error || 'Images upload failed');
    return data.urls || [];
  },

  // ---------------------------------------------------------------------------
  // Users (shopper's own data; admins may read any)
  // ---------------------------------------------------------------------------
  // Get all users for admin search and customer directory
  getAllUsers: () => request('/user', { role: 'superadmin', fallbackMessage: 'Failed to fetch users' }),

  getProfile: async (id: string) => {
    const data = await request(`/user/profile/${encodeURIComponent(id)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch profile' });
    return data.user;
  },

  updateProfile: async (
    id: string,
    profileData: { name?: string; phone?: string; email?: string; address_line?: string; city?: string; pincode?: string }
  ) => {
    const data = await request(`/user/profile/${encodeURIComponent(id)}`, {
      method: 'PUT',
      role: memberRole(),
      body: profileData,
      fallbackMessage: 'Failed to update profile',
    });
    return data.user;
  },

  changePassword: (id: string, passwords: { currentPassword: string; newPassword: string }) =>
    request(`/user/change-password/${encodeURIComponent(id)}`, {
      method: 'PUT',
      role: 'buyer',
      body: passwords,
      fallbackMessage: 'Failed to change password',
    }),

  setPassword: (id: string, newPassword: string) =>
    request(`/user/set-password/${encodeURIComponent(id)}`, {
      method: 'PUT',
      role: 'buyer',
      body: { newPassword },
      fallbackMessage: 'Failed to set password',
    }),

  getUserOrders: async (userId: string) => {
    const data = await request(`/user/orders/${encodeURIComponent(userId)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch orders' });
    return data.orders || [];
  },

  getUserWishlist: async (userId: string) => {
    const data = await request(`/user/wishlist/${encodeURIComponent(userId)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch wishlist' });
    return data.wishlist || [];
  },

  addToWishlist: (userId: string, productIds: string[]) =>
    request(`/user/wishlist/${encodeURIComponent(userId)}`, {
      method: 'POST',
      role: memberRole(),
      body: { productIds },
      fallbackMessage: 'Failed to save to wishlist',
    }),

  removeFromWishlist: (userId: string, productId: string) =>
    request(`/user/wishlist/${encodeURIComponent(userId)}/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      role: memberRole(),
      fallbackMessage: 'Failed to remove from wishlist',
    }),

  getUserNotifications: async (userId: string) => {
    const data = await request(`/user/notifications/${encodeURIComponent(userId)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch notifications' });
    return data.notifications || [];
  },

  cancelOrder: (id: string) =>
    request(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'PUT',
      role: 'buyer',
      fallbackMessage: 'Could not cancel the order',
    }),

  hideNotification: (id: string) =>
    request(`/user/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      role: memberRole(),
      fallbackMessage: 'Failed to remove notification',
    }),

  markNotificationRead: (id: string) =>
    request(`/user/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
      role: memberRole(),
      fallbackMessage: 'Failed to mark notification read',
    }),

  // User Cart from DB
  getUserCart: async (userId: string) => {
    const data = await request(`/user/cart/${encodeURIComponent(userId)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch cart' });
    // The backend answers with `cart`; older code read `items`, which left the summary empty
    return data.items || data.cart || [];
  },

  // Multiple Addresses Management
  getUserAddresses: async (userId: string) => {
    const data = await request(`/user/addresses/${encodeURIComponent(userId)}`, { role: memberRole(), fallbackMessage: 'Failed to fetch addresses' });
    return data.addresses || [];
  },

  addUserAddress: (
    userId: string,
    addressData: {
      label?: string;
      name?: string;
      phone?: string;
      address_line: string;
      city: string;
      pincode: string;
      is_default?: boolean;
    }
  ) =>
    request(`/user/addresses/${encodeURIComponent(userId)}`, {
      method: 'POST',
      role: memberRole(),
      body: addressData,
      fallbackMessage: 'Failed to add address',
    }),

  updateUserAddress: (
    userId: string,
    addressId: string,
    addressData: {
      label?: string;
      name?: string;
      phone?: string;
      address_line?: string;
      city?: string;
      pincode?: string;
      is_default?: boolean;
    }
  ) =>
    request(`/user/addresses/${encodeURIComponent(userId)}/${encodeURIComponent(addressId)}`, {
      method: 'PUT',
      role: memberRole(),
      body: addressData,
      fallbackMessage: 'Failed to update address',
    }),

  deleteUserAddress: (userId: string, addressId: string) =>
    request(`/user/addresses/${encodeURIComponent(userId)}/${encodeURIComponent(addressId)}`, {
      method: 'DELETE',
      role: memberRole(),
      fallbackMessage: 'Failed to delete address',
    }),

  setDefaultUserAddress: (userId: string, addressId: string) =>
    request(`/user/addresses/${encodeURIComponent(userId)}/${encodeURIComponent(addressId)}/default`, {
      method: 'PUT',
      role: memberRole(),
      fallbackMessage: 'Failed to set default address',
    }),

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------
  createOrder: async (orderData: {
    buyer_id?: string | null;
    user_id?: string | null;
    items: any[];
    total_amount?: number;
    total?: number;
    subtotal?: number;
    delivery_fee?: number;
    delivery_address?: string;
    details?: any;
    gift_message?: string | null;
    delivery_instructions?: string | null;
    delivery_date?: string;
    delivery_slot?: string;
    deliveryLabel?: string;
    is_same_day?: boolean;
    payment_method?: string;
    payment?: string;
    payment_status?: string;
    order_status?: string;
    coupon_code?: string;
    discount_amount?: number;
    session_id?: string;
  }) => {
    const data = await request('/orders', { method: 'POST', role: 'buyer', body: orderData, fallbackMessage: 'Failed to place order' });
    return data.order;
  },

  getAllOrders: async (params?: { status?: string; payment_status?: string }) => {
    const data = await request('/orders', { role: 'superadmin', query: params, fallbackMessage: 'Failed to fetch orders' });
    return data.orders || [];
  },

  updateOrderStatus: async (id: string, status: string) => {
    const data = await request(`/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      role: 'superadmin',
      body: { status },
      fallbackMessage: 'Failed to update order status',
    });
    return data.order;
  },

  /**
   * Admin: record a refund that was issued by hand in the Razorpay dashboard (the refund webhook normally does this by
   * itself). `refundId` (rfnd_...) is optional.
   */
  markOrderRefunded: async (id: string, refundId?: string) => {
    const data = await request(`/orders/${encodeURIComponent(id)}/mark-refunded`, {
      method: 'POST',
      role: 'superadmin',
      body: refundId ? { refund_id: refundId } : {},
      fallbackMessage: 'Could not mark the order refunded',
    });
    return data.order;
  },

  // ---------------------------------------------------------------------------
  // Delivery partners (admin)
  // ---------------------------------------------------------------------------
  getAllDeliveryPartners: async () => {
    const data = await request('/delivery-partners', { role: 'superadmin', fallbackMessage: 'Failed to fetch delivery partners' });
    return data.partners || [];
  },

  createDeliveryPartner: async (partnerData: {
    name: string;
    phone: string;
    city?: string;
    assigned_area?: string;
    is_active?: boolean;
    duty_status?: 'on_duty' | 'on_leave';
  }) => {
    const data = await request('/delivery-partners', {
      method: 'POST',
      role: 'superadmin',
      body: partnerData,
      fallbackMessage: 'Failed to create delivery partner',
    });
    return data.partner;
  },

  updateDeliveryPartner: async (
    id: string,
    updates: Partial<{ name: string; phone: string; city: string; assigned_area: string; is_active: boolean; duty_status: 'on_duty' | 'on_leave' }>
  ) => {
    const data = await request(`/delivery-partners/${encodeURIComponent(id)}`, {
      method: 'PUT',
      role: 'superadmin',
      body: updates,
      fallbackMessage: 'Failed to update delivery partner',
    });
    return data.partner;
  },

  deleteDeliveryPartner: (id: string) =>
    request(`/delivery-partners/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      role: 'superadmin',
      fallbackMessage: 'Failed to delete delivery partner',
    }),

  /** Issues a new rider login PIN. The server returns it once; only its hash is stored. */
  resetRiderPin: async (id: string, pin?: string): Promise<string> => {
    const data = await request(`/delivery-partners/${encodeURIComponent(id)}/reset-pin`, {
      method: 'POST',
      role: 'superadmin',
      body: pin ? { pin } : {},
      fallbackMessage: 'Failed to reset PIN',
    });
    return data.pin as string;
  },

  assignOrderRider: (orderId: string, partnerData: { partnerId: string; partnerName?: string; partnerPhone?: string }) =>
    request(`/orders/${encodeURIComponent(orderId)}/assign-rider`, {
      method: 'PUT',
      role: 'superadmin',
      body: partnerData,
      fallbackMessage: 'Failed to assign rider',
    }),

  // ---------------------------------------------------------------------------
  // Rider mobile portal
  // ---------------------------------------------------------------------------
  riderLogin: async (credentials: { phone: string; pin?: string; password?: string }) => {
    const data = await request('/rider/login', { method: 'POST', body: credentials, fallbackMessage: 'Rider login failed' });
    if (data.token) {
      saveSessionTokens('rider', data);
      try {
        localStorage.setItem(RIDER_PROFILE_KEY, JSON.stringify(data.partner));
      } catch {
        /* ignore */
      }
    }
    return data;
  },

  riderLogout: async () => {
    await endServerSession('rider');
    safeRemove(RIDER_PROFILE_KEY);
  },

  // The server identifies the rider from the token; ids are kept in the signatures for existing callers
  getRiderOrders: (riderId: string) =>
    request(`/rider/orders/${encodeURIComponent(riderId)}`, { role: 'rider', fallbackMessage: 'Failed to fetch rider orders' }),

  /** The rider could not hand the gift over ('failed') or it has to be moved ('reschedule'). One tap, cannot be undone. */
  reportDeliveryIssue: async (orderId: string, issue: 'failed' | 'reschedule') => {
    const data = await request(`/rider/orders/${encodeURIComponent(orderId)}/delivery-issue`, {
      method: 'PUT',
      role: 'rider',
      body: { issue },
      fallbackMessage: 'Failed to report the delivery issue',
    });
    return data.order;
  },

  markRiderOutForDelivery: async (orderId: string, _riderId?: string) => {
    const data = await request(`/rider/orders/${encodeURIComponent(orderId)}/out-for-delivery`, {
      method: 'PUT',
      role: 'rider',
      body: {},
      fallbackMessage: 'Failed to update order status',
    });
    return data.order;
  },

  verifyDeliveryOtp: (orderId: string, otp: string, _riderId?: string) =>
    request(`/rider/orders/${encodeURIComponent(orderId)}/verify-otp`, {
      method: 'POST',
      role: 'rider',
      body: { otp },
      fallbackMessage: 'OTP verification failed',
    }),

  updateRiderDutyStatus: (_riderId: string, duty_status: 'on_duty' | 'on_leave') =>
    request('/rider/duty-status', { method: 'PUT', role: 'rider', body: { duty_status }, fallbackMessage: 'Failed to update duty status' }),

  // ---------------------------------------------------------------------------
  // Newsletter
  // ---------------------------------------------------------------------------
  subscribeNewsletter: (email: string) =>
    request<{ success: boolean; message: string; subscriber?: any }>('/user/newsletter/subscribe', {
      method: 'POST',
      body: { email },
      fallbackMessage: 'Failed to subscribe to newsletter',
    }),

  getNewsletterSubscribers: (limit = 100) =>
    request<{ success: boolean; subscribers: any[] }>(`/user/newsletter/subscribers?limit=${limit}`, {
      role: 'superadmin',
      fallbackMessage: 'Failed to fetch subscribers',
    }),

  // ---------------------------------------------------------------------------
  // Coupons (Superadmin)
  // ---------------------------------------------------------------------------
  getAllCouponsAdmin: async () => {
    const data = await request<{ success: boolean; coupons: any[] }>('/coupons/admin', {
      role: 'superadmin',
      fallbackMessage: 'Failed to fetch coupons',
    });
    return data.coupons || [];
  },

  createCoupon: async (couponData: any) => {
    const data = await request<{ success: boolean; message: string; coupon: any }>('/coupons', {
      method: 'POST',
      role: 'superadmin',
      body: couponData,
      fallbackMessage: 'Failed to create coupon',
    });
    return data.coupon;
  },

  updateCoupon: async (id: string, couponData: any) => {
    const data = await request<{ success: boolean; message: string; coupon: any }>(`/coupons/${encodeURIComponent(id)}`, {
      method: 'PUT',
      role: 'superadmin',
      body: couponData,
      fallbackMessage: 'Failed to update coupon',
    });
    return data.coupon;
  },

  toggleCouponStatus: async (id: string) => {
    const data = await request<{ success: boolean; message: string; coupon: any }>(`/coupons/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      role: 'superadmin',
      fallbackMessage: 'Failed to toggle coupon status',
    });
    return data.coupon;
  },

  deleteCoupon: async (id: string) => {
    return request<{ success: boolean; message: string }>(`/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      role: 'superadmin',
      fallbackMessage: 'Failed to delete coupon',
    });
  },

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------
  getProductReviews: async (productId: string) => {
    const data = await request(`/reviews/${encodeURIComponent(productId)}`, {
      fallbackMessage: 'Failed to fetch reviews',
    });
    return data.data || [];
  },

  /** The most recent delivered order of this shopper that still waits for a review, or null. */
  getPendingReview: async () => {
    const data = await request('/reviews/mine/pending', { role: 'buyer', fallbackMessage: 'Failed to check for reviews' });
    return (data.order || null) as { id: string; order_number?: string; items: { product_id: string; name: string; image: string | null }[] } | null;
  },

  submitOrderReview: (orderId: string, rating: number, comment: string) =>
    request(`/reviews/order/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      role: 'buyer',
      body: { rating, comment },
      fallbackMessage: 'Failed to save your review',
    }),

  createReviewAsAdmin: async (reviewData: any) => {
    const data = await request(`/reviews`, {
      method: 'POST',
      role: 'superadmin',
      body: reviewData,
      fallbackMessage: 'Failed to add review',
    });
    return data.data;
  },
};
