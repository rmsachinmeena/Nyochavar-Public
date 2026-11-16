import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User as DbUser, UserAddress, CartItem } from '../../types';
import { useAuth, useCart, useFavorites, useUI, MAX_QTY_PER_PRODUCT } from '../../context';
import { api } from '../../services/api';
import { saveStoredUser } from '../../utils/storedUser';
import { OrderTracker } from './OrderTracker';
import { formatPrice } from '../../utils/format';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { BottomNav } from '../../components/layout/BottomNav';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { SafeImage } from '../../components/ui/SafeImage';
import { PhoneVerificationModal } from '../../components/auth/PhoneVerificationModal';
import { LockedPhoneTag, PhoneVerifyControl, usePhoneVerification } from '../../components/auth/PhoneVerifyControl';
import { shakeElements } from '../../utils/shake';
import { PickerSelect } from '../../components/ui/PickerSelect';
import { DELIVERY_AREAS, isDeliveryArea } from '../checkout/deliveryAreas';
import { googleMapsLinkFor, isGoogleMapsLink } from '../../utils/mapsLink';
import { OrderEventArt } from '../../components/illustrations/OrderIllustrations';
import { 
  User, Package, Settings, ArrowLeft, Edit2, Save, X, Mail, 
  ShieldCheck, LogOut, MapPin, Heart, Bell, ShoppingBag, 
  LayoutDashboard, Menu, Lock, Key, Phone, CheckCircle2, 
  AlertCircle, ChevronRight, ChevronDown, Trash2, ExternalLink, Sparkles,
  Plus, Home, Building2, Check, Gift, Sliders, Calendar, MessageSquare, Globe,
  Eye, EyeOff, Pencil, Inbox, ArrowRight, Truck, Camera, PenLine, CheckCheck, CreditCard, Megaphone
} from 'lucide-react';
import styles from '../../styles/productPage.module.css';

interface ProfilePageProps {
  user?: DbUser | null;
  onNavigate?: (view: string) => void;
  onUpdateUser?: (user: DbUser) => void;
  onLogout?: () => void;
}

// How each notification type looks: icon + colour
const NOTIFICATION_LOOK: Record<string, { icon: React.ElementType; tone: string }> = {
  order: { icon: Package, tone: 'bg-blue-100 text-blue-600' },
  payment: { icon: CreditCard, tone: 'bg-emerald-100 text-emerald-600' },
  delivery: { icon: Truck, tone: 'bg-amber-100 text-amber-600' },
  account: { icon: User, tone: 'bg-violet-100 text-violet-600' },
  offer: { icon: Gift, tone: 'bg-rose-100 text-rose-600' },
  announcement: { icon: Megaphone, tone: 'bg-sky-100 text-sky-600' },
  system: { icon: Bell, tone: 'bg-slate-100 text-slate-600' },
};

const timeAgo = (iso?: string) => {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
  user: propUser, 
  onNavigate: propNavigate, 
  onUpdateUser, 
  onLogout: propLogout 
}) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast } = useUI();
  const { cart, cartTotalCount, cartSubtotal, handleUpdateQuantity, handleRemoveCartItem, handleClearCart, getItemQuantityInCart } = useCart();
  const { favorites, handleToggleFavorite, removeFavorite } = useFavorites();
  const currentUser = propUser || auth.loggedInUser;

  const onLogout = propLogout || (() => {
    auth.handleLogout();
    navigate('/');
  });

  const onNavigate = (view: string) => {
    if (propNavigate) {
      propNavigate(view);
    } else {
      navigate(view === 'home' ? '/' : `/${view}`);
    }
  };

  // Navigation tabs state
  const [searchParams] = useSearchParams();
  const PROFILE_TAB_IDS = ['profile', 'security', 'orders', 'cart', 'address', 'wishlist', 'notifications', 'preferences'];
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'cart' | 'address' | 'wishlist' | 'notifications' | 'preferences'>(() => {
    const requested = searchParams.get('tab');
    return requested && PROFILE_TAB_IDS.includes(requested) ? (requested as any) : 'profile';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Profile data & edit state
  const [dbUser, setDbUser] = useState<DbUser | null>(currentUser);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Profile Form State
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  // An account made with a mobile number has no email yet: this field lets the customer add one
  const [editEmail, setEditEmail] = useState('');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [editAddress, setEditAddress] = useState(currentUser?.address_line || '');
  const [editCity, setEditCity] = useState(currentUser?.city || '');
  const [editPincode, setEditPincode] = useState(currentUser?.pincode || '');

  // Multiple Addresses State
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Address Form State
  const [addressLabel, setAddressLabel] = useState('Home');
  const [addressName, setAddressName] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  // The contact number of an address must be verified before the address is saved
  const addressPhoneVerification = usePhoneVerification(addressPhone);
  const editPhoneVerification = usePhoneVerification(editPhone);
  // Which phone field the shopper left unverified when saving: it turns red and shakes
  const [unverifiedPhoneField, setUnverifiedPhoneField] = useState<'edit' | 'address' | null>(null);
  // An address whose number is verified keeps that number: only the rest of the address can be edited
  const editingAddressPhoneLocked = Boolean(editingAddressId && addresses.find((a) => a.id === editingAddressId)?.phone_verified);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressPincode, setAddressPincode] = useState('');
  const [addressIsDefault, setAddressIsDefault] = useState(false);
  const [addressLocationError, setAddressLocationError] = useState<string | null>(null);

  // Password State (Direct Password Set / Update - 1 Field + Remember Always + Submit)
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAlways, setRememberAlways] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const hasPasswordSetKey = currentUser?.id ? `petal_pen_has_set_password_${currentUser.id}` : 'petal_pen_has_set_password';
  const [hasSetPassword, setHasSetPassword] = useState<boolean>(() => {
    return localStorage.getItem(hasPasswordSetKey) === 'true';
  });

  // Data fetching state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  // Live notifications: loaded once, new ones arrive over the socket
  const {
    items: notifications,
    loading: notificationsLoading,
    markRead: handleMarkNotificationRead,
    markAllRead: handleMarkAllNotificationsRead,
    removeItem: handleRemoveNotification,
  } = useNotificationFeed(currentUser?.id);

  // Preferences State & Persistence
  const prefStorageKey = `petal_pen_user_preferences_${currentUser?.id || 'guest'}`;
  const [prefEmailNotifications, setPrefEmailNotifications] = useState(true);
  const [prefSmsAlerts, setPrefSmsAlerts] = useState(true);
  const [prefOccasionReminders, setPrefOccasionReminders] = useState(true);
  const [prefWhatsappUpdates, setPrefWhatsappUpdates] = useState(true);
  const [prefVegetarianOnly, setPrefVegetarianOnly] = useState(false);
  const [prefHandwrittenCard, setPrefHandwrittenCard] = useState(true);
  const [prefPackaging, setPrefPackaging] = useState<'royal-box' | 'wooden-trunk' | 'eco-luxe'>('royal-box');
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    'Birthdays', 'Anniversaries', 'Festive & Diwali'
  ]);
  const [prefBudget, setPrefBudget] = useState<string>('₹3,000 - ₹7,000');
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSavedFeedback, setPrefSavedFeedback] = useState(false);
  // True once the user has saved their preferences at least once (counts towards profile completion)
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(prefStorageKey);
      setHasSavedPreferences(Boolean(saved));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.emailNotifications !== undefined) setPrefEmailNotifications(parsed.emailNotifications);
        if (parsed.smsAlerts !== undefined) setPrefSmsAlerts(parsed.smsAlerts);
        if (parsed.occasionReminders !== undefined) setPrefOccasionReminders(parsed.occasionReminders);
        if (parsed.whatsappUpdates !== undefined) setPrefWhatsappUpdates(parsed.whatsappUpdates);
        if (parsed.vegetarianOnly !== undefined) setPrefVegetarianOnly(parsed.vegetarianOnly);
        if (parsed.handwrittenCard !== undefined) setPrefHandwrittenCard(parsed.handwrittenCard);
        if (parsed.packaging) setPrefPackaging(parsed.packaging);
        if (Array.isArray(parsed.occasions)) setSelectedOccasions(parsed.occasions);
        if (parsed.budget) setPrefBudget(parsed.budget);
      }
    } catch (e) {
      console.warn('Failed to parse preferences:', e);
    }
  }, [prefStorageKey]);

  const handleSavePreferences = () => {
    setPrefSaving(true);
    try {
      const payload = {
        emailNotifications: prefEmailNotifications,
        smsAlerts: prefSmsAlerts,
        occasionReminders: prefOccasionReminders,
        whatsappUpdates: prefWhatsappUpdates,
        vegetarianOnly: prefVegetarianOnly,
        handwrittenCard: prefHandwrittenCard,
        packaging: prefPackaging,
        occasions: selectedOccasions,
        budget: prefBudget,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(prefStorageKey, JSON.stringify(payload));
      setHasSavedPreferences(true);
      setTimeout(() => {
        setPrefSaving(false);
        setPrefSavedFeedback(true);
        setTimeout(() => setPrefSavedFeedback(false), 3500);
      }, 400);
    } catch (e) {
      setPrefSaving(false);
    }
  };

  const toggleOccasion = (occ: string) => {
    setSelectedOccasions(prev => 
      prev.includes(occ) ? prev.filter(o => o !== occ) : [...prev, occ]
    );
  };

  // Feedback Messages
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHubOpen, setIsHubOpen] = useState(false);

  // Every order starts as a small card; its down arrow opens the details. The order opened from a notification starts open.
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
  const isOrderOpen = (order: any) => expandedOrderIds.includes(String(order.id));
  const toggleOrder = (order: any) => {
    const id = String(order.id);
    setExpandedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Order waiting for the "cancel this order?" popup
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    setCancellingOrder(true);
    setCancelError('');
    try {
      const result = await api.cancelOrder(orderToCancel.id);
      // The server's copy carries the refund status of a paid online order
      setOrders((prev) => prev.map((o) => (o.id === orderToCancel.id ? { ...o, ...(result?.order || {}), order_status: 'cancelled' } : o)));
      setOrderToCancel(null);
    } catch (err: any) {
      setCancelError(err?.message || 'Could not cancel the order. Please try again.');
    } finally {
      setCancellingOrder(false);
    }
  };

  // Notification waiting for the "are you sure?" popup
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  // When set, the Orders tab shows only this order (opened from its notification)
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(() => searchParams.get('order'));
  const requestedOrder = searchParams.get('order');
  useEffect(() => {
    if (requestedOrder) setFocusedOrderId(requestedOrder);
  }, [requestedOrder]);
  // The order opened from a notification is shown alone, whatever tab is chosen
  const visibleOrders = focusedOrderId ? orders.filter((o: any) => String(o.id) === focusedOrderId) : orders;

  // The order opened from a notification starts with its details open
  useEffect(() => {
    if (focusedOrderId) setExpandedOrderIds((prev) => (prev.includes(focusedOrderId) ? prev : [...prev, focusedOrderId]));
  }, [focusedOrderId]);

  // A link like /profile?tab=orders opens that tab even when this page is already open
  const requestedTab = searchParams.get('tab');
  useEffect(() => {
    if (requestedTab && PROFILE_TAB_IDS.includes(requestedTab)) setActiveTab(requestedTab as any);
  }, [requestedTab]);

  // Whichever way a tab is opened (sidebar, quick menu, bottom nav, link), show it straight away from its top
  useEffect(() => {
    if (activeTab !== 'orders') setFocusedOrderId(null);
    contentRef.current?.scrollTo({ top: 0 });
    setIsMobileMenuOpen(false);
    setIsFabOpen(false);
  }, [activeTab]);

  // Fetch fresh user profile from DB on mount
  useEffect(() => {
    if (currentUser?.id) {
      api.getProfile(currentUser.id)
        .then((freshUser) => {
          if (freshUser) {
            setDbUser(freshUser);
            setEditName(freshUser.name || '');
            setEditPhone(freshUser.phone || '');
            setEditAddress(freshUser.address_line || '');
            setEditCity(freshUser.city || '');
            setEditPincode(freshUser.pincode || '');
            if (freshUser.addresses && Array.isArray(freshUser.addresses)) {
              setAddresses(freshUser.addresses);
            }
            // Update auth context
            auth.setLoggedInUser(freshUser);
            saveStoredUser(freshUser);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch fresh profile from DB:', err.message);
        });
    }
  }, [currentUser?.id]);

  // Fetch addresses when Address tab is opened
  useEffect(() => {
    if (activeTab === 'address' && currentUser?.id) {
      setAddressesLoading(true);
      api.getUserAddresses(currentUser.id)
        .then((data) => {
          if (Array.isArray(data)) {
            setAddresses(data);
            const active = data.find((a: any) => a.is_default) || data[0];
            if (active && !localStorage.getItem('petal_pen_selected_address')) {
              localStorage.setItem('petal_pen_selected_address', JSON.stringify(active));
            }
          }
        })
        .catch((err) => console.warn('Could not load addresses:', err.message))
        .finally(() => setAddressesLoading(false));
    }
  }, [activeTab, currentUser?.id]);

  // Fetch orders when tab is clicked
  useEffect(() => {
    if (activeTab === 'orders' && currentUser?.id) {
      setOrdersLoading(true);
      api.getUserOrders(currentUser.id)
        .then(data => setOrders(data || []))
        .catch(err => console.warn('Could not load orders:', err.message))
        .finally(() => setOrdersLoading(false));
    }
  }, [activeTab, currentUser?.id]);

  // Fetch wishlist when tab is clicked
  useEffect(() => {
    if (activeTab === 'wishlist' && currentUser?.id) {
      setWishlistLoading(true);
      api.getUserWishlist(currentUser.id)
        .then(data => setWishlist(data || []))
        .catch(err => console.warn('Could not load wishlist:', err.message))
        .finally(() => setWishlistLoading(false));
    }
  }, [activeTab, currentUser?.id]);

  if (!currentUser && activeTab === 'notifications') {
    return (
      <div className="relative min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-body">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          aria-label="Go back"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center bg-white px-6 py-10 sm:px-8 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full">
          <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-blue-50 ring-8 ring-blue-50/50">
            <Inbox className="h-11 w-11 text-blue-500" strokeWidth={1.5} />
            <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-white text-blue-600 shadow-md ring-1 ring-blue-100">
              <Bell className="h-4 w-4" />
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Log in for updates</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-7">
            Your inbox is empty for now. Sign in to get order updates, delivery alerts and gifting offers right here.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/')}
            className="mt-2 w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-body">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Your Profile</h2>
          <p className="text-sm text-slate-600 mb-6">Please sign in to view your orders, address, and account details.</p>
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-3 bg-[#0052FF] text-white text-sm font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editPhone.trim() && !editPhoneVerification.verified && !accountPhoneLocked) {
      setUnverifiedPhoneField('edit');
      setFeedback({ type: 'error', text: 'Please verify your phone number before saving.' });
      shakeElements(['profile-edit-phone', 'profile-edit-phone-verify']);
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    
    try {
      const updated = await api.updateProfile(currentUser.id, {
        name: editName,
        phone: editPhone,
        // Only sent when the account has no email yet (an email already on the account is never changed here)
        ...(!displayUser.email && editEmail.trim() ? { email: editEmail.trim() } : {}),
        address_line: editAddress,
        city: editCity,
        pincode: editPincode
      });

      setDbUser(updated);
      if (onUpdateUser) onUpdateUser(updated);
      auth.setLoggedInUser(updated);
      saveStoredUser(updated);
      
      setIsEditingProfile(false);
      setEditingAddressId(null);
      setIsAddingAddress(false);
      setFeedback({ type: 'success', text: 'Profile details saved to database!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Set / Update Direct Password (1 field + remember always + submit)
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setPasswordSuccess(false);

    if (!passwordInput || passwordInput.trim().length < 8) {
      setFeedback({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }

    if (!currentUser?.id) {
      setFeedback({ type: 'error', text: 'User session not found. Please sign in again.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.setPassword(currentUser.id, passwordInput.trim());

      if (rememberAlways) {
        localStorage.setItem('petal_pen_remember_login', 'true');
        if (currentUser.email) {
          localStorage.setItem('petal_pen_saved_email', currentUser.email);
        }
      }

      localStorage.setItem(hasPasswordSetKey, 'true');
      setHasSetPassword(true);
      setPasswordSuccess(true);
      setPasswordInput('');

      setFeedback({ 
        type: 'success', 
        text: res.message || 'Password saved successfully! You can now log in next time with your email and this password.' 
      });

      setTimeout(() => {
        setFeedback(null);
        setPasswordSuccess(false);
      }, 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to set password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Move a cart line to the wishlist (saves the product, then drops the line from the cart)
  const handleMoveToWishlist = (item: CartItem) => {
    if (!favorites.includes(item.productId)) handleToggleFavorite(item.productId);
    handleRemoveCartItem(item.id);
    setFeedback({ type: 'success', text: `${item.name} moved to your wishlist.` });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Handle Remove from Wishlist
  const handleRemoveWishlist = async (productId: string) => {
    try {
      await api.removeFromWishlist(currentUser.id, productId);
      removeFavorite(productId, { serverAlreadyUpdated: true });
      setWishlist(prev => prev.filter(item => item.product_id !== productId));
      setFeedback({ type: 'success', text: 'Item removed from wishlist.' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to remove from wishlist' });
    }
  };

  // Open a notification: mark it read, then go where it points (an order, the profile tabs, or a page)
  // Clicking a notification opens its message in a popup; "View order details" there goes to the link
  const [viewedNotification, setViewedNotification] = useState<any | null>(null);

  // Small tabs on the Notifications page: All (the default), Orders (about an order, a payment or a delivery), Others (the rest)
  type NotifFilter = 'all' | 'orders' | 'others';
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('all');
  const notifMatchesFilter = (notif: any, filter: NotifFilter) => {
    if (filter === 'all') return true;
    const aboutOrder = Boolean(notif.order_id) || ['order', 'payment', 'delivery'].includes(notif.type);
    return filter === 'orders' ? aboutOrder : !aboutOrder;
  };
  const visibleNotifications = notifications.filter((n: any) => notifMatchesFilter(n, notifFilter));

  // Notifications about an order show what was bought (photo + name + amount) instead of a long sentence.
  // New ones carry the products in `data.items`; for older ones they are looked up from the shopper's orders, once.
  type NotifProduct = { product_id?: string | null; name: string; image?: string | null };
  const [notifOrderItems, setNotifOrderItems] = useState<Record<string, NotifProduct[]>>({});
  useEffect(() => {
    if (activeTab !== 'notifications' || !currentUser?.id) return;
    const needsLookup = notifications.some((n: any) => n.order_id && !(Array.isArray(n.data?.items) && n.data.items.length > 0));
    if (!needsLookup) return;
    let cancelled = false;
    api.getUserOrders(currentUser.id)
      .then((all: any[]) => {
        if (cancelled) return;
        const byOrder: Record<string, NotifProduct[]> = {};
        (all || []).forEach((order: any) => {
          byOrder[String(order.id)] = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
            product_id: item.productId || item.product_id,
            name: item.name,
            image: item.image,
          }));
        });
        setNotifOrderItems(byOrder);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab, notifications.length]);
  const productsOfNotification = (notif: any): NotifProduct[] =>
    Array.isArray(notif.data?.items) && notif.data.items.length > 0 ? notif.data.items : notif.order_id ? notifOrderItems[String(notif.order_id)] || [] : [];
  // Photo + name of the products in the opened notification. New notifications carry them in `data.items`; for older
  // ones they are looked up from the order itself.
  const [viewedItems, setViewedItems] = useState<{ product_id?: string | null; name: string; image?: string | null }[]>([]);
  useEffect(() => {
    setViewedItems([]);
    const notif = viewedNotification;
    if (!notif?.order_id || (Array.isArray(notif.data?.items) && notif.data.items.length > 0) || !currentUser?.id) return;
    let cancelled = false;
    const toItems = (order: any) =>
      (Array.isArray(order?.items) ? order.items : []).map((item: any) => ({
        product_id: item.productId || item.product_id,
        name: item.name,
        image: item.image,
      }));
    const known = orders.find((o: any) => String(o.id) === String(notif.order_id));
    if (known) {
      setViewedItems(toItems(known));
      return;
    }
    api.getUserOrders(currentUser.id)
      .then((all: any[]) => {
        const order = (all || []).find((o: any) => String(o.id) === String(notif.order_id));
        if (!cancelled && order) setViewedItems(toItems(order));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewedNotification?.id]);

  const viewNotification = (notif: any) => {
    if (!notif.is_read) void handleMarkNotificationRead(notif.id);
    setViewedNotification(notif);
  };

  const openNotification = (notif: { link?: string | null }) => {
    const link = notif.link || '';
    if (link.startsWith('/profile?')) {
      const params = new URLSearchParams(link.split('?')[1]);
      const tab = params.get('tab');
      setFocusedOrderId(params.get('order'));
      if (tab && PROFILE_TAB_IDS.includes(tab)) setActiveTab(tab as any);
    } else if (link.startsWith('/')) navigate(link);
  };

  // -------------------------------------------------------------
  // MULTIPLE ADDRESSES HANDLERS
  // -------------------------------------------------------------
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressLabel('Home');
    setAddressName(displayUser.name || '');
    // a new address has its own number; the account number is only suggested for the very first address
    setAddressPhone(addresses.length === 0 ? displayUser.phone || '' : '');
    setAddressStreet('');
    setAddressCity(isDeliveryArea(displayUser.city || '') ? displayUser.city || '' : '');
    setAddressPincode(isGoogleMapsLink(displayUser.pincode || '') ? displayUser.pincode || '' : '');
    setAddressLocationError(null);
    setAddressIsDefault(addresses.length === 0);
    setIsAddingAddress(true);
  };

  const handleOpenEditAddress = (addr: UserAddress) => {
    setEditingAddressId(addr.id);
    setAddressLabel(addr.label || 'Home');
    setAddressName(addr.name || '');
    setAddressPhone(addr.phone || '');
    setAddressStreet(addr.address_line || '');
    setAddressCity(isDeliveryArea(addr.city || '') ? addr.city || '' : '');
    // The location is only ever a Google Maps link: an older value that is not one (a pincode, coordinates) shows empty
    setAddressPincode(isGoogleMapsLink(addr.pincode || '') ? addr.pincode || '' : '');
    setAddressLocationError(null);
    setAddressIsDefault(addr.is_default);
    setIsAddingAddress(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    if (!addressPhoneVerification.verified && !editingAddressPhoneLocked) {
      setUnverifiedPhoneField('address');
      // A small warning at the top of the screen (the page banner can be scrolled out of sight on this long form)
      showToast({ tone: 'warning', title: 'Verify your number', description: 'Please verify your number for this address.' });
      shakeElements(['profile-address-phone', 'profile-address-phone-verify']);
      return;
    }
    if (!isDeliveryArea(addressCity)) {
      setFeedback({ type: 'error', text: 'Please choose a delivery area from the list.' });
      shakeElements(['profile-address-area']);
      return;
    }
    // The location is optional, but when filled it must be a Google Maps link; anything else is cleared
    if (addressPincode.trim() && !isGoogleMapsLink(addressPincode)) {
      setAddressPincode('');
      setAddressLocationError('Only a Google Maps link is allowed here, so the field was cleared.');
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      let res;
      if (editingAddressId) {
        res = await api.updateUserAddress(currentUser.id, editingAddressId, {
          label: addressLabel,
          name: addressName,
          phone: addressPhone,
          address_line: addressStreet,
          city: addressCity,
          pincode: addressPincode,
          is_default: addressIsDefault
        });
        setFeedback({ type: 'success', text: 'Address updated successfully in database!' });
      } else {
        res = await api.addUserAddress(currentUser.id, {
          label: addressLabel,
          name: addressName,
          phone: addressPhone,
          address_line: addressStreet,
          city: addressCity,
          pincode: addressPincode,
          is_default: addressIsDefault
        });
        setFeedback({ type: 'success', text: 'New address added successfully to database!' });
      }

      if (res && res.addresses) {
        setAddresses(res.addresses);
      }
      setIsAddingAddress(false);
      setEditingAddressId(null);

      // Refresh overall profile
      const freshUser = await api.getProfile(currentUser.id);
      if (freshUser) {
        setDbUser(freshUser);
        auth.setLoggedInUser(freshUser);
        saveStoredUser(freshUser);
      }
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save address' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!currentUser?.id) return;
    if (!window.confirm('Are you sure you want to remove this address?')) return;
    setIsLoading(true);
    try {
      const res = await api.deleteUserAddress(currentUser.id, addrId);
      if (res && res.addresses) {
        setAddresses(res.addresses);
      }
      setFeedback({ type: 'success', text: 'Address removed successfully!' });
      const freshUser = await api.getProfile(currentUser.id);
      if (freshUser) {
        setDbUser(freshUser);
        auth.setLoggedInUser(freshUser);
        saveStoredUser(freshUser);
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to remove address' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefaultAddress = async (addrId: string) => {
    if (!currentUser?.id) return;

    // Immediately locate chosen address and persist for global app usage (Checkout, Orders, etc.)
    const chosen = addresses.find(a => a.id === addrId);
    if (chosen) {
      localStorage.setItem('petal_pen_selected_address', JSON.stringify({
        ...chosen,
        is_default: true
      }));
    }

    // Optimistic UI update: toggles the checkbox instantly
    setAddresses(prev => prev.map(a => ({
      ...a,
      is_default: a.id === addrId
    })));

    setFeedback({ type: 'success', text: 'Delivery address selected! Active for checkout & orders.' });

    try {
      const res = await api.setDefaultUserAddress(currentUser.id, addrId);
      if (res && res.addresses) {
        setAddresses(res.addresses);
        const active = res.addresses.find((a: any) => a.is_default);
        if (active) {
          localStorage.setItem('petal_pen_selected_address', JSON.stringify(active));
        }
      }
      const freshUser = await api.getProfile(currentUser.id);
      if (freshUser) {
        setDbUser(freshUser);
        auth.setLoggedInUser(freshUser);
        saveStoredUser(freshUser);
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update selected address' });
    }
  };

  interface TabItem {
    id: 'profile' | 'security' | 'orders' | 'cart' | 'address' | 'wishlist' | 'notifications' | 'preferences';
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'security', label: 'Password', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'orders', label: 'Orders', icon: <Package className="w-5 h-5" />, badge: orders.length || undefined },
    { id: 'cart', label: 'Cart', icon: <ShoppingBag className="w-5 h-5" />, badge: cart.length || undefined },
    { id: 'address', label: 'Address', icon: <MapPin className="w-5 h-5" />, badge: addresses.length || undefined },
    { id: 'wishlist', label: 'Wishlist', icon: <Heart className="w-5 h-5" />, badge: wishlist.length || undefined },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" />, badge: notifications.filter(n => !n.is_read).length || undefined },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-5 h-5" /> }
  ];

  const displayUser = dbUser || currentUser;
  // The first number an account verifies is final
  const accountPhoneLocked = Boolean(displayUser?.is_phone_verified && displayUser?.phone);

  // Profile completion: each step turns green once its information is saved
  const hasContactDetails = Boolean(displayUser.name?.trim() && displayUser.phone?.trim());
  const hasDeliveryAddress = addresses.length > 0 || Boolean(displayUser.address_line?.trim() && displayUser.city?.trim());
  const completionSteps: {
    id: 'account' | 'contact' | 'address' | 'preferences';
    title: string;
    description: string;
    cta: string;
    icon: React.ReactNode;
    done: boolean;
  }[] = [
    {
      id: 'account',
      title: 'Account created',
      description: displayUser.email || (displayUser.phone ? `+91 ${displayUser.phone}` : 'Your account is verified'),
      cta: '',
      icon: <User className="w-4 h-4" />,
      done: true
    },
    {
      id: 'contact',
      title: 'Contact details',
      description: hasContactDetails ? displayUser.phone || '' : 'Add your name and phone number',
      cta: 'Add details',
      icon: <Phone className="w-4 h-4" />,
      done: hasContactDetails
    },
    {
      id: 'address',
      title: 'Delivery address',
      description: hasDeliveryAddress
        ? addresses.length > 1
          ? `${addresses.length} addresses saved`
          : addresses[0]?.city || displayUser.city || 'Address saved'
        : 'Save where your gifts should arrive',
      cta: 'Add address',
      icon: <MapPin className="w-4 h-4" />,
      done: hasDeliveryAddress
    },
    {
      id: 'preferences',
      title: 'Gifting preferences',
      description: hasSavedPreferences ? 'Occasions, packaging and alerts saved' : 'Choose occasions, packaging and alerts',
      cta: 'Set preferences',
      icon: <Sliders className="w-4 h-4" />,
      done: hasSavedPreferences
    }
  ];
  const completedSteps = completionSteps.filter((step) => step.done).length;
  const completionPercent = Math.round((completedSteps / completionSteps.length) * 100);
  const nextStep = completionSteps.find((step) => !step.done);

  const goToCompletionStep = (stepId: 'contact' | 'address' | 'preferences') => {
    setFeedback(null);
    setEditingAddressId(null);
    setIsAddingAddress(false);
    if (stepId === 'contact') {
      setActiveTab('profile');
      setIsEditingProfile(true);
      // Take the user straight down to the edit form once it has rendered
      window.setTimeout(() => {
        document.getElementById('profile-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } else {
      setIsEditingProfile(false);
      setActiveTab(stepId);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Header "Back": return to the page the user came from, or the storefront when this page was opened directly
  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else onNavigate('home');
  };

  const openTabFromBottomNav = (tab: 'profile' | 'cart' | 'wishlist' | 'notifications') => {
    setActiveTab(tab);
    setFeedback(null);
    setIsEditingProfile(false);
    setEditingAddressId(null);
    setIsAddingAddress(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-50 flex flex-col md:flex-row font-body">
      
      {/* Mobile Header: menu on the left, page title in the centre, "Back" button on the right */}
      <header className="md:hidden relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm z-20">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Centred on the screen itself (not between the two buttons), with room kept free on both sides */}
        <span className="pointer-events-none absolute inset-x-0 truncate px-20 text-center text-[15px] font-bold text-slate-900">
          {tabs.find(t => t.id === activeTab)?.label || 'My Account'}
        </span>

        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-9 items-center rounded-full bg-blue-50 px-4 text-sm font-bold text-blue-600 ring-1 ring-blue-100 transition-colors hover:bg-blue-100 active:scale-95"
        >
          Back
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar (Full Height, Fixed 1-Screen) */}
      <div className={`fixed inset-y-0 left-0 z-40 w-[min(86vw,300px)] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 bg-white border-r border-slate-200 flex flex-col h-full transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-72 md:h-full md:z-0 shrink-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        
        {/* Mobile Sidebar Close Button (floats on the Storefront row to save vertical space) */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute right-3 top-3 z-10 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* User Profile Card */}
        <div className="px-5 pt-4 pb-4 md:p-6 border-b border-slate-100 flex flex-col items-center text-center relative group shrink-0">
          <button
            onClick={() => onNavigate('home')}
            className="self-start mb-1 md:mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </button>
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-xl md:text-2xl font-bold uppercase shadow-sm mb-2 md:mb-3">
            {displayUser.name ? displayUser.name.charAt(0) : 'U'}
          </div>
          <h2 className="text-base font-bold text-slate-900 truncate max-w-[200px]">{displayUser.name || 'Valued Client'}</h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5 truncate max-w-[220px]">{displayUser.email || (displayUser.phone ? `+91 ${displayUser.phone}` : '')}</p>
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
            <span>{displayUser.role === 'superadmin' ? 'Super Admin' : 'Customer Account'}</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-3 px-3 md:py-6 md:px-4 space-y-1 md:space-y-1.5 overflow-y-auto overscroll-contain">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { 
                setActiveTab(tab.id as any); 
                setFeedback(null);
                setIsEditingProfile(false);
                setEditingAddressId(null);
                setIsAddingAddress(false);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 md:py-3 text-sm font-bold rounded-xl transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className={`${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </div>

              {/* Dynamic Badge */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}

          {/* Mobile Logout: last item in the scrollable list so the bottom nav never hides it */}
          <div className="md:hidden mt-2 border-t border-slate-100 pt-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 text-sm font-bold rounded-xl text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5 text-red-500" />
              Logout
            </button>
          </div>
        </div>

        {/* Logout Button (desktop: pinned to the bottom of the sidebar) */}
        <div className="hidden md:block p-4 border-t border-slate-100 mt-auto">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-sm font-bold rounded-xl text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            Logout
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div ref={contentRef} className="flex-1 h-full overflow-y-auto p-4 sm:p-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-10 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
              <span>{feedback.text}</span>
            </div>
          )}
          
          {/* ======================================================== */}
          {/* TAB 1: DASHBOARD / PERSONAL INFORMATION + PASSWORD CHANGE */}
          {/* ======================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Profile completion: progress bar + steps that turn green once done */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {completionPercent === 100 ? 'Your profile is complete 🎉' : 'Complete your profile'}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {nextStep
                        ? `${completedSteps} of ${completionSteps.length} steps done · next: ${nextStep.title.toLowerCase()}`
                        : 'Faster checkout and gift picks tailored to you are all set up.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums transition-colors duration-500 ${
                      completionPercent === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {completionPercent}%
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label="Profile completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionPercent}
                  className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      completionPercent === 100 ? 'bg-emerald-500' : 'bg-linear-to-r from-blue-500 to-blue-600'
                    }`}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>

                <ul className="mt-4 sm:mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {completionSteps.map((step) => {
                    const body = (
                      <>
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                            step.done
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                          }`}
                        >
                          {step.done ? <Check className="h-4 w-4 stroke-3 animate-in zoom-in duration-300" /> : step.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-slate-900 leading-tight">{step.title}</span>
                          <span className="mt-0.5 block line-clamp-2 wrap-break-word text-[11px] leading-snug text-slate-500">{step.description}</span>
                        </span>
                        {!step.done && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-blue-600">
                            <span className="hidden min-[400px]:inline whitespace-nowrap">{step.cta}</span>
                            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        )}
                      </>
                    );

                    return (
                      <li key={step.id} className="min-w-0">
                        {step.done ? (
                          <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">{body}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => goToCompletionStep(step.id as 'contact' | 'address' | 'preferences')}
                            className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.99]"
                          >
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
                      {displayUser.name ? displayUser.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Profile</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Your account details</p>
                    </div>
                  </div>
                  {!isEditingProfile && (
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors px-2.5 py-1 bg-slate-50 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {!isEditingProfile ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-3 md:gap-6">
                        <div className="col-span-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{displayUser.name || 'Not provided'}</p>
                        </div>
                        <div className="col-span-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{displayUser.phone || 'Not provided'}</p>
                            {displayUser.phone ? (
                              displayUser.is_phone_verified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Verified
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsPhoneModalOpen(true)}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
                                >
                                  <ShieldCheck className="h-3 w-3 text-blue-600" /> Verify
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                          <div className="flex items-center gap-2">
                            {displayUser.email ? (
                              <>
                                <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-none">{displayUser.email}</p>
                                <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full shrink-0">Primary</span>
                              </>
                            ) : (
                              <p className="text-sm font-medium text-slate-400">Not added yet (use Edit to add your email)</p>
                            )}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</p>
                          <p className="text-sm font-semibold text-slate-900 capitalize">{displayUser.role || 'buyer'}</p>
                        </div>
                        <div className="col-span-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pincode</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{displayUser.pincode || 'Not provided'}</p>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                          <p className="text-sm font-semibold text-slate-900 leading-relaxed">{displayUser.address_line || 'Not provided'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{displayUser.city || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form id="profile-edit-form" onSubmit={handleSaveProfile} className="space-y-5 scroll-mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Full Name</label>
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="e.g. Khan Saabh"
                            className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Phone Number</label>
                          <div className="relative">
                          <input 
                            id="profile-edit-phone"
                            type="tel" 
                            value={editPhone}
                            disabled={accountPhoneLocked}
                            onChange={(e) => { setEditPhone(e.target.value); setUnverifiedPhoneField(null); }}
                            placeholder="Number"
                            className={`${unverifiedPhoneField === 'edit' ? 'border-red-500! ring-4 ring-red-500/10 ' : ''}block w-full pr-28 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`}
                          />
                          {accountPhoneLocked && (
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                              <LockedPhoneTag />
                            </div>
                          )}
                          {!accountPhoneLocked && editPhone.trim() && editPhoneVerification.required && (
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                              {editPhoneVerification.verified ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  id="profile-edit-phone-verify"
                                  onClick={() => setIsPhoneModalOpen(true)}
                                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-2 transition ${
                                    unverifiedPhoneField === 'edit' ? 'bg-red-600 ring-red-500/40 hover:bg-red-700' : 'bg-blue-600 ring-blue-600/20 hover:bg-blue-700'
                                  }`}
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                                </button>
                              )}
                            </div>
                          )}
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">Email {displayUser.email ? '' : '(optional)'}</label>
                          <input
                            type="email"
                            value={displayUser.email || editEmail}
                            disabled={Boolean(displayUser.email)}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="Add your email address"
                            className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">Street / Address Line</label>
                          <input 
                            type="text" 
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            placeholder="House / Flat No., Street, Landmark"
                            className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">City</label>
                          <input 
                            type="text" 
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            placeholder="e.g. Mumbai, Delhi, Jaipur"
                            className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Pincode</label>
                          <input 
                            type="text" 
                            value={editPincode}
                            onChange={(e) => setEditPincode(e.target.value)}
                            placeholder="e.g. 400001, 302020"
                            className="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold">{displayUser.email ? 'Email (Account ID): ' : 'Mobile (Account ID): '}</span>
                          <span>{displayUser.email || displayUser.phone}</span>
                        </div>
                        <span className="text-[10px] font-semibold bg-white/80 px-2 py-0.5 rounded text-blue-600">Fixed</span>
                      </div>

                      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <button 
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={isLoading}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ======================================================== */}
          {/* TAB 1.5: SECURITY / PASSWORD SETTINGS */}
          {/* ======================================================== */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {hasSetPassword ? 'Update Login Password' : 'Set Direct Login Password'}
                        </h3>
                        {hasSetPassword && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {hasSetPassword
                          ? 'Update your direct email login password anytime below.'
                          : 'Signed up with Google? Set a personal password to log in directly with your email anytime.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50/40">
                  <form onSubmit={handleSetPassword} className="space-y-4 max-w-md">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Enter Password</span>
                        <span className="text-[11px] font-normal text-slate-400">Min 4 characters</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Enter your new password"
                          className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 focus:border-blue-500 rounded-xl text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-0.5">
                      <input
                        type="checkbox"
                        id="rememberAlways"
                        checked={rememberAlways}
                        onChange={(e) => setRememberAlways(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="rememberAlways" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                        Remember always
                      </label>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passwordLoading || !passwordInput.trim()}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {passwordLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Key className="w-3.5 h-3.5" />
                            <span>Submit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium animate-fadeIn">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Password saved successfully! You can now log in using your email & this password.</span>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: ORDERS (Connected with orders table) */}
          {/* ======================================================== */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{focusedOrderId ? 'Order details' : 'Order History'}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{focusedOrderId ? 'The order from your notification' : 'Orders placed through Nyochavar synced with database'}</p>
                </div>
                {focusedOrderId ? (
                  <button
                    type="button"
                    onClick={() => setFocusedOrderId(null)}
                    className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
                  >
                    ← All orders
                  </button>
                ) : (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full shrink-0 whitespace-nowrap">
                    {orders.length} Total Orders
                  </span>
                )}
              </div>

              <div className="p-3 sm:p-5">
                {ordersLoading ? (
                  <div className="py-16 text-center text-slate-500 text-sm">
                    Loading orders from database...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                      <Package className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">No Orders Found Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mb-6">Explore our bespoke hampers and customized flowers to place your first order.</p>
                    <button 
                      onClick={() => onNavigate('catalog')}
                      className="px-6 py-2.5 bg-[#0052FF] text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                    >
                      Browse Catalog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleOrders.map((ord: any) => (
                      <div key={ord.id} className="rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-blue-300 sm:p-4">
                        {/* Order number, date and status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold uppercase text-slate-900">{ord.order_number || `Order #${ord.id}`}</p>
                            <p className="text-[11px] text-slate-500">
                              {new Date(ord.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                              ord.order_status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                              ord.order_status === 'out_for_delivery' ? 'bg-purple-100 text-purple-800' :
                              ord.order_status === 'processing' ? 'bg-amber-100 text-amber-800' :
                              ord.order_status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                              ord.order_status === 'awaiting_payment' ? 'bg-slate-100 text-slate-700' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {ord.order_status === 'out_for_delivery'
                                ? 'On the way'
                                : ord.order_status === 'awaiting_payment'
                                  ? 'Confirming payment'
                                  : (ord.order_status || 'placed')}
                            </span>
                          </div>
                        </div>

                        {/* What was bought: photo + name; tap a product to open it */}
                        <ul className="mt-2.5 space-y-1.5">
                          {(Array.isArray(ord.items) ? (isOrderOpen(ord) ? ord.items : ord.items.slice(0, 1)) : []).map((item: any, index: number) => {
                            const productId = item.productId || item.product_id;
                            const canOpen = Boolean(productId) && productId !== 'bespoke-hamper';
                            const detail = [item.variant?.name, item.selectedHue, item.palette].filter(Boolean).join(' · ');
                            return (
                              <li key={`${productId || 'item'}-${index}`}>
                                <button
                                  type="button"
                                  disabled={!canOpen}
                                  onClick={() => canOpen && navigate(`/product/${productId}`)}
                                  className={`flex w-full items-center gap-2.5 rounded-xl p-1 text-left transition ${canOpen ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                                >
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-cover" />
                                  ) : (
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                                      <Package className="h-5 w-5" />
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className={`block truncate text-[13px] font-semibold ${canOpen ? 'text-slate-900' : 'text-slate-800'}`}>{item.name}</span>
                                    <span className="block truncate text-[11px] text-slate-500">
                                      {detail ? `${detail} · ` : ''}Qty {item.quantity || 1}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-xs font-bold text-slate-700">{formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 1))}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        {!isOrderOpen(ord) && Array.isArray(ord.items) && ord.items.length > 1 && (
                          <p className="mt-1 px-1 text-[11px] font-medium text-slate-500">+{ord.items.length - 1} more {ord.items.length - 1 === 1 ? 'item' : 'items'}</p>
                        )}

                        {isOrderOpen(ord) && (
                        <>
                        {/* Delivery progress */}
                        <OrderTracker order={ord} />

                        {/* Delivery partner (not before the payment is confirmed) */}
                        {ord.order_status !== 'cancelled' && ord.order_status !== 'awaiting_payment' && (
                          ord.delivery_partner_name ? (
                            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-600">
                                <Truck className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Delivery partner</p>
                                <p className="truncate text-[13px] font-bold text-slate-900">{ord.delivery_partner_name}</p>
                              </div>
                              {ord.delivery_partner_phone && ord.order_status !== 'delivered' && (
                                <a
                                  href={`tel:${ord.delivery_partner_phone}`}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  <Phone className="h-3 w-3" /> Call
                                </a>
                              )}
                            </div>
                          ) : ord.order_status !== 'delivered' ? (
                            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">A delivery partner will be assigned soon.</p>
                          ) : null
                        )}

                        {/* Delivery OTP */}
                        {ord.delivery_otp && !['delivered', 'cancelled', 'awaiting_payment'].includes(ord.order_status) && (
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-amber-950">Delivery OTP</p>
                              <p className="text-[10px] leading-snug text-amber-800">Share this code with the delivery partner only at handover.</p>
                            </div>
                            <span className="shrink-0 rounded-lg border-2 border-amber-400 bg-white px-3 py-1 font-mono text-lg font-black tracking-widest text-amber-700">
                              {ord.delivery_otp}
                            </span>
                          </div>
                        )}

                        {/* Handwritten note */}
                        {ord.gift_message && (
                          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                            <p className="min-w-0 wrap-break-word">
                              <span className="font-bold">Handwritten note: </span>
                              <span className="font-serif italic">&ldquo;{ord.gift_message}&rdquo;</span>
                            </p>
                          </div>
                        )}

                        </>
                        )}

                        {/* Total, the small cancel button and the down arrow */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500">{ord.payment_method || 'Online'}</p>
                            <p className="text-sm font-extrabold text-slate-900">₹{Number(ord.total_amount).toLocaleString()}</p>
                            {ord.order_status === 'awaiting_payment' && (
                              <p className="text-[11px] font-semibold text-slate-600">Waiting for your bank to confirm the payment</p>
                            )}
                            {ord.refund_status && (
                              <p className={`text-[11px] font-semibold ${ord.refund_status === 'processed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {ord.refund_status === 'processed'
                                  ? `Refunded ₹${Number(ord.refund_amount ?? ord.total_amount).toLocaleString()} · reaches your account in 5 to 7 business days`
                                  : ord.refund_status === 'partial'
                                    ? `₹${Number(ord.refund_amount ?? 0).toLocaleString()} refunded`
                                    : 'Refund due · we start it within 2 business days'}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {(ord.order_status === 'placed' || ord.order_status === 'processing' || !ord.order_status) && (
                              ord.delivery_partner_id ? (
                                <button
                                  type="button"
                                  disabled
                                  title="A delivery partner is already assigned"
                                  className="shrink-0 cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-400"
                                >
                                  Cancel unavailable
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setCancelError(''); setOrderToCancel(ord); }}
                                  className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50"
                                >
                                  Cancel order
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => toggleOrder(ord)}
                              aria-expanded={isOrderOpen(ord)}
                              aria-label={isOrderOpen(ord) ? 'Hide order details' : 'Show order details'}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOrderOpen(ord) ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CART (Active Basket) */}
          {/* ======================================================== */}
          {activeTab === 'cart' && (
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-5 space-y-4 xl:space-y-0">
              {/* Items */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900">Your Gifting Cart</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cartTotalCount > 0
                        ? `${cartTotalCount} ${cartTotalCount === 1 ? 'item' : 'items'} ready for checkout`
                        : 'Manage items currently in your shopping cart'}
                    </p>
                  </div>
                  {cart.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Remove every item from your cart?')) handleClearCart();
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear cart
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {cart.length === 0 ? (
                    <div className="py-12 sm:py-16 text-center flex flex-col items-center">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <ShoppingBag className="w-8 h-8" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">Your Cart is Empty</h3>
                      <p className="text-xs text-slate-500 max-w-sm mb-6">Find something lovely. Every gift comes with a free handwritten note.</p>
                      <button
                        onClick={() => onNavigate('catalog')}
                        className="px-6 py-2.5 bg-[#0052FF] text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                      >
                        Shop Hampers
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-700">
                        <PenLine className="h-4 w-4 shrink-0" />
                        A handwritten note is included with every gift.
                      </p>

                      <ul className="divide-y divide-slate-100">
                        {cart.map((item) => {
                          const canOpenProduct = item.productId !== 'bespoke-hamper';
                          const openProduct = () => onNavigate(`product/${item.productId}`);
                          const details = [item.variant?.name, item.selectedHue, item.palette, ...(item.addons ?? []).map((addon) => `+ ${addon.name}`)].filter(Boolean);
                          const maxForLine = item.quantity + Math.max(0, MAX_QTY_PER_PRODUCT - getItemQuantityInCart(item.productId));
                          const delivery = [item.deliveryDate, item.deliverySlot].filter(Boolean).join(' · ');

                          return (
                            <li key={item.id} className="flex gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0">
                              <button
                                type="button"
                                onClick={openProduct}
                                disabled={!canOpenProduct}
                                tabIndex={-1}
                                aria-hidden="true"
                                className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 border border-slate-200/70"
                              >
                                <SafeImage src={item.image} alt="" className="h-full w-full object-cover" />
                              </button>

                              <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 wrap-break-word">
                                      {canOpenProduct ? (
                                        <button type="button" onClick={openProduct} className="text-left transition-colors hover:text-blue-600">
                                          {item.name}
                                        </button>
                                      ) : (
                                        item.name
                                      )}
                                    </h4>
                                    {details.length > 0 && (
                                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{details.join(' · ')}</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCartItem(item.id)}
                                    aria-label={`Remove ${item.name}`}
                                    className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>

                                {(item.customPhoto || item.message || delivery) && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {item.customPhoto && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                        <Camera className="h-3 w-3" /> Custom photo
                                      </span>
                                    )}
                                    {delivery && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        <Truck className="h-3 w-3" /> {delivery}
                                      </span>
                                    )}
                                    {item.message && (
                                      <span className="max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        “{item.message}”
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                                  <QuantityStepper
                                    size="sm"
                                    value={item.quantity}
                                    max={maxForLine}
                                    onChange={(next) => handleUpdateQuantity(item.id, next - item.quantity)}
                                    onRemove={() => handleRemoveCartItem(item.id)}
                                  />
                                  <div className="text-right">
                                    <p className="text-sm font-extrabold text-slate-900">{formatPrice(item.price * item.quantity)}</p>
                                    {item.quantity > 1 && <p className="text-[11px] text-slate-400">{formatPrice(item.price)} each</p>}
                                  </div>
                                </div>

                                {canOpenProduct && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveToWishlist(item)}
                                    className="mt-2 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-slate-500 transition hover:text-rose-600"
                                  >
                                    <Heart className="h-3.5 w-3.5" />
                                    Move to wishlist
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              {/* Order summary */}
              {cart.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 xl:sticky xl:top-4">
                  <h3 className="text-sm font-bold text-slate-900">Order summary</h3>
                  <dl className="mt-4 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Subtotal ({cartTotalCount} {cartTotalCount === 1 ? 'item' : 'items'})</dt>
                      <dd className="font-semibold text-slate-900">{formatPrice(cartSubtotal)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Delivery</dt>
                      <dd className="text-xs font-medium text-slate-500">Calculated at checkout</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs text-slate-500">Estimated total</p>
                      <p className="text-xl font-extrabold text-slate-900">{formatPrice(cartSubtotal)}</p>
                    </div>
                    <p className="text-[11px] text-slate-400">Inclusive of taxes</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('checkout')}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99]"
                  >
                    Proceed to Checkout <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('catalog')}
                    className="mt-1 w-full py-2.5 text-center text-sm font-medium text-slate-500 transition hover:text-blue-600"
                  >
                    Continue shopping
                  </button>

                  <div className="mt-2 flex items-center justify-center gap-4 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">
                    <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Secure checkout</span>
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Quality assured</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: MULTIPLE SAVED ADDRESSES (Connected to database) */}
          {/* ======================================================== */}
          {activeTab === 'address' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold leading-tight text-slate-900">Saved Addresses</h2>
                    <span className="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      {addresses.length} / 5
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Where your gifts get delivered</p>
                </div>
                {!isAddingAddress && (
                  <button 
                    onClick={() => {
                      if (addresses.length >= 5) {
                        alert("You can only save up to 5 addresses. Please remove an old address first.");
                      } else {
                        handleOpenAddAddress();
                      }
                    }}
                    className={`flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-bold text-white transition-colors px-4 py-2 rounded-xl shadow-sm ${
                      addresses.length >= 5 ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {addresses.length >= 5 ? 'Address Limit Reached (5/5)' : 'Add New Address'}
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6">
                {/* ADD / EDIT ADDRESS FORM */}
                {isAddingAddress && (
                  <div className="p-4 sm:p-6 bg-slate-50/80 border border-slate-200 rounded-2xl mb-5 sm:mb-6 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          {editingAddressId ? 'Edit Saved Address' : 'Add New Delivery Address'}
                        </h3>
                      </div>
                      <button 
                        onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveAddress} className="space-y-4">
                      {/* Label Selector: Home, Work, Other */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Address Label / Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Home', 'Work', 'Other'].map((lbl) => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => setAddressLabel(lbl)}
                              className={`w-full min-w-0 px-2 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                                addressLabel === lbl
                                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {lbl === 'Home' && <Home className="w-3.5 h-3.5" />}
                              {lbl === 'Work' && <Building2 className="w-3.5 h-3.5" />}
                              {lbl === 'Other' && <MapPin className="w-3.5 h-3.5" />}
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Recipient / Contact Name</label>
                          <input 
                            type="text" 
                            value={addressName}
                            onChange={(e) => setAddressName(e.target.value)}
                            placeholder="Full name of receiver"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Contact Phone Number</label>
                          <div className="relative">
                          <input 
                            id="profile-address-phone"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={addressPhone}
                            disabled={editingAddressPhoneLocked}
                            onChange={(e) => { setAddressPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setUnverifiedPhoneField(null); }}
                            placeholder="Number"
                            className={`${unverifiedPhoneField === 'address' ? 'border-red-500! ring-4 ring-red-500/10 ' : ''}w-full pr-28 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10`}
                            required
                          />
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                            {editingAddressPhoneLocked ? <LockedPhoneTag /> : <PhoneVerifyControl id="profile-address-phone-verify" invalid={unverifiedPhoneField === 'address'} onVerified={() => setUnverifiedPhoneField(null)} phone={addressPhone} verification={addressPhoneVerification} saveToAccount={false} />}
                          </div>
                        </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Address</label>
                        <input
                          type="text"
                          value={addressStreet}
                          onChange={(e) => setAddressStreet(e.target.value)}
                          placeholder="House no., street, landmark"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor="profile-address-area" className="text-xs font-bold text-slate-700">Delivery area</label>
                          {/* Same list as checkout (deliveryAreas.ts): we deliver only to these areas */}
                          <PickerSelect
                            id="profile-address-area"
                            title="Delivery area"
                            placeholder="Select delivery area"
                            options={DELIVERY_AREAS}
                            value={isDeliveryArea(addressCity) ? addressCity : ''}
                            onChange={setAddressCity}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Location</label>
                          <div className="relative flex items-center">
                            <input
                              type="url"
                              inputMode="url"
                              value={addressPincode}
                              onChange={(e) => {
                                setAddressPincode(e.target.value);
                                setAddressLocationError(null);
                              }}
                              // Only a Google Maps link may stay in this field: anything else is cleared when the field is left
                              onBlur={() => {
                                if (addressPincode.trim() && !isGoogleMapsLink(addressPincode)) {
                                  setAddressPincode('');
                                  setAddressLocationError('Only a Google Maps link is allowed here, so the field was cleared.');
                                }
                              }}
                              placeholder="Google Maps link (optional)"
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-medium placeholder:text-slate-500 pr-28 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.geolocation) {
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                      setAddressPincode(googleMapsLinkFor(pos.coords.latitude, pos.coords.longitude));
                                      setAddressLocationError(null);
                                    },
                                    () => setAddressLocationError('Location access denied')
                                  );
                                } else {
                                  setAddressLocationError('Not supported');
                                }
                              }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              <MapPin className="h-3 w-3" /> Fetch Live
                            </button>
                          </div>
                          {addressLocationError?.startsWith('Only a Google Maps link') && (
                            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {addressLocationError}
                            </p>
                          )}
                          {addressLocationError && !addressLocationError.startsWith('Only a Google Maps link') && (
                            <details className="mt-2 group rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 transition-all cursor-pointer shadow-sm">
                              <summary className="flex items-center justify-between text-xs font-bold list-none outline-none">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  <span>{addressLocationError}</span>
                                </div>
                                <span className="text-[10px] text-red-500 underline decoration-red-300 underline-offset-2 shrink-0 group-open:hidden">How to fix</span>
                                <span className="text-[10px] text-red-500 hidden group-open:block shrink-0">Hide</span>
                              </summary>
                              <div className="mt-3 text-[11px] leading-relaxed text-red-600 space-y-1.5 border-t border-red-200/60 pt-2.5 cursor-text">
                                <p><strong>1.</strong> Click the lock icon (🔒) next to the URL bar.</p>
                                <p><strong>2.</strong> Find the <strong>Location</strong> permission.</p>
                                <p><strong>3.</strong> Change it to <strong>Allow</strong>.</p>
                                <p><strong>4.</strong> Try fetching again.</p>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={addressIsDefault}
                          onChange={(e) => setAddressIsDefault(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <span className="text-xs font-medium text-slate-700">Set as primary / default delivery address</span>
                      </label>

                      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-4 sm:pt-3 border-t border-slate-200">
                        <button 
                          type="button"
                          onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); }}
                          className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={isLoading}
                          className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                        >
                          {isLoading ? 'Saving Address...' : 'Save Address to Database'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ADDRESSES LIST */}
                {addressesLoading ? (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    Loading saved addresses from database...
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                      <MapPin className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">No Saved Addresses Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">Add your home, work, or recipient addresses for easy 1-click gift delivery checkout.</p>
                    <button 
                      onClick={handleOpenAddAddress}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Address
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {addresses.map((addr) => {
                      const isSelected = Boolean(addr.is_default);
                      return (
                        <div 
                          key={addr.id}
                          onClick={() => {
                            if (!isSelected) handleSetDefaultAddress(addr.id);
                          }}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all relative flex flex-col justify-between cursor-pointer group select-none ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-sm' 
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`p-1.5 rounded-lg transition-colors ${
                                  isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {addr.label === 'Home' && <Home className="w-3.5 h-3.5" />}
                                  {addr.label === 'Work' && <Building2 className="w-3.5 h-3.5" />}
                                  {addr.label !== 'Home' && addr.label !== 'Work' && <MapPin className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                                  {addr.label || 'Address'}
                                </span>
                              </div>

                              {/* Interactive Selection Checkbox */}
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isSelected) handleSetDefaultAddress(addr.id);
                                }}
                                className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100/70 transition-colors"
                              >
                                <span className={`text-xs font-bold transition-colors ${
                                  isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                                }`}>
                                  {isSelected ? 'Selected' : 'Select'}
                                </span>
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all border-2 ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                    : 'bg-white border-slate-300 group-hover:border-blue-400'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            </div>

                            {/* Recipient Details */}
                            <p className="text-sm font-bold text-slate-900">{addr.name}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{addr.phone}</p>

                            {/* Address Details */}
                            <p className="text-xs text-slate-700 mt-2.5 leading-relaxed wrap-break-word">
                              {addr.address_line}
                            </p>
                            <p className="text-xs font-semibold text-slate-900 mt-1">
                              {addr.city}
                            </p>
                            {isGoogleMapsLink(addr.pincode || '') && (
                              <a
                                href={addr.pincode}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                <MapPin className="h-3 w-3" /> View on Google Maps
                              </a>
                            )}
                          </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                          <button 
                            onClick={() => handleOpenEditAddress(addr)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: WISHLIST (Connected to database wishlist table) */}
          {/* ======================================================== */}
          {activeTab === 'wishlist' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">Your Saved Wishlist</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Keepsakes and hampers saved for future gifting</p>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full shrink-0 whitespace-nowrap">
                  {wishlist.length} {wishlist.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              <div className="p-4 sm:p-6">
                {wishlistLoading ? (
                  <div className="py-16 text-center text-slate-500 text-sm">Loading wishlist from database...</div>
                ) : wishlist.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-3">
                      <Heart className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Your Wishlist is Empty</h3>
                    <p className="text-xs text-slate-500 max-w-sm mb-6">Save products you love so you can easily find and personalize them later.</p>
                    <button 
                      onClick={() => onNavigate('catalog')}
                      className="px-6 py-2.5 bg-[#0052FF] text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                    >
                      Discover Hampers
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {wishlist.map((item) => {
                      const prod = item.products || {};
                      return (
                        // Mobile: compact row (small image on the left). Tablet and up: image-on-top card.
                        <div key={item.product_id} className="p-3 sm:p-4 border border-slate-200 rounded-2xl flex sm:flex-col gap-3 bg-slate-50/50">
                          <img
                            src={prod.images?.[0] || prod.image || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=300'}
                            alt={prod.name || 'Wishlist Item'}
                            className="w-24 h-24 sm:w-full sm:h-36 shrink-0 rounded-xl object-cover"
                          />
                          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 line-clamp-2 wrap-break-word">{prod.name || `Product #${item.product_id}`}</h4>
                              <p className="text-xs font-extrabold text-blue-600 mt-1">₹{Number(prod.base_price || prod.price || 0).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2 sm:pt-3 border-t border-slate-200">
                              <button
                                onClick={() => onNavigate(`product/${item.product_id}`)}
                                className="py-1 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <span>View Gift</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveWishlist(item.product_id)}
                                className="py-1 text-xs font-semibold text-rose-600 hover:text-rose-800"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: NOTIFICATIONS (Connected to notifications table) */}
          {/* ======================================================== */}
          {orderToCancel && (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !cancellingOrder && setOrderToCancel(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-bold text-slate-900">Cancel this order?</h3>
                <p className="mt-1 text-xs text-slate-500">Order #{orderToCancel.id} will be cancelled. This cannot be undone.{orderToCancel.payment_status === 'paid' && orderToCancel.payment_method !== 'COD' ? ` Your payment of ₹${Number(orderToCancel.total_amount).toLocaleString()} will be refunded to the same account or card. We start the refund within 2 business days, and your bank usually takes 5 to 7 business days after that.` : ''}</p>
                {cancelError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{cancelError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" disabled={cancellingOrder} onClick={() => setOrderToCancel(null)} className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Keep order</button>
                  <button type="button" disabled={cancellingOrder} onClick={() => void confirmCancelOrder()} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">{cancellingOrder ? 'Cancelling…' : 'Yes, cancel order'}</button>
                </div>
              </div>
            </div>
          )}

          {viewedNotification && (() => {
            const look = NOTIFICATION_LOOK[viewedNotification.type] || NOTIFICATION_LOOK.system;
            const Icon = look.icon;
            const hasLink = Boolean(viewedNotification.link) && viewedNotification.link !== '/profile?tab=notifications';
            return (
              <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setViewedNotification(null)}>
                <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setViewedNotification(null)}
                    aria-label="Close"
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-start gap-3 pr-8">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${look.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-extrabold leading-snug text-slate-900">{viewedNotification.title}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(viewedNotification.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 empty:hidden">
                    <OrderEventArt eventKey={viewedNotification.event_key} />
                  </div>
                  {(() => {
                    const products: { product_id?: string | null; name: string; image?: string | null }[] =
                      Array.isArray(viewedNotification.data?.items) && viewedNotification.data.items.length > 0
                        ? viewedNotification.data.items
                        : viewedItems;
                    if (products.length === 0) return null;
                    return (
                      <ul className="mt-3 space-y-1.5">
                        {products.slice(0, 3).map((product, index) => (
                          <li key={`${product.product_id || product.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 object-cover" />
                            ) : (
                              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-slate-300">
                                <Package className="h-6 w-6" />
                              </span>
                            )}
                            <span className="min-w-0 truncate text-sm font-extrabold text-slate-900">{product.name}</span>
                          </li>
                        ))}
                        {products.length > 3 && <li className="px-1.5 text-[11px] font-medium text-slate-500">+{products.length - 3} more</li>}
                        {Number(viewedNotification.data?.amount) > 0 && (
                          <li className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-blue-700">Order total</span>
                            <span className="text-base font-extrabold text-blue-700">₹{Number(viewedNotification.data.amount).toLocaleString('en-IN')}</span>
                          </li>
                        )}
                      </ul>
                    );
                  })()}
                  {viewedNotification.message && (
                    <p className="mt-3.5 border-t border-slate-100 pt-3 text-[13px] font-medium leading-relaxed text-slate-700 wrap-break-word whitespace-pre-line">{viewedNotification.message}</p>
                  )}
                  {hasLink && (
                    <button
                      type="button"
                      onClick={() => { const n = viewedNotification; setViewedNotification(null); openNotification(n); }}
                      className="mt-4 w-full rounded-full bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      View order details
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {notificationToDelete && (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setNotificationToDelete(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-bold text-slate-900">Delete this notification?</h3>
                <p className="mt-1 text-xs text-slate-500">It will be removed from your notifications list.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setNotificationToDelete(null)} className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={() => { void handleRemoveNotification(notificationToDelete); setNotificationToDelete(null); }} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Yes, delete</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
                </div>
              </div>

              <div className="p-3 sm:p-5">
                {notificationsLoading ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map((key) => (
                      <div key={key} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                      <Bell className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">No Notifications Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm">Order updates, payment receipts and delivery alerts will appear here.</p>
                  </div>
                ) : (
                  <>
                  <div role="tablist" aria-label="Filter notifications" className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'orders', label: 'Orders' },
                      { id: 'others', label: 'Others' },
                    ] as { id: NotifFilter; label: string }[]).map((tab) => {
                      const count = notifications.filter((n: any) => notifMatchesFilter(n, tab.id)).length;
                      const active = notifFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setNotifFilter(tab.id)}
                          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          {tab.label}
                          <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {visibleNotifications.length === 0 && (
                    <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                      {notifFilter === 'orders' ? 'No order notifications yet.' : 'Nothing here yet.'}
                    </p>
                  )}
                  <ul className="space-y-2.5">
                    {visibleNotifications.map((notif) => {
                      const look = NOTIFICATION_LOOK[notif.type] || NOTIFICATION_LOOK.system;
                      const Icon = look.icon;
                      return (
                        <li key={notif.id} className="relative">
                          <button
                            type="button"
                            onClick={() => viewNotification(notif)}
                            className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition hover:shadow-sm ${
                              notif.is_read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/50'
                            }`}
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${look.tone}`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-slate-900" title={notif.title}>{notif.title}</span>
                                {!notif.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                              </span>
                              {(() => {
                                const products = productsOfNotification(notif);
                                const amount = Number(notif.data?.amount);
                                if (notif.order_id && products.length > 0) {
                                  const first = products[0];
                                  return (
                                    <span className="mt-1.5 flex items-center gap-2.5">
                                      {first.image ? (
                                        <img src={first.image} alt={first.name} className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 object-cover" />
                                      ) : (
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-300">
                                          <Package className="h-5 w-5" />
                                        </span>
                                      )}
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-semibold text-slate-900">{first.name}</span>
                                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                          {products.length > 1 && <span>+{products.length - 1} more</span>}
                                          {Number.isFinite(amount) && amount > 0 && (
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">₹{amount.toLocaleString('en-IN')}</span>
                                          )}
                                        </span>
                                      </span>
                                    </span>
                                  );
                                }
                                return notif.message ? (
                                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-600 wrap-break-word">{notif.message}</span>
                                ) : null;
                              })()}
                              <span className="mt-1.5 block text-[11px] text-slate-400">{timeAgo(notif.created_at)}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotificationToDelete(notif.id)}
                            aria-label="Delete notification"
                            className="absolute right-2.5 bottom-2.5 grid h-7 w-7 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: PREFERENCES (Bespoke Concierge & Account Settings) */}
          {/* ======================================================== */}
          {activeTab === 'preferences' && (
            <div className="space-y-4 sm:space-y-6">

              {/* CARD 1: Bespoke Gifting Persona & Occasions */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">Occasions You Curate Gifts For</h3>
                    <p className="text-xs text-slate-500">Select the milestones you celebrate most for tailored gift recommendations</p>
                  </div>
                </div>

                {/* Occasion Chips */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2.5">
                    Frequent Gifting Events (Click to toggle)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Birthdays', emoji: '🎂' },
                      { name: 'Anniversaries', emoji: '💍' },
                      { name: 'Festive & Diwali', emoji: '🪔' },
                      { name: 'Corporate & Client Gifting', emoji: '💼' },
                      { name: 'Weddings & Engagements', emoji: '👰' },
                      { name: 'Baby Showers & Milestones', emoji: '👶' },
                      { name: 'Romance & Valentine', emoji: '💝' },
                      { name: 'Housewarming & Gratitude', emoji: '🏡' }
                    ].map(occ => {
                      const isSelected = selectedOccasions.includes(occ.name);
                      return (
                        <button
                          key={occ.name}
                          type="button"
                          onClick={() => toggleOccasion(occ.name)}
                          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border max-w-full text-left ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{occ.emoji}</span>
                          <span>{occ.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hamper Budget Preference */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2.5">
                    Preferred Hamper Budget Range
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {[
                      'Under ₹2,500',
                      '₹2,500 - ₹5,000',
                      '₹5,000 - ₹10,000',
                      'Luxury Bespoke (₹10,000+)'
                    ].map(budget => (
                      <button
                        key={budget}
                        type="button"
                        onClick={() => setPrefBudget(budget)}
                        className={`p-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center ${
                          prefBudget === budget
                            ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {budget}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD 2: Signature Packaging & Dietary Curation */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">Signature Packaging Aesthetic</h3>
                    <p className="text-xs text-slate-500">Your default presentation style when building or ordering custom hampers</p>
                  </div>
                </div>

                {/* Packaging Selector Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'royal-box',
                      title: 'Royal Velvet Keepsake',
                      desc: 'Signature midnight navy velvet box with embossed gold lettering and wax seal.',
                      tag: 'Popular'
                    },
                    {
                      id: 'wooden-trunk',
                      title: 'Artisanal Wooden Trunk',
                      desc: 'Handcrafted seasoned pine trunk with brass clasp, designed to be repurposed.',
                      tag: 'Vintage'
                    },
                    {
                      id: 'eco-luxe',
                      title: 'Eco-Luxe Botanical',
                      desc: '100% biodegradable kraft packaging tied with cotton twine and botanical accents.',
                      tag: 'Sustainable'
                    }
                  ].map(pack => {
                    const isSelected = prefPackaging === pack.id;
                    return (
                      <div
                        key={pack.id}
                        onClick={() => setPrefPackaging(pack.id as any)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-600 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {pack.tag}
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">{pack.title}</h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pack.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dietary & Note Toggles */}
                <div className="pt-2 border-t border-slate-100 divide-y divide-slate-100">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">Complimentary Handwritten Calligraphy Note</p>
                      <p className="text-[11px] text-slate-500">Automatically prompt and include our concierge wax-sealed handwritten message card on every order</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefHandwrittenCard(!prefHandwrittenCard)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefHandwrittenCard ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          prefHandwrittenCard ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900">Strictly 100% Vegetarian / Eggless Treats</p>
                      <p className="text-[11px] text-slate-500">Filter artisan chocolates, cookies, and confectionery to only eggless and 100% vegetarian options</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefVegetarianOnly(!prefVegetarianOnly)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefVegetarianOnly ? 'bg-emerald-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          prefVegetarianOnly ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 3: Smart Concierge Alerts & Reminders */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">Concierge Reminders & Communication</h3>
                    <p className="text-xs text-slate-500">Choose how and when Nyochavar reaches you regarding milestones and deliveries</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Occasion Reminders */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Calendar className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">7-Day Milestone Reminders</p>
                        <p className="text-[11px] text-slate-500">Receive gentle advance reminders before saved birthdays & anniversaries so gifts arrive on time</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefOccasionReminders(!prefOccasionReminders)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefOccasionReminders ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefOccasionReminders ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* WhatsApp Updates */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <MessageSquare className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">WhatsApp Live Dispatch & Photo Preview</p>
                        <p className="text-[11px] text-slate-500">Receive a photo of your finalized gift hamper and live courier tracking link on WhatsApp</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefWhatsappUpdates(!prefWhatsappUpdates)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefWhatsappUpdates ? 'bg-emerald-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefWhatsappUpdates ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Email Notifications */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Mail className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">Email Order Invoices & Curations</p>
                        <p className="text-[11px] text-slate-500 wrap-break-word">Tax invoices, order receipts, and curated seasonal catalog updates sent to {displayUser.email || 'your email once you add it in Profile'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefEmailNotifications(!prefEmailNotifications)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefEmailNotifications ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefEmailNotifications ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* SMS Alerts */}
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Phone className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">SMS Out-for-Delivery Alerts</p>
                        <p className="text-[11px] text-slate-500">Instant SMS notification when the rider is approaching the recipient's address</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrefSmsAlerts(!prefSmsAlerts)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        prefSmsAlerts ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        prefSmsAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 4: Localization & Currency */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">Localization & Regional Standards</h3>
                    <p className="text-xs text-slate-500">Active regional preferences for currency, invoices, and concierge support</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200">
                    INR (₹) - Indian Rupee
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200">
                    IST (UTC+5:30) New Delhi
                  </span>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-400 font-medium">
                  Preferences are stored safely and synced to your Nyochavar concierge profile.
                </p>
                <div className="flex w-full sm:w-auto items-center gap-3 sm:shrink-0">
                  {prefSavedFeedback && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Saved!
                    </span>
                  )}
                  <button
                    onClick={handleSavePreferences}
                    disabled={prefSaving}
                    className="flex-1 sm:flex-none justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {prefSaving ? 'Saving Changes...' : 'Save All Preferences'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      <BottomNav
        wishlistCount={favorites.length}
        activeKey={activeTab === 'notifications' ? 'notification' : 'profile'}
        onOpenNotifications={() => openTabFromBottomNav('notifications')}
        onOpenProfile={() => openTabFromBottomNav('profile')}
        onHubStateChange={(isOpen) => setIsHubOpen(isOpen)}
      />

      {/* Floating Action Button (Speed Dial) for Quick Navigation */}
      {!isHubOpen && (
        <>
          {/* Dim backdrop so the menu never fights with the page content; sits above the page but leaves the bottom nav usable */}
          {isFabOpen && (
            <div
              aria-hidden="true"
              onClick={() => setIsFabOpen(false)}
              className="fixed inset-x-0 top-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 bg-slate-900/30 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
            />
          )}

          <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 sm:right-4 z-50 md:hidden flex flex-col items-end gap-2.5">
            {/* The Vertical Menu Icons (scrolls on short screens instead of running off the top) */}
            {isFabOpen && (
              <div className="flex max-h-[calc(100dvh-16rem)] flex-col items-end gap-2.5 overflow-y-auto overscroll-contain p-1 animate-in slide-in-from-bottom-5 fade-in duration-200">
                {tabs.filter(t => t.id !== 'profile').reverse().map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setFeedback(null);
                        setIsEditingProfile(false);
                        setEditingAddressId(null);
                        setIsAddingAddress(false);
                        setIsFabOpen(false);
                        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className="flex items-center gap-2.5 active:scale-95 transition-transform"
                    >
                      <span
                        className={`w-32 py-1.5 text-center text-[11px] font-bold rounded-lg shadow-sm border uppercase tracking-wide ${
                          isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-100'
                        }`}
                      >
                        {tab.label.split(' ')[0]}
                      </span>
                      <span
                        className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] border shrink-0 ${
                          isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-600'
                        }`}
                      >
                        {React.cloneElement(tab.icon as React.ReactElement, { className: 'w-[18px] h-[18px]' })}
                        {tab.badge && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border-2 border-white z-10">
                            {tab.badge}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* The Main FAB Button */}
            <button
              type="button"
              onClick={() => setIsFabOpen(!isFabOpen)}
              aria-label={isFabOpen ? 'Close quick menu' : 'Open quick menu'}
              aria-expanded={isFabOpen}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all active:scale-95 border-[3px] sm:border-4 border-white ${isFabOpen ? 'bg-slate-800' : 'bg-blue-600 shadow-blue-600/30'}`}
            >
              {isFabOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </>
      )}

      {/* Phone Verification Modal (Dual: WhatsApp Bot & Firebase SMS) */}
      <PhoneVerificationModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        initialPhone={editPhone || displayUser.phone || ''}
        onSuccess={(verifiedPhone) => {
          setEditPhone(verifiedPhone);
          editPhoneVerification.markVerified(verifiedPhone);
          setUnverifiedPhoneField(null);
          const updated: DbUser = {
            ...displayUser,
            phone: verifiedPhone,
            is_phone_verified: true,
            phone_verified_at: new Date().toISOString(),
          };
          saveStoredUser(updated);
          onUpdateUser?.(updated);
          setFeedback({ type: 'success', text: `Mobile number ${verifiedPhone} verified successfully!` });
        }}
      />

    </div>
  );
};

export default ProfilePage;