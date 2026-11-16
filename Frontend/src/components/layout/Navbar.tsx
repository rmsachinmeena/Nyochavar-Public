import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronRight, Gift, Heart, LogOut, Menu, Package, Search, ShoppingBag, User, Store } from 'lucide-react';
import type { User as DbUser } from '../../types';
import { Sheet } from '../ui/Sheet';
import { BrandLogo } from './BrandLogo';
import { HOME_OCCASIONS, getOccasionMeta, occasionHref } from '../../utils/occasionUtils';

interface NavbarProps {
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  onOpenSearch: () => void;
  loggedInUser?: DbUser | null;
  onLogout: () => void;
}

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Shop all', to: '/catalog' },
];

const isLinkActive = (to: string, pathname: string) => {
  if (to === '/') return pathname === '/';
  if (to === '/catalog') return pathname.startsWith('/catalog') || pathname.startsWith('/product/');
  return pathname.startsWith(to);
};

interface IconButtonProps {
  label: string;
  onClick: () => void;
  badge?: number;
  hideOnMobile?: boolean;
  children: React.ReactNode;
}

const IconButton: React.FC<IconButtonProps> = ({ label, onClick, badge = 0, hideOnMobile = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={badge > 0 ? `${label} (${badge})` : label}
    className={`relative h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-slate-100 ${
      hideOnMobile ? 'hidden sm:grid' : 'grid'
    }`}
  >
    {children}
    {badge > 0 && (
      <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </button>
);

const MENU_ITEM =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-ink';

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenWishlist,
  onOpenSearch,
  loggedInUser,
  onLogout,
}) => {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [occasionsOpen, setOccasionsOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const occasionsRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    setOccasionsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!occasionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!occasionsRef.current?.contains(event.target as Node)) setOccasionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOccasionsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [occasionsOpen]);

  const firstName = loggedInUser?.name?.trim().split(/\s+/)[0] || 'there';
  const initial = loggedInUser?.name?.trim().charAt(0).toUpperCase() || 'U';

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b transition-all duration-300 ease-in-out ${
          scrolled
            ? 'border-b-transparent bg-transparent py-2 sm:py-2.5'
            : 'border-slate-200/80 bg-white/95 py-0 backdrop-blur-md'
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-linear-to-b from-white via-white/85 to-white/0 transition-opacity duration-300 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`relative mx-auto transition-all duration-300 ease-in-out ${
            scrolled ? 'max-w-7xl px-3 sm:px-6 lg:px-8' : 'w-full max-w-7xl px-4 sm:px-6 lg:px-8'
          }`}
        >
          <nav
            aria-label="Main"
            className={`flex items-center justify-between gap-2 border transition-all duration-300 ease-in-out ${
              scrolled
                ? 'h-14 sm:h-16 rounded-full border-slate-200/80 bg-white/90 px-2 sm:pl-5 sm:pr-2.5 backdrop-blur-xl shadow-[0_12px_32px_-16px_rgba(15,23,42,0.28)]'
                : 'h-16 rounded-none border-transparent bg-transparent px-0 shadow-none'
            }`}
          >
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/" aria-label="Nyochavar home" className="rounded-full px-1.5 py-1">
                <BrandLogo tagline="desktop" />
              </Link>
            </div>

            <ul className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = isLinkActive(link.to, pathname);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        active ? 'bg-brand-soft text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}

              <li ref={occasionsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOccasionsOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={occasionsOpen}
                  className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    occasionsOpen || pathname.startsWith('/anniversary')
                      ? 'bg-brand-soft text-brand'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  Occasions
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${occasionsOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {occasionsOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-1/2 top-[calc(100%+12px)] w-[380px] -translate-x-1/2 origin-top rounded-2xl border border-slate-200/80 bg-white p-4 shadow-float"
                    >
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Shop by occasion
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        {HOME_OCCASIONS.map((name) => {
                          const meta = getOccasionMeta(name);
                          const Icon = meta?.icon ?? Gift;
                          return (
                            <Link
                              key={name}
                              role="menuitem"
                              to={occasionHref(name)}
                              onClick={() => setOccasionsOpen(false)}
                              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-ink"
                            >
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta?.tint ?? 'bg-slate-100'}`}>
                                <Icon className={`h-4 w-4 ${meta?.iconColor ?? 'text-slate-600'}`} />
                              </span>
                              {name}
                            </Link>
                          );
                        })}
                      </div>
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <Link
                          role="menuitem"
                          to="/builder"
                          onClick={() => setOccasionsOpen(false)}
                          className="flex items-center justify-between rounded-xl px-2.5 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-ink"
                        >
                          <span>Want something custom? Build your own hamper</span>
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            </ul>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                to="/seller"
                aria-label="Become a Seller"
                title="Become a Seller"
                className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/60 px-2.5 sm:px-3.5 text-xs sm:text-sm font-semibold text-brand transition-all hover:border-brand/40 hover:bg-brand-soft hover:shadow-xs active:scale-[0.98]"
              >
                <Store className="h-4 w-4 shrink-0 text-brand" strokeWidth={1.8} />
                <span className="hidden md:inline">Become a Seller</span>
                <span className="hidden sm:inline md:hidden">Seller</span>
              </Link>

              <IconButton label="Search" onClick={onOpenSearch}>
                <Search className="h-5 w-5" strokeWidth={1.75} />
              </IconButton>
              <IconButton label="Wishlist" onClick={onOpenWishlist} badge={wishlistCount} hideOnMobile>
                <Heart className="h-5 w-5" strokeWidth={1.75} />
              </IconButton>

              {loggedInUser ? (
                <div ref={accountRef} className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    aria-label="Account menu"
                    className="ml-0.5 grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand ring-1 ring-inset ring-blue-100 transition hover:ring-blue-200"
                  >
                    {initial}
                  </button>
                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-[calc(100%+12px)] w-64 origin-top-right rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-float"
                      >
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-semibold text-ink">{loggedInUser.name}</p>
                          <p className="truncate text-xs text-slate-500">{loggedInUser.email}</p>
                        </div>
                        <div className="my-1 h-px bg-slate-100" />
                        <Link role="menuitem" to="/profile" className={MENU_ITEM}>
                          <User className="h-4 w-4 text-slate-400" /> My account
                        </Link>
                        <Link role="menuitem" to="/profile?tab=orders" className={MENU_ITEM}>
                          <Package className="h-4 w-4 text-slate-400" /> My orders
                        </Link>
                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            onOpenWishlist();
                          }}
                          className={MENU_ITEM}
                        >
                          <Heart className="h-4 w-4 text-slate-400" /> Wishlist
                        </button>
                        <Link
                          role="menuitem"
                          to="/seller"
                          onClick={() => setAccountOpen(false)}
                          className={`${MENU_ITEM} text-brand font-medium hover:bg-brand-soft`}
                        >
                          <Store className="h-4 w-4 text-brand" /> Become a Seller ✨
                        </Link>
                        <div className="my-1 h-px bg-slate-100" />
                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            onLogout();
                          }}
                          className={`${MENU_ITEM} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}
                        >
                          <LogOut className="h-4 w-4" /> Log out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="hidden h-10 items-center rounded-full px-3.5 text-sm font-semibold text-brand transition hover:bg-brand-soft sm:inline-flex"
                >
                  Log in
                </Link>
              )}

              <button
                type="button"
                onClick={onOpenCart}
                aria-label={`Open cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
                className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-brand pl-3 pr-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md active:scale-[0.98] sm:h-11 sm:pl-4 sm:pr-4"
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="hidden sm:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold leading-none text-brand shadow-xs">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} side="left" title={<BrandLogo />}>
        <div className="flex min-h-full flex-col pb-4">
          <div className="px-5 pt-5">
            {loggedInUser ? (
              <Link to="/profile" className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-base font-bold text-white">
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">Hi, {firstName}</span>
                  <span className="block truncate text-xs text-slate-500">Your account &amp; orders</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            ) : (
              <div className="rounded-2xl bg-brand-soft p-4">
                <p className="font-serif text-lg text-ink">Welcome to Nyochavar</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Sign in to track orders and keep your favourite gifts in one place.
                </p>
                <Link
                  to="/auth"
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Log in or sign up
                </Link>
              </div>
            )}
          </div>

          <nav aria-label="Mobile" className="mt-4 px-3">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link.to, pathname);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-xl px-3 py-3.5 text-[15px] font-medium transition ${
                    active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Shop by occasion</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {HOME_OCCASIONS.map((name) => {
                const meta = getOccasionMeta(name);
                const Icon = meta?.icon ?? Gift;
                return (
                  <Link
                    key={name}
                    to={occasionHref(name)}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-2.5 py-2 text-[13px] text-ink transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${meta?.tint ?? 'bg-slate-100'}`}>
                      <Icon className={`h-3.5 w-3.5 ${meta?.iconColor ?? 'text-slate-600'}`} />
                    </span>
                    <span className="leading-tight">{name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 space-y-1 border-t border-slate-100 px-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenWishlist();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-ink transition hover:bg-slate-50"
            >
              <Heart className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
              Wishlist
              {wishlistCount > 0 && (
                <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                  {wishlistCount}
                </span>
              )}
            </button>
            {loggedInUser && (
              <Link
                to="/profile?tab=orders"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-ink transition hover:bg-slate-50"
              >
                <Package className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
                My orders
              </Link>
            )}
            <Link
              to="/builder"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-ink transition hover:bg-slate-50"
            >
              <Gift className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
              Build a custom hamper
            </Link>
            <Link
              to="/seller"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-brand-soft/70 px-3 py-3 text-[15px] font-semibold text-brand transition hover:bg-brand-soft"
            >
              <Store className="h-5 w-5 text-brand" strokeWidth={1.75} />
              Become a Seller ✨
            </Link>
          </div>

          <div className="mt-auto px-5 pt-6">
            {loggedInUser ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            ) : (
              <p className="text-xs text-slate-500">Same-day delivery · Free handwritten note with every gift</p>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
};
