import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
  Compass,
  Heart,
  Home,
  ShoppingBag,
  User,
  Sparkles,
  X,
  Gift,
  Package,
  MapPin,
  Bell,
  Settings,
  Search,
  ChevronRight,
  Truck,
  Cake,
  Flower2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth, useCart, useUI } from '../../context';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { IMAGE_ASSETS } from '../../utils/imageAssets';

export type BottomNavKey = 'home' | 'explore' |'hub'| 'notification' | 'profile';

interface BottomNavProps {
  wishlistCount: number;
  /** Forces the highlighted tab (e.g. profile page highlights its own open tab). */
  activeKey?: string;
  /** Replace the default drawer behaviour, e.g. on pages that don't mount the storefront drawers. */
  onOpenCart?: () => void;
  onOpenWishlist?: () => void;
  onOpenProfile?: () => void;
  onOpenNotifications?: () => void;
  /** Callback fired when the Hub bottom sheet opens/closes */
  onHubStateChange?: (isOpen: boolean) => void;
}

/** Routes that already pin their own action bar to the bottom of the screen on mobile. */
const HIDDEN_ON = ['/product/', '/builder', '/checkout'];

export const shouldShowBottomNav = (pathname: string) => !HIDDEN_ON.some((prefix) => pathname.startsWith(prefix));

const routeKey = (pathname: string, search: string = ''): BottomNavKey | null => {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/catalog') || pathname.startsWith('/anniversary') || pathname.startsWith('/builder')) {
    return 'explore';
  }
  if (pathname.startsWith('/profile')) {
    const params = new URLSearchParams(search || (typeof window !== 'undefined' ? window.location.search : ''));
    if (params.get('tab') === 'notifications') return 'notification';
    return 'profile';
  }
  if (pathname.startsWith('/auth') || pathname.startsWith('/sign')) return 'profile';
  return null;
};

// Pure silent tactile vibration feedback (No sound, throttled to prevent double-buzz)
let lastHapticTimestamp = 0;
const triggerHaptic = (ms: number | number[] = 45) => {
  const now = Date.now();
  if (now - lastHapticTimestamp < 200) return; // Prevent double trigger
  lastHapticTimestamp = now;

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // Ignore if unsupported or restricted by browser
    }
  }
};

export const BottomNav: React.FC<BottomNavProps> = ({
  wishlistCount,
  activeKey,
  onOpenCart,
  onOpenWishlist,
  onOpenProfile,
  onOpenNotifications,
  onHubStateChange,
}) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { loggedInUser } = useAuth();
  const { unreadCount } = useNotificationFeed(loggedInUser?.id);
  const { cartTotalCount } = useCart();
  const {
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    isFavoritesModalOpen,
    setIsFavoritesModalOpen,
    setIsSearchModalOpen,
  } = useUI();

  const [isHubOpen, setIsHubOpen] = useState(false);
  const [showSoonPopup, setShowSoonPopup] = useState(false);
  const dragControls = useDragControls();

  // Notify parent of Hub state changes
  useEffect(() => {
    if (onHubStateChange) {
      onHubStateChange(isHubOpen);
    }
  }, [isHubOpen, onHubStateChange]);

  // Close Hub on route change
  useEffect(() => {
    setIsHubOpen(false);
  }, [pathname]);

  const current = isHubOpen
    ? 'hub'
    : activeKey
    ? (activeKey === 'notifications' ? 'notification' : (activeKey as BottomNavKey))
    : routeKey(pathname, search);

  const handleNavClick = (key: BottomNavKey, action: () => void) => {
    triggerHaptic(55);
    if (key === 'hub') {
      setIsHubOpen((prev) => !prev);
    } else {
      setIsHubOpen(false);
      action();
    }
  };

  const handleAction = (callback: () => void) => {
    triggerHaptic(55);
    setIsHubOpen(false);
    callback();
  };

  const openSearch = () => handleAction(() => setIsSearchModalOpen(true));
  const openWishlist = () => handleAction(() => (onOpenWishlist ? onOpenWishlist() : setIsFavoritesModalOpen(true)));
  const openCart = () => handleAction(() => (onOpenCart ? onOpenCart() : setIsCartDrawerOpen(true)));

  const goToProfileTab = (tab?: string) => {
    handleAction(() => {
      if (onOpenProfile) {
        onOpenProfile();
      } else {
        navigate(tab ? `/profile?tab=${tab}` : '/profile');
      }
    });
  };

  return (
    <>
      {/* ======================================================== */}
      {/* QUICK HUB SHEET - WHITE & BLUE CLEAN UI */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isHubOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                triggerHaptic(10);
                setIsHubOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Hub Sheet Content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 60 || info.velocity.y > 300) {
                  triggerHaptic(12);
                  setIsHubOpen(false);
                }
              }}
              className="relative z-10 flex max-h-[88vh] flex-col rounded-t-[32px] border-t border-slate-200 bg-white text-slate-900 shadow-[0_-20px_50px_rgba(15,23,42,0.22)]"
            >
              {/* Sheet Drag Handle (Touch & Drag here to dismiss) */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex cursor-grab justify-center pt-3 pb-1.5 touch-none active:cursor-grabbing select-none"
              >
                <span className="h-1.5 w-12 rounded-full bg-slate-300 transition-colors hover:bg-slate-400" />
              </div>

              {/* Sticky Header (Touch & Drag here to dismiss) */}
              <div
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  dragControls.start(e);
                }}
                className="sticky top-0 z-20 flex cursor-grab items-center justify-between border-b border-slate-100 bg-white px-5 py-3 touch-none select-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-brand ring-1 ring-blue-100">
                    <Sparkles className="h-4 w-4 text-brand" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900">Explore &amp; Services</h3>
                    <p className="text-[11px] text-slate-500">Quick access to all gifting features</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setIsHubOpen(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition hover:bg-red-100 active:scale-95 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Smoothly Scrollable Body with plenty of bottom clearance */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
                {/* 1. CONDITIONAL LOGIN BANNER (ONLY SHOWN IF USER IS NOT LOGGED IN) */}
                {!loggedInUser && (
                  <div className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-r from-blue-50/90 via-sky-50/40 to-indigo-50/60 p-3.5 shadow-xs">
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-md shadow-brand/25">
                          <User className="h-5 w-5" strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-[13px] font-bold tracking-tight text-slate-900">Welcome to Nyochavar</h4>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Sign in to sync gifts &amp; track orders</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAction(() => navigate('/auth'))}
                        className="shrink-0 flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-brand/30 transition hover:bg-blue-600 active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        <span>Log in</span>
                        <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. TODAY'S BEST OFFERS (3 SMALL CIRCLE OCCASIONS) */}
                <div>
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Today&apos;s Best Offers
                    </p>
                    <span className="text-[10px] font-semibold text-brand bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      Top Deals
                    </span>
                  </div>

                  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                    <img 
                      src={IMAGE_ASSETS.romanticGiftCarousel}
                      alt="Today's Best Offers"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto object-cover"
                    />
                    
                    {/* Invisible Clickable Overlays for the 3 Image Sections */}
                    <div className="absolute inset-0 flex">
                      {/* Birthday Overlay (Left 1/3) */}
                      <button
                        type="button"
                        onClick={() => handleAction(() => navigate('/catalog?occasion=Birthday'))}
                        className="flex-1 h-full active:bg-black/5 transition-colors"
                        aria-label="Birthday Offers"
                      />
                      {/* Anniversary Overlay (Middle 1/3) */}
                      <button
                        type="button"
                        onClick={() => handleAction(() => navigate('/anniversary'))}
                        className="flex-1 h-full active:bg-black/5 transition-colors"
                        aria-label="Anniversary Offers"
                      />
                      {/* Date With Her Overlay (Right 1/3) */}
                      <button
                        type="button"
                        onClick={() => handleAction(() => navigate("/catalog?occasion=Valentine's"))}
                        className="flex-1 h-full active:bg-black/5 transition-colors"
                        aria-label="Date With Her Offers"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. CUSTOM HAMPER BUILDER BANNER */}
                <button
                  type="button"
                  onClick={() => { triggerHaptic(15); setShowSoonPopup(true); }}
                  className="relative block w-full overflow-hidden rounded-2xl border border-slate-100 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <img 
                    src={IMAGE_ASSETS.hamperImage}
                    alt="Custom Hamper Builder"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover block"
                  />
                  <div className="absolute bottom-2.5 right-2.5 bg-slate-900/85 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg shadow-sm border border-white/20 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-[10px] font-bold tracking-wide uppercase">Coming Soon</span>
                  </div>
                </button>

                {/* 4. DISCOVER & SHOP OPTIONS */}
                <div>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Discover &amp; Shop
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={openSearch}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-blue-50/50 hover:border-blue-200 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-xs border border-slate-100">
                        <Search className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">Quick Search</p>
                        <p className="text-[10px] text-slate-500">By occasion / price</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAction(() => navigate('/catalog'))}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-blue-50/50 hover:border-blue-200 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-xs border border-slate-100">
                        <Compass className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">All Products</p>
                        <p className="text-[10px] text-slate-500">Browse catalogue</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={openWishlist}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-rose-50/50 hover:border-rose-200 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                        <Heart className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs font-semibold text-slate-800">Wishlist</p>
                          {wishlistCount > 0 && (
                            <span className="rounded-full bg-rose-100 px-1.5 text-[9px] font-bold text-rose-700">
                              {wishlistCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">Saved favorites</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={openCart}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-blue-50/50 hover:border-blue-200 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand border border-blue-100">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs font-semibold text-slate-800">My Cart</p>
                          {cartTotalCount > 0 && (
                            <span className="rounded-full bg-brand px-1.5 text-[9px] font-bold text-white">
                              {cartTotalCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">Ready to checkout</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 5. ACCOUNT & CONCIERGE OPTIONS - HIDDEN AS PER REQUEST */}
                {/* 
                <div>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Account &amp; Support
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => goToProfileTab('orders')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-slate-100 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">My Orders</p>
                        <p className="text-[10px] text-slate-500">Live order tracking</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => goToProfileTab('address')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-slate-100 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">Addresses</p>
                        <p className="text-[10px] text-slate-500">Saved locations</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => goToProfileTab('notifications')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-slate-100 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                        <Bell className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">Alerts</p>
                        <p className="text-[10px] text-slate-500">Updates &amp; offers</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => goToProfileTab('preferences')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-left transition hover:bg-slate-100 active:scale-98"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                        <Settings className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">Preferences</p>
                        <p className="text-[10px] text-slate-500">Packaging &amp; notes</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                  <div className="flex flex-col items-center">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="mt-1 text-[9px] font-semibold text-slate-600">2-Hr Express</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Gift className="h-3.5 w-3.5 text-rose-500" />
                    <span className="mt-1 text-[9px] font-semibold text-slate-600">Handwritten Note</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="mt-1 text-[9px] font-semibold text-slate-600">100% Safe Pay</span>
                  </div>
                </div>
                */}
              </div>

              {/* COMING SOON POPUP */}
              <AnimatePresence>
                {showSoonPopup && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                      onClick={() => setShowSoonPopup(false)}
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 10 }}
                      className="relative w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl"
                    >
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-brand">
                        <Gift className="h-7 w-7" />
                      </div>
                      <div className="text-center">
                        <h3 className="mb-1 text-lg font-bold text-slate-900">Coming Soon!</h3>
                        <p className="mb-6 text-sm text-slate-500 leading-relaxed">
                          We are working hard to bring you the best custom hamper building experience. Stay tuned!
                        </p>
                        <button
                          onClick={() => setShowSoonPopup(false)}
                          className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/25 transition-all hover:bg-blue-600 active:scale-95"
                        >
                          OK
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* ALWAYS VISIBLE COMPACT BOTTOM NAV BAR (WHITE & BLUE) */}
      {/* ======================================================== */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden pointer-events-none">
        <nav
          aria-label="Quick mobile navigation"
          className="relative flex w-full items-center justify-between px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] pointer-events-auto"
        >
          {/* TAB 1: HOME */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => handleNavClick('home', () => navigate('/'))}
            aria-current={current === 'home' ? 'page' : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center transition-colors duration-150 ${
              current === 'home' ? 'text-blue-600' : 'text-slate-700 hover:text-slate-900'
            }`}
          >

            <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
              <motion.div animate={{ y: current === 'home' ? 4 : 0 }} transition={{ duration: 0.2 }}>
                <Home className="h-[22px] w-[22px]" strokeWidth={1.75} />
              </motion.div>
              <span className={`text-[10px] leading-none ${current === 'home' ? 'font-semibold' : 'font-medium'}`}>
                Home
              </span>
            </div>
          </motion.button>

          {/* TAB 2: EXPLORE (Catalog) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => handleNavClick('explore', () => navigate('/catalog'))}
            aria-current={current === 'explore' ? 'page' : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center transition-colors duration-150 ${
              current === 'explore' ? 'text-blue-600' : 'text-slate-700 hover:text-slate-900'
            }`}
          >

            <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
              <motion.div animate={{ y: current === 'explore' ? 4 : 0 }} transition={{ duration: 0.2 }}>
                <Compass className="h-[22px] w-[22px]" strokeWidth={1.75} />
              </motion.div>
              <span className={`text-[10px] leading-none ${current === 'explore' ? 'font-semibold' : 'font-medium'}`}>
                Explore
              </span>
            </div>
          </motion.button>

          {/* TAB 3: HUB (Special Center Tab) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => handleNavClick('hub', () => {})}
            aria-current={current === 'hub' ? 'page' : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center transition-colors duration-150 ${
              current === 'hub' ? 'text-blue-600' : 'text-slate-700 hover:text-slate-900'
            }`}
          >

            
            {/* Shimmer / Pulse Dot when not active */}
            {!isHubOpen && (
              <span className="absolute top-2 right-1/4 flex h-2 w-2 z-30">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 border border-white" />
              </span>
            )}

            <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
              <motion.div animate={{ y: current === 'hub' ? 4 : 0, rotate: isHubOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                {isHubOpen ? (
                  <X className="h-[22px] w-[22px]" strokeWidth={1.75} />
                ) : (
                  <Sparkles className="h-[22px] w-[22px]" strokeWidth={1.75} />
                )}
              </motion.div>
              <span className={`text-[10px] leading-none ${current === 'hub' ? 'font-semibold' : 'font-medium'}`}>
                Services
              </span>
            </div>
          </motion.button>

          {/* TAB 4: NOTIFICATIONS */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() =>
              handleNavClick('notification', () => {
                if (onOpenNotifications) onOpenNotifications();
                else navigate('/profile?tab=notifications');
              })
            }
            aria-current={current === 'notification' ? 'page' : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center transition-colors duration-150 ${
              current === 'notification' ? 'text-blue-600' : 'text-slate-700 hover:text-slate-900'
            }`}
          >

            <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
              <motion.div className="relative" animate={{ y: current === 'notification' ? 4 : 0 }} transition={{ duration: 0.2 }}>
                <Bell className="h-[22px] w-[22px]" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.div>
              <span className={`text-[10px] leading-none ${current === 'notification' ? 'font-semibold' : 'font-medium'}`}>
                Alerts
              </span>
            </div>
          </motion.button>

          {/* TAB 5: PROFILE */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() =>
              handleNavClick('profile', () => {
                // Logged-out visitors go straight to the sign-up screen
                if (!loggedInUser) navigate('/auth?tab=signup');
                else if (onOpenProfile) onOpenProfile();
                else navigate('/profile');
              })
            }
            aria-current={current === 'profile' ? 'page' : undefined}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center transition-colors duration-150 ${
              current === 'profile' ? 'text-blue-600' : 'text-slate-700 hover:text-slate-900'
            }`}
          >

            <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
              <motion.div animate={{ y: current === 'profile' ? 4 : 0 }} transition={{ duration: 0.2 }}>
                <User className="h-[22px] w-[22px]" strokeWidth={1.75} />
              </motion.div>
              <span className={`text-[10px] leading-none ${current === 'profile' ? 'font-semibold' : 'font-medium'}`}>
                {loggedInUser ? 'Profile' : 'Log in'}
              </span>
            </div>
          </motion.button>
        </nav>
      </div>
    </>
  );
};

export default BottomNav;
