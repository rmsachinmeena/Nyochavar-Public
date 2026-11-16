import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  LayoutGrid,
  Package,
  Image as ImageIcon,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  LogOut,
  Search,
  Bell,
  HelpCircle,
  Info,
  ChevronDown,
  ShoppingBag,
  SlidersHorizontal,
  X,
  CheckCircle2,
  AlertTriangle,
  User,
  ExternalLink,
  Clock,
  ArrowRight,
  Shield,
  Key,
  RefreshCw,
  Layers,
  ShoppingBasket,
  Bike,
  Zap,
  Tag
} from 'lucide-react';
import { api } from '../services/api';
import { productService } from '../services/productService';
import { AdminMobileNav } from './AdminMobileNav';
import { BrandLogo } from '../components/layout/BrandLogo';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'inventory' | 'customer' | 'delivery';
  time: string;
  link?: string;
  read: boolean;
}

type SearchScope = 'users' | 'products' | 'tabs';

const SEARCH_SCOPES: { value: SearchScope; label: string; placeholder: string; icon: React.ReactNode }[] = [
  { value: 'users', label: 'Users', placeholder: 'Search users...', icon: <User className="w-3.5 h-3.5" /> },
  { value: 'products', label: 'Products', placeholder: 'Search products...', icon: <Package className="w-3.5 h-3.5" /> },
  { value: 'tabs', label: 'Tabs', placeholder: 'Search tabs...', icon: <Layers className="w-3.5 h-3.5" /> }
];

const SEARCHABLE_TABS = [
  { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { label: 'Orders', path: '/admin/orders', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { label: 'Delivery riders', path: '/admin/riders', icon: <Bike className="w-3.5 h-3.5" /> },
  { label: 'Products', path: '/admin/products', icon: <Package className="w-3.5 h-3.5" /> },
  { label: 'Categories', path: '/admin/categories', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { label: 'Hero banners', path: '/admin/banners', icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { label: 'Coupons', path: '/admin/coupons', icon: <Tag className="w-3.5 h-3.5" /> },
  { label: 'Automation', path: '/admin/automation', icon: <Zap className="w-3.5 h-3.5" /> },
  { label: 'Customers', path: '/admin/analytics', icon: <Activity className="w-3.5 h-3.5" /> },
  { label: 'Shopper activity', path: '/admin/events', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { label: 'Audit log', path: '/admin/audit-logs', icon: <ShieldAlert className="w-3.5 h-3.5" /> }
];

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('products');
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const scopeMenuRef = useRef<HTMLDivElement>(null);

  // Right-side dropdown states
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isImageGuideOpen, setIsImageGuideOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'all' | 'orders' | 'delivery' | 'inventory'>('all');

  const notificationsRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const imageGuideRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Dynamic Data Store for Omni-Search & Notifications
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Admin Profile from local storage
  const [adminProfile, setAdminProfile] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('petal_pen_admin_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Load live data from Supabase DB on mount
  const loadAdminStoreData = async () => {
    setIsLoadingData(true);
    try {
      const [fetchedProducts, fetchedCategories, fetchedOrdersRes, fetchedUsersRes, fetchedRidersRes, fetchedSubscribersRes] = await Promise.allSettled([
        productService.getAllProducts(),
        productService.getAllCategories(),
        api.getAllOrders(),
        api.getAllUsers(),
        api.getAllDeliveryPartners(),
        api.getNewsletterSubscribers()
      ]);

      if (fetchedProducts.status === 'fulfilled' && Array.isArray(fetchedProducts.value)) {
        setProducts(fetchedProducts.value);
      }
      if (fetchedCategories.status === 'fulfilled' && Array.isArray(fetchedCategories.value)) {
        setCategories(fetchedCategories.value);
      }
      if (fetchedOrdersRes.status === 'fulfilled' && fetchedOrdersRes.value?.orders) {
        setOrders(fetchedOrdersRes.value.orders);
      }
      if (fetchedUsersRes.status === 'fulfilled' && fetchedUsersRes.value?.users) {
        setUsers(fetchedUsersRes.value.users);
      }
      if (fetchedRidersRes.status === 'fulfilled' && Array.isArray(fetchedRidersRes.value)) {
        setRiders(fetchedRidersRes.value);
      }
      if (fetchedSubscribersRes.status === 'fulfilled' && fetchedSubscribersRes.value?.subscribers) {
        setSubscribers(fetchedSubscribersRes.value.subscribers);
      }
    } catch (err) {
      console.error('Error loading admin global data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadAdminStoreData();
  }, [location.pathname]);

  // Dynamic Notifications generated from live DB state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const list: NotificationItem[] = [];

    // A rider reported a failed / rescheduled delivery: who, which order, where, and how to reach the customer
    (orders || [])
      .filter((o: any) => o.delivery_issue)
      .sort((a: any, b: any) => String(b.delivery_issue_at || '').localeCompare(String(a.delivery_issue_at || '')))
      .forEach((o: any) => {
        const buyer = users.find((u: any) => u.id === o.buyer_id);
        const productNames = (Array.isArray(o.items) ? o.items : []).map((i: any) => i?.name).filter(Boolean).join(', ') || 'Gift order';
        const location = [o.address_line, o.city, o.pincode].filter(Boolean).join(', ') || o.delivery_address || '—';
        list.push({
          id: `notif_delivery_${o.id}_${o.delivery_issue}`,
          title: o.delivery_issue === 'failed' ? 'Delivery failed' : 'Reschedule requested',
          message: [
            `Rider: ${o.delivery_partner_name || '—'}`,
            `Order: ${productNames} (${o.order_number || o.id})`,
            `Address: ${location}`,
            `Buyer: ${buyer?.name || o.recipient_name || '—'}${buyer?.email ? ` · ${buyer.email}` : ''}`,
            `Customer no.: ${buyer?.phone || o.recipient_phone || '—'}`
          ].join('\n'),
          type: 'delivery',
          time: o.delivery_issue_at ? new Date(o.delivery_issue_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          link: '/admin/orders',
          read: false
        });
      });

    // Recent orders as notifications
    if (orders && orders.length > 0) {
      orders.slice(0, 3).forEach((o: any, idx: number) => {
        list.push({
          id: `notif_order_${o.id || idx}`,
          title: `New Order #${String(o.id).slice(-5)}`,
          message: `₹${Number(o.total_amount || o.total || 0).toLocaleString()} • ${o.delivery_address?.split('|')[0]?.trim() || 'Valued Customer'}`,
          type: 'order',
          time: o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          link: '/admin/orders',
          read: false
        });
      });
    }

    // Low stock alerts (< 10 units)
    if (products && products.length > 0) {
      products.filter((p: any) => (p.stock_quantity ?? p.stock ?? 20) <= 8).slice(0, 2).forEach((p: any) => {
        list.push({
          id: `notif_stock_${p.id}`,
          title: `Low Stock Alert`,
          message: `${p.title || p.name} has only ${p.stock_quantity ?? p.stock} units remaining.`,
          type: 'inventory',
          time: 'Stock Sync',
          link: '/admin/products',
          read: false
        });
      });
    }

    // Recent registered users
    if (users && users.length > 0) {
      users.slice(0, 2).forEach((u: any, idx: number) => {
        list.push({
          id: `notif_user_${u.id || idx}`,
          title: `New Client Registered`,
          message: `${u.name || 'Customer'}${u.email || u.phone ? ` (${u.email || u.phone})` : ''} joined Nyochavar.`,
          type: 'customer',
          time: u.created_at ? new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Active',
          link: '/admin/events',
          read: false
        });
      });
    }

    // Recent Newsletter Subscribers
    if (subscribers && subscribers.length > 0) {
      subscribers.slice(0, 3).forEach((s: any, idx: number) => {
        list.push({
          id: `notif_sub_${s.id || idx}`,
          title: `New Newsletter Subscriber 🎉`,
          message: `${s.email} joined The Nyochavar Club.`,
          type: 'customer',
          time: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          link: '/admin',
          read: false
        });
      });
    }

    setNotifications(list);
  }, [orders, products, users, subscribers]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Keyboard Shortcuts (Cmd+K / Ctrl+K for Omni-Search, Escape to dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsScopeMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsHelpOpen(false);
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Outside click handler for all 3 right side popups & search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(target)) {
        setIsScopeMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(target)) {
        setIsHelpOpen(false);
      }
      if (imageGuideRef.current && !imageGuideRef.current.contains(target)) {
        setIsImageGuideOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeScope = SEARCH_SCOPES.find((s) => s.value === searchScope)!;

  // Search only inside the scope picked in the dropdown
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Tabs are a short fixed list, so show them all before typing
    if (!q && searchScope !== 'tabs') return null;

    const matchedProducts = searchScope !== 'products' ? [] : products.filter(
      p => (p.title || p.name || '').toLowerCase().includes(q) ||
           (p.sku || '').toLowerCase().includes(q) ||
           (p.category || '').toLowerCase().includes(q)
    ).slice(0, 8);

    const matchedUsers = searchScope !== 'users' ? [] : users.filter(
      u => (u.name || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q) ||
           (u.phone || '').includes(q)
    ).slice(0, 8);

    const matchedTabs = searchScope !== 'tabs' ? [] : SEARCHABLE_TABS.filter(
      t => t.label.toLowerCase().includes(q)
    );

    return {
      products: matchedProducts,
      users: matchedUsers,
      tabs: matchedTabs,
      totalMatches: matchedProducts.length + matchedUsers.length + matchedTabs.length
    };
  }, [searchQuery, searchScope, products, users]);

  const ordersToPack = orders.filter((o: any) => o.order_status === 'placed').length;

  // Only work that needs doing earns a badge
  const navSections: {
    heading: string;
    items: { label: string; shortLabel?: string; menuLabel?: string; path: string; icon: React.ReactNode; exact?: boolean; badge?: string; external?: boolean }[];
  }[] = [
    {
      heading: 'Operations',
      items: [
        {
          label: 'Dashboard',
          shortLabel: 'Home',
          path: '/admin',
          icon: <LayoutDashboard className="w-4 h-4" />,
          exact: true
        },
        {
          label: 'Orders',
          path: '/admin/orders',
          icon: <ShoppingBag className="w-4 h-4" />,
          badge: ordersToPack > 0 ? String(ordersToPack) : undefined
        },
        {
          label: 'Delivery riders',
          shortLabel: 'Riders',
          menuLabel: 'Riders',
          path: '/admin/riders',
          icon: <Bike className="w-4 h-4" />
        }
      ]
    },
    {
      heading: 'Catalog',
      items: [
        {
          label: 'Products',
          path: '/admin/products',
          icon: <Package className="w-4 h-4" />
        },
        {
          label: 'Categories',
          path: '/admin/categories',
          icon: <LayoutGrid className="w-4 h-4" />
        },
        {
          label: 'Hero banners',
          menuLabel: 'Banners',
          path: '/admin/banners',
          icon: <ImageIcon className="w-4 h-4" />
        },
        {
          label: 'Coupons',
          path: '/admin/coupons',
          icon: <Tag className="w-4 h-4" />
        }
      ]
    },
    {
      heading: 'Settings',
      items: [
        {
          label: 'Automation',
          path: '/admin/automation',
          icon: <Zap className="w-4 h-4" />
        }
      ]
    },
    {
      heading: 'Insights',
      items: [
        {
          label: 'Customers',
          path: '/admin/analytics',
          icon: <Activity className="w-4 h-4" />
        },
        {
          label: 'Shopper activity',
          menuLabel: 'Activity',
          path: '/admin/events',
          icon: <SlidersHorizontal className="w-4 h-4" />
        },
        {
          label: 'Audit log',
          path: '/admin/audit-logs',
          icon: <ShieldAlert className="w-4 h-4" />
        }
      ]
    }
  ];

  // Revoke the session on the server first, then leave
  const handleLogout = () => {
    void api.adminLogout().finally(() => {
      window.location.href = '/admin/login';
    });
  };

  const renderNavSections = (onNavigate: () => void) => (
    <>
      {navSections.map((section) => (
        <div key={section.heading} className="space-y-1">
          <div className="px-3 pb-1 text-[11px] font-bold text-slate-400 tracking-wider">
            {section.heading}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname === item.path ||
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));

              if (item.external) {
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onNavigate}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      title={`${item.badge} waiting to be packed`}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* General Section */}
      <div className="space-y-1 pt-2 border-t border-slate-100">
        <div className="px-3 pb-1 text-[11px] font-bold text-slate-400 tracking-wider">
          General
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          onClick={onNavigate}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            <span>View storefront</span>
          </span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex h-screen bg-[#F4F6F8] text-slate-800 font-sans overflow-hidden">
      {/* Clean White Sidebar with Grouped Headings — desktop only */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/80 flex-col justify-between shrink-0 shadow-xs z-20">
        <div className="flex flex-col h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-100">
            <BrandLogo size="md" />
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 mt-2">
              <Sparkles className="w-3 h-3" /> SuperAdmin
            </span>
          </div>

          {/* Navigation Items Grouped by Headings */}
          <nav className="p-4 space-y-5 flex-1">{renderNavSections(() => {})}</nav>
        </div>
      </aside>

      {/* Main Content Stage with Top Navbar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-3 sm:px-6 flex items-center gap-2 sm:gap-4 justify-between shrink-0 z-30 relative">

          {/* Mobile brand mark — navigation lives in the bottom tab bar */}
          <div className="lg:hidden shrink-0 grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>

          {/* 🔍 Scoped Search Bar — the dropdown picks Users, Products or Tabs */}
          <div ref={searchContainerRef} className="relative min-w-0 flex-1 lg:flex-none lg:w-96 xl:w-[460px]">
            <div className="flex items-stretch rounded-xl bg-slate-50 border border-slate-200 focus-within:border-blue-600 focus-within:bg-white transition-all shadow-2xs">
              {/* Scope dropdown */}
              <div ref={scopeMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsScopeMenuOpen((o) => !o);
                    setIsSearchOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isScopeMenuOpen}
                  aria-label={`Search in: ${activeScope.label}`}
                  className="h-full flex items-center gap-1.5 pl-3 pr-2 sm:pr-2.5 rounded-l-xl border-r border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-blue-600">{activeScope.icon}</span>
                  <span className="hidden sm:inline">{activeScope.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isScopeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isScopeMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Search in"
                    className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/10 z-50 p-1.5 text-xs"
                  >
                    {SEARCH_SCOPES.map((scope) => {
                      const selected = scope.value === searchScope;
                      return (
                        <button
                          key={scope.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setSearchScope(scope.value);
                            setIsScopeMenuOpen(false);
                            setIsSearchOpen(true);
                            searchInputRef.current?.focus();
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg font-semibold transition-colors ${
                            selected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={selected ? 'text-blue-600' : 'text-slate-400'}>{scope.icon}</span>
                            {scope.label}
                          </span>
                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={activeScope.placeholder}
                  aria-label={`Search ${activeScope.label.toLowerCase()}`}
                  value={searchQuery}
                  onFocus={() => {
                    setIsSearchOpen(true);
                    setIsScopeMenuOpen(false);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  className="w-full pl-9 pr-8 sm:pr-16 py-2 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-2.5 sm:right-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
                <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-400 shadow-2xs">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </div>
            </div>

            {/* Omni-Search Live Results Dropdown */}
            {isSearchOpen && (
              <div className="fixed inset-x-3 top-[4.25rem] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-full max-h-[70vh] sm:max-h-[460px] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 z-50 p-2 text-xs">
                {searchResults && searchResults.totalMatches > 0 ? (
                  <div className="space-y-3 p-1">
                    {/* Products Results */}
                    {searchResults.products.length > 0 && (
                      <div>
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-blue-500" />
                          <span>Products ({searchResults.products.length})</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.products.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                navigate(`/admin/products?search=${encodeURIComponent(p.title || p.name)}`);
                              }}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-blue-50/60 cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {p.images?.[0] || p.image_url ? (
                                  <img
                                    src={p.images?.[0] || p.image_url}
                                    alt=""
                                    className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-100"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="truncate">
                                  <div className="font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                                    {p.title || p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    SKU: {p.sku || 'N/A'} • {p.category || 'General'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-slate-900">₹{p.price}</div>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                  Stock: {p.stock_quantity ?? p.stock ?? 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Users / Buyers Results */}
                    {searchResults.users.length > 0 && (
                      <div>
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-emerald-500" />
                          <span>Users & Buyers ({searchResults.users.length})</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.users.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setIsSearchOpen(false);
                                navigate(`/admin/events?user=${encodeURIComponent(u.id)}`);
                              }}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50/60 cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                                  {(u.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate">
                                  <div className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">
                                    {u.name || 'Valued Buyer'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                                </div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                {u.role || 'buyer'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabs Results */}
                    {searchResults.tabs.length > 0 && (
                      <div>
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-indigo-500" />
                          <span>Tabs ({searchResults.tabs.length})</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {searchResults.tabs.map((tab) => (
                            <div
                              key={tab.path}
                              onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery('');
                                navigate(tab.path);
                              }}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/60 cursor-pointer transition-colors text-slate-700 hover:text-indigo-600"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">{tab.icon}</span>
                                <span className="font-medium text-xs">{tab.label}</span>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No results found</p>
                    <p className="text-slate-400 text-[11px] mt-1">
                      No {activeScope.label.toLowerCase()} match &ldquo;{searchQuery}&rdquo;.
                    </p>
                  </div>
                ) : searchScope === 'products' ? (
                  <div className="p-4 text-slate-500">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Recent Quick Searches
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Hampers', 'Flowers', 'Diwali'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSearchQuery(tag)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[11px] transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-[11px] text-slate-400">
                    Type a name, email or phone number to find a user.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 🔔 Right Side 3 Dynamic Options */}
          <div className="flex items-center gap-3">
            
            {/* OPTION 1: 🔔 Dynamic Notifications Center */}
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsHelpOpen(false);
                  setIsImageGuideOpen(false);
                  setIsProfileMenuOpen(false);
                }}
                title="System Notifications"
                className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isNotificationsOpen
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white animate-pulse" />
                    <span className="sr-only">{unreadCount} unread notifications</span>
                  </>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotificationsOpen && (
                <div className="fixed inset-x-3 top-18 mx-auto max-w-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-none bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 z-50 p-4 font-sans text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-600 text-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Notification Tabs */}
                  <div className="flex gap-1 my-3 bg-slate-100 p-1 rounded-xl">
                    {(['all', 'orders', 'delivery', 'inventory'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveNotifTab(tab)}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${
                          activeNotifTab === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications
                      .filter(n => activeNotifTab === 'all' || n.type === activeNotifTab)
                      .map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.link) {
                              setIsNotificationsOpen(false);
                              navigate(n.link);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                            n.read
                              ? 'bg-slate-50/70 border-slate-100 text-slate-500'
                              : 'bg-blue-50/30 border-blue-100 text-slate-800 hover:bg-blue-50/70'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              n.type === 'order'
                                ? 'bg-amber-100 text-amber-700'
                                : n.type === 'delivery'
                                ? 'bg-rose-100 text-rose-700'
                                : n.type === 'inventory'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {n.type === 'order' ? (
                              <ShoppingBag className="w-4 h-4" />
                            ) : n.type === 'delivery' ? (
                              <Bike className="w-4 h-4" />
                            ) : n.type === 'inventory' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 truncate">{n.title}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {n.time}
                              </span>
                            </div>
                            <p className={`text-[11px] text-slate-600 mt-0.5 leading-relaxed ${n.type === 'delivery' ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
                              {n.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    {notifications.length === 0 && (
                      <div className="py-8 text-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                        <p className="text-xs">No notifications right now</p>
                      </div>
                    )}
                  </div>

                  {/* Footer Link */}
                  <div className="pt-3 mt-3 border-t border-slate-100 text-center">
                    <Link
                      to="/admin/orders"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
                    >
                      <span>Go to Orders Fulfillment Hub</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* OPTION 2: ❓ Dynamic Help & System Center */}
            <div ref={helpRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(!isHelpOpen);
                  setIsImageGuideOpen(false);
                  setIsNotificationsOpen(false);
                  setIsProfileMenuOpen(false);
                }}
                title="System Help & Documentation"
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isHelpOpen
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Help Flyout Modal */}
              {isHelpOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 z-50 p-5 font-sans text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">Help & shortcuts</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(false)}
                      aria-label="Close help"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Keyboard Shortcuts Cheatsheet */}
                  <div className="space-y-2 mt-3.5">
                    <p className="font-bold text-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                      Keyboard Shortcuts
                    </p>
                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Omni-Search Palette</span>
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-2xs">
                          ⌘K / Ctrl+K
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Close Modals / Overlays</span>
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-2xs">
                          Esc
                        </kbd>
                      </div>
                    </div>
                  </div>

                  {/* Quick Docs Links */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <a
                      href="/"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-blue-600"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                        <span>Preview Live Storefront</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    <Link
                      to="/admin/events"
                      onClick={() => setIsHelpOpen(false)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 hover:text-blue-600"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Shopper activity</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* ℹ️ Information Icon: Recommended Image Sizes & Dimensions Guide */}
            <div ref={imageGuideRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsImageGuideOpen(!isImageGuideOpen);
                  setIsHelpOpen(false);
                  setIsNotificationsOpen(false);
                  setIsProfileMenuOpen(false);
                }}
                title="Image Dimensions & Recommended Sizes Guide"
                aria-label="Image Dimensions and Recommended Sizes Guide"
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isImageGuideOpen
                    ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Info className="w-4 h-4" />
              </button>

              {/* Image Sizes Guide Flyout Modal */}
              {isImageGuideOpen && (
                <div className="fixed inset-x-3 top-18 mx-auto max-w-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[490px] sm:max-w-none bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/15 z-50 p-5 font-sans text-xs">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">Image Dimensions &amp; Sizes Guide</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Super Admin upload cheatsheet — avoid crop or blur</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsImageGuideOpen(false)}
                      aria-label="Close image guide"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Size Cards List */}
                  <div className="mt-3.5 space-y-2.5 max-h-[72vh] overflow-y-auto pr-1">
                    {/* Item 1: Shop by Category */}
                    <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🏷️</span>
                          <span className="font-bold text-slate-900 text-xs">Shop by Category (Category Tiles)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px] tracking-wide">
                          4:3 ya 1:1
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">Size:</span>
                        <span className="font-mono font-bold text-xs text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200/60 shadow-2xs">
                          800 × 600 px
                        </span>
                        <span className="text-[11px] text-slate-400">(ya 800 × 800 px)</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed bg-white/70 p-2 rounded-lg border border-slate-100">
                        Mobile carousel me swipe karte waqt pura bouquet/gift/hamper centered dikhta hai bina crop huye.
                      </p>
                    </div>

                    {/* Item 2: Product Cards & Detail Page (Highlighted) */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/60 via-indigo-50/40 to-white border border-blue-200 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎁</span>
                          <span className="font-bold text-slate-900 text-xs">Product Cards &amp; Detail Page (Products)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] tracking-wide">
                          ⭐ Sabse Best (1:1)
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">Size:</span>
                        <span className="font-mono font-bold text-xs text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                          1000 × 1000 px
                        </span>
                        <span className="text-[11px] text-slate-500">(min: 800 × 800 px)</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-700 leading-relaxed bg-white p-2 rounded-lg border border-blue-100">
                        Mobile swipe cards, desktop grid, aur product detail gallery teeno me zero distortion aur perfect uniform sizing milti hai.
                      </p>
                    </div>

                    {/* Item 3: Hero / Home Banners */}
                    <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🖼️</span>
                          <span className="font-bold text-slate-900 text-xs">Hero / Home Banners</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px] tracking-wide">
                          16:9 ya 21:9
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">Size:</span>
                        <span className="font-mono font-bold text-xs text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200/60 shadow-2xs">
                          1920 × 800 px
                        </span>
                        <span className="text-[11px] text-slate-400">(ya 1200 × 500 px)</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed bg-white/70 p-2 rounded-lg border border-slate-100">
                        Homepage ke top promotional banner slider ke liye edge-to-edge cinematic look deta hai.
                      </p>
                    </div>

                    {/* Pro Tips Box */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span>💡</span> Pro Tips For Best Results:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
                        <li><strong>Framing:</strong> Product canvas ke 80%–85% me center ho, chaaro taraf clear margin rakhein.</li>
                        <li><strong>Background:</strong> Pure White (#FFFFFF) ya soft light background use karein.</li>
                        <li><strong>Format &amp; Size:</strong> WebP ya compressed JPG (100KB – 250KB) fast mobile loading ke liye best hai.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OPTION 3: 👤 Dynamic Admin Profile Chip & Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                  setIsNotificationsOpen(false);
                  setIsHelpOpen(false);
                  setIsImageGuideOpen(false);
                }}
                className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 hover:opacity-80 transition-opacity cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase ring-2 ring-blue-500/20">
                  {adminProfile?.name
                    ? adminProfile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                    : 'SA'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-none">
                    {adminProfile?.name || 'Admin'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 leading-none">
                    {adminProfile?.role ? adminProfile.role.toUpperCase() : 'SUPERADMIN'}
                  </div>
                </div>
                <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 z-50 p-3 font-sans text-xs">
                  {/* Account Header */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                    <div className="font-bold text-slate-900 text-sm leading-tight">
                      {adminProfile?.name || 'Admin'}
                    </div>
                    {adminProfile?.email && (
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{adminProfile.email}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <Link
                      to="/"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                      <span>Return to Storefront</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void api.adminLogout().finally(() => {
                          window.location.href = '/admin/login';
                        });
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out of SuperAdmin</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6 pb-32 sm:pb-32 lg:pb-6 bg-[#F4F6F8] flex flex-col">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — the + button opens every section */}
      <AdminMobileNav
        sections={navSections}
        pinned={['/admin', '/admin/orders', '/admin/products', '/admin/riders']}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default AdminLayout;
