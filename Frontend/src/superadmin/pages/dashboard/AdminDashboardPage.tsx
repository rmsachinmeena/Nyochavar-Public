import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  IndianRupee,
  ShoppingBag,
  Receipt,
  Users,
  Package,
  PackageX,
  Bike,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Activity,
  Sparkles,
  ShoppingCart,
  Eye,
  CreditCard,
  Heart,
  Tag,
  MousePointerClick,
  MinusCircle,
  Trash2
} from 'lucide-react';
import { eventTracker, UserSummaryData, UserEventItem } from '../../../services/eventTracker';
import { productService } from '../../../services/productService';
import { Product } from '../../../types/product';
import { api } from '../../../services/api';
import {
  Badge,
  BarList,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  ColumnChart,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterTabs,
  IconButton,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  Toast,
  Tone,
  cx,
  useRowSelection
} from '../../components/ui';
import type { ColumnDatum, DataColumn } from '../../components/ui';

type TabId = 'overview' | 'user_details' | 'events';
type PeriodId = '7d' | '30d' | '90d' | 'all';

interface AdminDashboardProps {
  defaultTab?: TabId;
}

interface DashOrder {
  id: string;
  created_at: string;
  total_amount: number;
  order_status: string;
  payment_status?: string;
  delivery_address?: string;
  delivery_partner_name?: string;
  items?: any[];
}

interface Bucket {
  key: string;
  label: string;
  fullLabel: string;
  start: number;
  end: number;
}

const PERIODS: { id: PeriodId; label: string; phrase: string }[] = [
  { id: '7d', label: '7 days', phrase: 'the last 7 days' },
  { id: '30d', label: '30 days', phrase: 'the last 30 days' },
  { id: '90d', label: '90 days', phrase: 'the last 90 days' },
  { id: 'all', label: 'All time', phrase: 'all time' }
];

const LOW_STOCK = 10;

const STATUS_TONES: Record<string, Tone> = {
  awaiting_payment: 'neutral',
  placed: 'info',
  processing: 'warning',
  out_for_delivery: 'violet',
  delivered: 'success',
  cancelled: 'danger'
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  placed: 'Placed',
  processing: 'Hand-finishing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const INTENT_TONES: Record<string, Tone> = { High: 'violet', Medium: 'info', Low: 'neutral' };

const inr = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const inrTick = (value: number) => {
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${+(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const shortDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const timeAgo = (iso?: string | null) => {
  if (!iso) return 'Never';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const dayHeading = (iso: string) => {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const buildBuckets = (period: PeriodId, orders: DashOrder[], now: Date): Bucket[] => {
  const today = startOfDay(now);

  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1 - i));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return {
        key: start.toISOString(),
        label: period === '7d' ? start.toLocaleDateString('en-IN', { weekday: 'short' }) : shortDate(start),
        fullLabel: start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        start: start.getTime(),
        end: end.getTime()
      };
    });
  }

  if (period === '90d') {
    const weeks = 13;
    return Array.from({ length: weeks }, (_, i) => {
      const end = new Date(today);
      end.setDate(today.getDate() + 1 - (weeks - 1 - i) * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 7);
      return {
        key: start.toISOString(),
        label: shortDate(start),
        fullLabel: `Week of ${shortDate(start)}`,
        start: start.getTime(),
        end: end.getTime()
      };
    });
  }

  const earliest = orders.reduce((min, o) => Math.min(min, new Date(o.created_at).getTime()), now.getTime());
  const firstMonth = new Date(new Date(earliest).getFullYear(), new Date(earliest).getMonth(), 1);
  const sixMonthsBack = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const cursor = firstMonth < sixMonthsBack ? firstMonth : sixMonthsBack;
  const buckets: Bucket[] = [];
  while (cursor <= today) {
    const start = new Date(cursor);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({
      key: start.toISOString(),
      label: start.toLocaleDateString('en-IN', { month: 'short' }),
      fullLabel: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      start: start.getTime(),
      end: end.getTime()
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
};

const deltaBadge = (current: number, previous: number) => {
  if (previous <= 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <Badge tone="neutral">0%</Badge>;
  return (
    <Badge tone={pct > 0 ? 'success' : 'danger'}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </Badge>
  );
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  page_view: <MousePointerClick className="h-3.5 w-3.5" />,
  product_view: <Eye className="h-3.5 w-3.5" />,
  search: <Search className="h-3.5 w-3.5" />,
  add_to_cart: <ShoppingCart className="h-3.5 w-3.5" />,
  remove_from_cart: <MinusCircle className="h-3.5 w-3.5" />,
  wishlist_add: <Heart className="h-3.5 w-3.5" />,
  checkout_start: <CreditCard className="h-3.5 w-3.5" />,
  purchase: <CheckCircle2 className="h-3.5 w-3.5" />,
  coupon_applied: <Tag className="h-3.5 w-3.5" />
};

const describeEvent = (event: UserEventItem): string => {
  const m = event.metadata || {};
  const product = m.product_name || 'an item';
  switch (event.event_type) {
    case 'page_view':
      return `Visited ${m.page || m.url || 'a page'}`;
    case 'product_view':
      return `Viewed ${product}`;
    case 'search':
      return `Searched “${m.query ?? ''}”${m.results_count != null ? ` · ${m.results_count} results` : ''}`;
    case 'add_to_cart':
      return `Added ${Number(m.quantity) > 1 ? `${m.quantity} × ` : ''}${product} to cart`;
    case 'remove_from_cart':
      return `Removed ${product} from cart`;
    case 'wishlist_add':
      return `Saved ${product} to wishlist`;
    case 'checkout_start':
      return `Started checkout${m.item_count ? ` · ${m.item_count} items` : ''}${m.total_amount ? ` · ${inr(m.total_amount)}` : ''}`;
    case 'purchase':
      return `Placed order${m.order_id ? ` #${String(m.order_id).toUpperCase()}` : ''}${m.total_amount ? ` · ${inr(m.total_amount)}` : ''}`;
    case 'coupon_applied':
      return `Applied coupon ${m.coupon_code ?? ''}`.trim();
    default: {
      const text = String(event.event_type).replace(/_/g, ' ');
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const adminFirstName = () => {
  try {
    const raw = localStorage.getItem('petal_pen_admin_profile');
    const name: string | undefined = raw ? JSON.parse(raw)?.name : undefined;
    return name?.trim().split(/\s+/)[0] ?? '';
  } catch {
    return '';
  }
};

export const AdminDashboardPage: React.FC<AdminDashboardProps> = ({ defaultTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [period, setPeriod] = useState<PeriodId>('30d');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DashOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [accountCounts, setAccountCounts] = useState({ all: 0, today: 0, last7days: 0 });
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [users, setUsers] = useState<UserSummaryData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [intentFilter, setIntentFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSummary, setUserSummary] = useState<UserSummaryData | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<UserEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  /** Customers or activity events waiting for delete confirmation (one from a trash button, or a multi-selection) */
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'customers' | 'events'; ids: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);

  const showToast = (message: string, tone: 'success' | 'danger' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const loadAll = () => {
    setLoadingAccounts(true);
    eventTracker
      .fetchAccountCounts()
      .then(setAccountCounts)
      .catch(() => undefined)
      .finally(() => setLoadingAccounts(false));

    productService.getAllProducts().then(setProducts).catch(() => undefined);

    setLoadingUsers(true);
    eventTracker
      .fetchUsersSummary({ limit: 100 })
      .then((res) => {
        const list = res.users || [];
        setUsers(list);
        setSelectedUserId((current) => current || list[0]?.user_id || '');
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingUsers(false));

    setLoadingOrders(true);
    api
      .getAllOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err) => console.warn('Could not load orders:', err))
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingEvents(true);
    Promise.all([
      eventTracker.fetchUserSummary(selectedUserId),
      eventTracker.fetchUserTimeline(selectedUserId, { limit: 25, order: 'desc' })
    ])
      .then(([sumRes, timeRes]) => {
        if (sumRes.success) setUserSummary(sumRes.summary);
        if (timeRes.success) setTimelineEvents(timeRes.events || []);
      })
      .finally(() => setLoadingEvents(false));
  }, [selectedUserId]);

  /* ---------------------------- Overview data ---------------------------- */

  // Sales count real orders only: not cancelled ones, nor online checkouts still waiting for payment
  const liveOrders = useMemo(
    () => orders.filter((o) => o.order_status !== 'cancelled' && o.order_status !== 'awaiting_payment'),
    [orders]
  );

  const buckets = useMemo(() => buildBuckets(period, liveOrders, new Date()), [period, liveOrders]);
  const periodStart = period === 'all' ? 0 : buckets[0]?.start ?? 0;
  const periodLength = Date.now() - periodStart;

  const periodOrders = useMemo(
    () => liveOrders.filter((o) => new Date(o.created_at).getTime() >= periodStart),
    [liveOrders, periodStart]
  );

  const previousOrders = useMemo(() => {
    if (period === 'all') return [];
    const prevStart = periodStart - periodLength;
    return liveOrders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= prevStart && t < periodStart;
    });
  }, [liveOrders, period, periodStart, periodLength]);

  const sum = (list: DashOrder[]) => list.reduce((total, o) => total + Number(o.total_amount || 0), 0);
  const sales = sum(periodOrders);
  const previousSales = sum(previousOrders);
  const averageOrder = periodOrders.length > 0 ? sales / periodOrders.length : 0;
  const periodPhrase = PERIODS.find((p) => p.id === period)?.phrase ?? '';

  const chartData: ColumnDatum[] = useMemo(
    () =>
      buckets.map((bucket) => {
        const inBucket = liveOrders.filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= bucket.start && t < bucket.end;
        });
        return {
          key: bucket.key,
          label: bucket.label,
          fullLabel: bucket.fullLabel,
          value: Math.round(sum(inBucket) * 100) / 100,
          detail: `${inBucket.length} ${inBucket.length === 1 ? 'order' : 'orders'}`
        };
      }),
    [buckets, liveOrders]
  );

  const bestSellers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; image?: string; units: number; revenue: number }>();
    periodOrders.forEach((order) =>
      (Array.isArray(order.items) ? order.items : []).forEach((item: any) => {
        if (!item || item.__delivery_meta) return;
        const name = String(item.name || 'Gift');
        const key = name.toLowerCase();
        const qty = Number(item.quantity) || 1;
        const entry = map.get(key) ?? { key, name, image: item.image, units: 0, revenue: 0 };
        entry.units += qty;
        entry.revenue += (Number(item.price) || 0) * qty;
        map.set(key, entry);
      })
    );
    return [...map.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5);
  }, [periodOrders]);

  const recentOrders = useMemo(
    () =>
      [...periodOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [periodOrders]
  );

  const attention = useMemo(() => {
    const toPack = orders.filter((o) => o.order_status === 'placed').length;
    const needRider = orders.filter(
      (o) => (o.order_status === 'placed' || o.order_status === 'processing') && !o.delivery_partner_name
    ).length;
    const liveProducts = products.filter((p) => p.is_active !== false && typeof p.stock === 'number');
    const outOfStock = liveProducts.filter((p) => (p.stock ?? 0) <= 0).length;
    const lowStock = liveProducts.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < LOW_STOCK).length;
    return [
      { key: 'pack', count: toPack, label: toPack === 1 ? 'order to pack' : 'orders to pack', to: '/admin/orders', tone: 'warning' as Tone, icon: <Package className="h-4 w-4" /> },
      { key: 'rider', count: needRider, label: needRider === 1 ? 'order needs a rider' : 'orders need a rider', to: '/admin/orders', tone: 'violet' as Tone, icon: <Bike className="h-4 w-4" /> },
      { key: 'low', count: lowStock, label: lowStock === 1 ? 'product low on stock' : 'products low on stock', to: '/admin/products', tone: 'warning' as Tone, icon: <AlertTriangle className="h-4 w-4" /> },
      { key: 'out', count: outOfStock, label: outOfStock === 1 ? 'product sold out' : 'products sold out', to: '/admin/products', tone: 'danger' as Tone, icon: <PackageX className="h-4 w-4" /> }
    ].filter((item) => item.count > 0);
  }, [orders, products]);

  /* ---------------------------- Customer data ---------------------------- */

  const customerStats = useMemo(() => {
    const active = users.filter((u) => u.total_events > 0).length;
    const highIntent = users.filter((u) => u.intent_level === 'High').length;
    const unfinishedCarts = users.filter((u) => u.cart_adds > 0 && u.purchases === 0).length;
    const totals = users.reduce(
      (acc, u) => ({
        views: acc.views + (u.product_views || 0),
        carts: acc.carts + (u.cart_adds || 0),
        checkouts: acc.checkouts + (u.checkout_starts || 0),
        purchases: acc.purchases + (u.purchases || 0)
      }),
      { views: 0, carts: 0, checkouts: 0, purchases: 0 }
    );
    return { active, highIntent, unfinishedCarts, totals };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.user_id?.toLowerCase().includes(q);
      const matchesIntent = intentFilter === 'all' || u.intent_level === intentFilter;
      return matchesSearch && matchesIntent;
    });
  }, [users, userSearchTerm, intentFilter]);

  const openJourney = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('events');
  };

  /* ------------------------------ Delete ------------------------------ */

  // Multi-select: customers in the list (current filter) and events in the open timeline
  const customerSelection = useRowSelection(filteredUsers.map((u) => u.user_id));
  const eventSelection = useRowSelection(timelineEvents.map((e) => e.id));
  const allEventsSelected = timelineEvents.length > 0 && timelineEvents.every((e) => eventSelection.selected.has(e.id));
  const toggleEventSelected = (id: string, checked: boolean) =>
    eventSelection.setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    const { kind, ids } = pendingDelete;
    setPendingDelete(null);
    setDeleting(true);
    try {
      const removed = new Set(ids);
      if (kind === 'customers') {
        const { deleted } = await api.bulkDelete('user', ids);
        const remaining = users.filter((u) => !removed.has(u.user_id));
        setUsers(remaining);
        setAccountCounts((prev) => ({ ...prev, all: Math.max(0, prev.all - deleted) }));
        if (removed.has(selectedUserId)) {
          setSelectedUserId(remaining[0]?.user_id || '');
          setUserSummary(null);
          setTimelineEvents([]);
        }
        customerSelection.clear();
        showToast(`${deleted} ${deleted === 1 ? 'customer' : 'customers'} deleted`);
      } else {
        const { deleted } = await api.bulkDelete('events', ids);
        setTimelineEvents((prev) => prev.filter((e) => !removed.has(e.id)));
        eventSelection.clear();
        // The journey counts come from these events, so reload them
        if (selectedUserId) {
          eventTracker
            .fetchUserSummary(selectedUserId)
            .then((res) => res.success && setUserSummary(res.summary))
            .catch(() => undefined);
        }
        showToast(`${deleted} activity ${deleted === 1 ? 'event' : 'events'} deleted`);
      }
    } catch (err: any) {
      showToast(err.message || 'Delete failed. Please try again.', 'danger');
    } finally {
      setDeleting(false);
    }
  };

  /* ------------------------------ Columns ------------------------------ */

  const orderColumns: DataColumn<DashOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      mobile: 'title',
      className: 'whitespace-nowrap',
      cell: (o) => (
        <div>
          <p className="font-semibold uppercase text-slate-900">#{o.id}</p>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            {new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )
    },
    {
      key: 'amount-mobile',
      header: 'Amount',
      mobile: 'aside',
      only: 'card',
      cell: (o) => <span className="text-[15px] font-bold text-slate-900">{inr(o.total_amount)}</span>
    },
    {
      key: 'customer',
      header: 'Customer',
      mobile: 'subtitle',
      cell: (o, layout) => {
        const firstItem = Array.isArray(o.items) ? o.items.find((i: any) => i && !i.__delivery_meta) : null;
        return (
          <div className={cx('min-w-0', layout === 'table' && 'max-w-[280px]')}>
            <p className="truncate font-medium text-slate-800">
              {o.delivery_address?.split('|')?.[0]?.trim() || 'Customer'}
            </p>
            {firstItem?.name && <p className="mt-0.5 truncate text-xs text-slate-500">{firstItem.name}</p>}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      // Sits under the amount on phones instead of a near-empty footer row
      mobile: 'aside',
      cell: (o) => <Badge tone={STATUS_TONES[o.order_status] ?? 'neutral'}>{STATUS_LABELS[o.order_status] ?? o.order_status}</Badge>
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (o) => <span className="font-semibold tabular-nums text-slate-900">{inr(o.total_amount)}</span>
    }
  ];

  const userColumns: DataColumn<UserSummaryData>[] = [
    {
      key: 'customer',
      header: 'Customer',
      mobile: 'title',
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cx(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ring-2 ring-white',
              u.intent_level === 'High'
                ? 'bg-violet-100 text-violet-700'
                : u.intent_level === 'Medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-50 text-blue-700'
            )}
          >
            {(u.name || u.email || 'U').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{u.name || 'Unnamed customer'}</p>
            <p className="mt-0.5 truncate text-xs font-normal text-slate-500">{u.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'intent',
      header: 'Buying intent',
      mobile: 'aside',
      cell: (u, layout) => (
        <div className="space-y-1">
          <Badge tone={INTENT_TONES[u.intent_level] ?? 'neutral'}>{u.intent_level || 'Low'}</Badge>
          {layout === 'table' && u.persona && <p className="text-xs text-slate-500">{u.persona}</p>}
        </div>
      )
    },
    {
      // Phones: one compact strip instead of three loose label/value pairs
      key: 'stats-mobile',
      header: 'Summary',
      mobile: 'block',
      only: 'card',
      cell: (u) => (
        <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-2 text-center">
          {[
            {
              label: 'Joined',
              value: u.registered_at
                ? new Date(u.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '—',
              muted: !u.registered_at
            },
            { label: 'Last active', value: timeAgo(u.last_active), muted: !u.last_active },
            { label: 'Orders', value: String(u.purchases || 0), muted: !u.purchases }
          ].map((s) => (
            <div key={s.label} className="min-w-0 px-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</dt>
              <dd className={cx('mt-0.5 truncate text-[13px] font-semibold tabular-nums', s.muted ? 'text-slate-400' : 'text-slate-800')}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )
    },
    {
      key: 'joined',
      header: 'Joined',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (u) =>
        u.registered_at ? (
          new Date(u.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        ) : (
          <span className="text-slate-400">—</span>
        )
    },
    {
      key: 'active',
      header: 'Last active',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (u) => <span className={u.last_active ? '' : 'text-slate-400'}>{timeAgo(u.last_active)}</span>
    },
    {
      key: 'purchases',
      header: 'Orders',
      align: 'center',
      only: 'table',
      cell: (u) => <span className="font-semibold tabular-nums text-slate-900">{u.purchases || 0}</span>
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobile: 'footer',
      mobileClassName: 'flex-1',
      cell: (u, layout) =>
        layout === 'table' ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => openJourney(u.user_id)} icon={<Activity className="h-3.5 w-3.5" />}>
              View activity
            </Button>
            <IconButton
              label={`Delete ${u.name || u.email || 'customer'}`}
              tone="danger"
              disabled={deleting}
              onClick={() => setPendingDelete({ kind: 'customers', ids: [u.user_id] })}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openJourney(u.user_id)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg text-left text-xs font-semibold text-blue-600 active:text-blue-800"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">View activity</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
            <IconButton
              label={`Delete ${u.name || u.email || 'customer'}`}
              tone="danger"
              disabled={deleting}
              onClick={() => setPendingDelete({ kind: 'customers', ids: [u.user_id] })}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        )
    }
  ];

  const selectedIndex = users.findIndex((u) => u.user_id === selectedUserId);

  const journeySteps = userSummary
    ? [
        { label: 'Viewed', value: userSummary.product_views, icon: <Eye className="h-4 w-4" /> },
        { label: 'Carted', value: userSummary.cart_adds, icon: <ShoppingCart className="h-4 w-4" /> },
        { label: 'Checkout', value: userSummary.checkout_starts, icon: <CreditCard className="h-4 w-4" /> },
        { label: 'Ordered', value: userSummary.purchases, icon: <CheckCircle2 className="h-4 w-4" /> }
      ]
    : [];
  // Furthest step with any activity, e.g. an order counts even without a tracked view
  const journeyReached = journeySteps.reduce((reached, step, i) => (step.value > 0 ? i + 1 : reached), 0);

  const firstName = adminFirstName();
  const funnel = customerStats.totals;
  const pctOfViews = (value: number) => (funnel.views > 0 ? `${Math.round((value / funnel.views) * 100)}% of product views` : undefined);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        inlineActions
        actions={
          <IconButton
            label="Refresh dashboard"
            onClick={loadAll}
            disabled={loadingOrders}
            className="border-slate-200 bg-white"
          >
            <RefreshCw className={cx('h-4 w-4', loadingOrders && 'animate-spin')} />
          </IconButton>
        }
      />

      <FilterTabs
        value={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'user_details', label: 'Customers', count: accountCounts.all || undefined },
          { id: 'events', label: 'Shopper activity' }
        ]}
      />

      {/* ============================== OVERVIEW ============================== */}
      {activeTab === 'overview' && (
        <>
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Needs your attention</h2>
            {loadingOrders && orders.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">Checking orders and stock…</p>
            ) : attention.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-600">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                You're all caught up. No orders waiting and stock looks healthy.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span
                        className={cx(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                          item.tone === 'danger' && 'bg-rose-50 text-rose-600',
                          item.tone === 'warning' && 'bg-amber-50 text-amber-600',
                          item.tone === 'violet' && 'bg-violet-50 text-violet-600'
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold leading-none text-slate-900">{item.count}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{item.label}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Period</span>
            <FilterTabs className="min-w-0" value={period} onChange={(id) => setPeriod(id as PeriodId)} items={PERIODS.map(({ id, label }) => ({ id, label }))} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Sales"
              value={loadingOrders && orders.length === 0 ? '—' : inr(sales)}
              icon={<IndianRupee className="h-3.5 w-3.5" />}
              badge={deltaBadge(sales, previousSales)}
              hint={period === 'all' ? 'All non-cancelled orders' : previousSales > 0 ? `vs previous ${PERIODS.find((p) => p.id === period)?.label}` : `In ${periodPhrase}`}
            />
            <StatCard
              label="Orders"
              value={loadingOrders && orders.length === 0 ? '—' : periodOrders.length}
              icon={<ShoppingBag className="h-3.5 w-3.5" />}
              badge={deltaBadge(periodOrders.length, previousOrders.length)}
              hint={`${periodOrders.filter((o) => o.order_status === 'delivered').length} delivered`}
            />
            <StatCard
              label="Average order"
              value={periodOrders.length > 0 ? inr(Math.round(averageOrder)) : '—'}
              tone="neutral"
              icon={<Receipt className="h-3.5 w-3.5" />}
              hint={`Per order in ${periodPhrase}`}
            />
            <StatCard
              label="Customers"
              value={loadingAccounts ? '—' : accountCounts.all}
              tone="neutral"
              icon={<Users className="h-3.5 w-3.5" />}
              hint={`All time · +${accountCounts.last7days} this week`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="p-4 sm:p-5 lg:col-span-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Sales</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {period === '90d' ? 'Weekly' : period === 'all' ? 'Monthly' : 'Daily'} order value, cancelled orders excluded
                  </p>
                </div>
                <p className="shrink-0 text-right text-lg font-bold text-slate-900">{inr(sales)}</p>
              </div>
              <div className="mt-6">
                {liveOrders.length === 0 && !loadingOrders ? (
                  <EmptyState icon={<IndianRupee className="h-6 w-6" />} title="No sales yet" description="Your sales chart fills in as orders arrive." />
                ) : (
                  <ColumnChart
                    data={chartData}
                    formatValue={inr}
                    formatTick={inrTick}
                    ariaLabel={`Sales over ${periodPhrase}`}
                    labelEvery={period === '30d' ? 5 : period === '90d' ? 2 : 1}
                    dimmed={loadingOrders}
                  />
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-5 lg:col-span-4">
              <h2 className="text-sm font-semibold text-slate-900">Best sellers</h2>
              <p className="mt-0.5 text-xs text-slate-500">Units sold in {periodPhrase}</p>
              <div className="mt-5">
                {bestSellers.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No items sold in this period.</p>
                ) : (
                  <BarList
                    dimmed={loadingOrders}
                    items={bestSellers.map((item) => ({
                      key: item.key,
                      label: item.name,
                      value: item.units,
                      display: `${item.units} sold`,
                      sublabel: `${inr(item.revenue)} in sales`,
                      leading: item.image ? (
                        <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                          <Package className="h-4 w-4" />
                        </span>
                      )
                    }))}
                  />
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
                <p className="mt-0.5 text-xs text-slate-500">Latest orders in {periodPhrase}</p>
              </div>
              <Link to="/admin/orders" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                All orders <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <DataTable
              columns={orderColumns}
              rows={recentOrders}
              rowKey={(o) => o.id}
              loading={loadingOrders && orders.length === 0}
              loadingLabel="Loading orders…"
              empty={
                <EmptyState
                  icon={<ShoppingBag className="h-6 w-6" />}
                  title="No orders in this period"
                  description="Try a longer time range above."
                />
              }
            />
          </Card>
        </>
      )}

      {/* ============================== CUSTOMERS ============================== */}
      {activeTab === 'user_details' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Customers"
              value={loadingAccounts ? '—' : accountCounts.all}
              icon={<Users className="h-3.5 w-3.5" />}
              hint={`+${accountCounts.today} today · +${accountCounts.last7days} this week`}
            />
            <StatCard
              label="Active shoppers"
              value={loadingUsers ? '—' : customerStats.active}
              tone="success"
              icon={<Activity className="h-3.5 w-3.5" />}
              hint="Have browsed the store"
            />
            <StatCard
              label="High buying intent"
              value={loadingUsers ? '—' : customerStats.highIntent}
              tone="violet"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              hint="Likely to buy soon"
            />
            <StatCard
              label="Unfinished carts"
              value={loadingUsers ? '—' : customerStats.unfinishedCarts}
              tone="warning"
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              hint="Added to cart, not bought yet"
            />
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Shopping funnel</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              How far shoppers get, across {users.length} tracked {users.length === 1 ? 'customer' : 'customers'}
            </p>
            <div className="mt-4 max-w-2xl">
              {funnel.views === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                    <ShoppingCart className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-700">No shopping activity yet</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      Views, carts and checkouts show up here once customers browse the store.
                    </p>
                  </div>
                </div>
              ) : (
                <BarList
                  max={funnel.views}
                  items={[
                    { key: 'views', label: 'Viewed a product', value: funnel.views, display: funnel.views.toLocaleString('en-IN') },
                    { key: 'carts', label: 'Added to cart', value: funnel.carts, display: funnel.carts.toLocaleString('en-IN'), sublabel: pctOfViews(funnel.carts) },
                    { key: 'checkouts', label: 'Started checkout', value: funnel.checkouts, display: funnel.checkouts.toLocaleString('en-IN'), sublabel: pctOfViews(funnel.checkouts) },
                    { key: 'purchases', label: 'Placed an order', value: funnel.purchases, display: funnel.purchases.toLocaleString('en-IN'), sublabel: pctOfViews(funnel.purchases) }
                  ]}
                />
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="space-y-3 border-b border-slate-100 p-3 sm:p-5">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-sm font-semibold text-slate-900">Customer list</h2>
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                  {filteredUsers.length} of {users.length}
                </span>
              </div>
              <FilterTabs
                value={intentFilter}
                onChange={(id) => setIntentFilter(id as typeof intentFilter)}
                items={[
                  { id: 'all', label: 'All customers', count: users.length },
                  { id: 'High', label: 'High intent', count: users.filter((u) => u.intent_level === 'High').length },
                  { id: 'Medium', label: 'Medium', count: users.filter((u) => u.intent_level === 'Medium').length },
                  { id: 'Low', label: 'Low', count: users.filter((u) => u.intent_level === 'Low').length }
                ]}
              />
              <SearchInput
                value={userSearchTerm}
                onChange={setUserSearchTerm}
                placeholder="Search name or email…"
                icon={<Search className="h-3.5 w-3.5" />}
                className="sm:max-w-sm"
              />
            </div>
            <DataTable
              columns={userColumns}
              rows={filteredUsers}
              rowKey={(u) => u.user_id}
              selectedKeys={customerSelection.selected}
              onSelectionChange={customerSelection.setSelected}
              selectLabel={(u) => u.name || u.email || 'customer'}
              loading={loadingUsers && users.length === 0}
              loadingLabel="Loading customers…"
              empty={
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title={userSearchTerm || intentFilter !== 'all' ? 'No matching customers' : 'No customers yet'}
                  description={userSearchTerm || intentFilter !== 'all' ? 'Try a different search or filter.' : 'Customers appear here after they sign up.'}
                />
              }
            />
          </Card>
        </>
      )}

      {/* ============================ SHOPPER ACTIVITY ============================ */}
      {activeTab === 'events' && (
        <>
          {/* Customer profile + switcher */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-2.5 sm:p-3">
              <IconButton
                label="Previous customer"
                disabled={selectedIndex <= 0}
                onClick={() => setSelectedUserId(users[selectedIndex - 1].user_id)}
                className="border-slate-200 bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <Select
                id="journey-customer"
                aria-label="Customer"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={users.length === 0}
                className="min-w-0 flex-1"
              >
                {users.length === 0 && <option value="">No customers yet</option>}
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name || u.email || `Customer ${u.user_id.slice(0, 8)}`}
                  </option>
                ))}
              </Select>
              <IconButton
                label="Next customer"
                disabled={selectedIndex < 0 || selectedIndex >= users.length - 1}
                onClick={() => setSelectedUserId(users[selectedIndex + 1].user_id)}
                className="border-slate-200 bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>

            {userSummary ? (
              <div className="flex items-center gap-3 p-4">
                <span
                  className={cx(
                    'grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-bold',
                    userSummary.intent_level === 'High'
                      ? 'bg-violet-100 text-violet-700'
                      : userSummary.intent_level === 'Medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-50 text-blue-700'
                  )}
                >
                  {(userSummary.name || userSummary.email || 'U').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold text-slate-900">{userSummary.name || 'Unnamed customer'}</p>
                    <Badge tone={INTENT_TONES[userSummary.intent_level] ?? 'neutral'} className="shrink-0">
                      {userSummary.intent_level} intent
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-slate-500">{userSummary.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {userSummary.persona && (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-violet-500" />
                        {userSummary.persona}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Last active {timeAgo(userSummary.last_active).toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-slate-400">
                {users.length === 0 ? 'Customers appear here after they sign up.' : 'Loading customer…'}
              </p>
            )}
          </Card>

          {/* Journey: four connected steps, lit up to the furthest one reached */}
          {userSummary && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Shopping journey</h2>
                <span className="text-[11px] font-medium text-slate-400">
                  {journeyReached === 0 ? 'Not started' : `Reached step ${journeyReached} of 4`}
                </span>
              </div>
              <ol className="relative mt-4 grid grid-cols-4">
                <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-4.5 h-0.5 rounded-full bg-slate-100" />
                <span
                  aria-hidden="true"
                  className="absolute left-[12.5%] top-4.5 h-0.5 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${(Math.max(0, journeyReached - 1) / 3) * 75}%` }}
                />
                {journeySteps.map((step, i) => {
                  const done = i < journeyReached;
                  return (
                    <li key={step.label} className="relative flex min-w-0 flex-col items-center text-center">
                      <span
                        className={cx(
                          'relative z-10 grid h-9 w-9 place-items-center rounded-full ring-4 ring-white transition-colors',
                          done
                            ? i === 3
                              ? 'bg-emerald-500 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        )}
                      >
                        {step.icon}
                      </span>
                      <span className={cx('mt-2 text-lg font-bold leading-none tabular-nums', done ? 'text-slate-900' : 'text-slate-300')}>
                        {step.value}
                      </span>
                      <span className="mt-1 px-0.5 text-[10px] font-medium leading-tight text-slate-500">{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
              {timelineEvents.length > 0 && (
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">{timelineEvents.length} events</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">What this customer did on the storefront, newest first</p>
            {timelineEvents.length > 0 && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <Checkbox
                  checked={allEventsSelected}
                  indeterminate={eventSelection.selected.size > 0}
                  onChange={(checked) => eventSelection.setSelected(checked ? new Set(timelineEvents.map((e) => e.id)) : new Set())}
                  label={allEventsSelected ? 'Clear selection' : 'Select all events'}
                />
                <span className="text-xs font-medium text-slate-500">
                  {eventSelection.selected.size > 0
                    ? `${eventSelection.selected.size} of ${timelineEvents.length} selected`
                    : `Select all (${timelineEvents.length})`}
                </span>
              </div>
            )}

            {loadingEvents && timelineEvents.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" /> Loading activity…
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-700">No activity yet</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    Browsing, carts and orders from this customer will show up here.
                  </p>
                </div>
              </div>
            ) : (
              <ol className={cx('relative mt-4 space-y-4 transition-opacity', loadingEvents && 'opacity-50')}>
                <span aria-hidden="true" className="absolute bottom-2 left-[15px] top-2 w-px bg-slate-200" />
                {timelineEvents.map((event, index) => (
                  <React.Fragment key={event.id}>
                  {(index === 0 || dayHeading(timelineEvents[index - 1].created_at) !== dayHeading(event.created_at)) && (
                    <li aria-hidden="true" className="relative z-10 flex">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-4 ring-white">
                        {dayHeading(event.created_at)}
                      </span>
                    </li>
                  )}
                  <li className="relative flex gap-3">
                    <span
                      className={cx(
                        'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white',
                        event.event_type === 'purchase'
                          ? 'bg-emerald-50 text-emerald-600'
                          : event.event_type === 'add_to_cart' || event.event_type === 'checkout_start'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {EVENT_ICONS[event.event_type] ?? <Activity className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <p className="text-[13px] text-slate-800">{describeEvent(event)}</p>
                      <p
                        className="mt-0.5 text-[11px] text-slate-400"
                        title={new Date(event.created_at).toLocaleString('en-IN')}
                      >
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-1">
                      <Checkbox
                        checked={eventSelection.selected.has(event.id)}
                        onChange={(checked) => toggleEventSelected(event.id, checked)}
                        label={`Select: ${describeEvent(event)}`}
                      />
                      <IconButton
                        label="Delete this event"
                        tone="danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete({ kind: 'events', ids: [event.id] })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </li>
                  </React.Fragment>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}

      {activeTab === 'user_details' && (
        <BulkActionBar
          count={customerSelection.selected.size}
          busy={deleting}
          onClear={customerSelection.clear}
          onDelete={() => setPendingDelete({ kind: 'customers', ids: [...customerSelection.selected] })}
        />
      )}
      {activeTab === 'events' && (
        <BulkActionBar
          count={eventSelection.selected.size}
          busy={deleting}
          onClear={eventSelection.clear}
          onDelete={() => setPendingDelete({ kind: 'events', ids: [...eventSelection.selected] })}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === 'customers'
            ? pendingDelete.ids.length === 1
              ? 'Delete this customer?'
              : `Delete ${pendingDelete.ids.length} customers?`
            : pendingDelete?.ids.length === 1
              ? 'Delete this activity event?'
              : `Delete ${pendingDelete?.ids.length ?? 0} activity events?`
        }
        message={
          pendingDelete?.kind === 'customers'
            ? "The account(s) will be permanently deleted with their tracked activity, and signed out everywhere. Their orders stay in Orders. This can't be undone."
            : "The selected activity will be permanently removed from this customer's history. This can't be undone."
        }
        confirmLabel={pendingDelete?.kind === 'customers' ? 'Delete customer' + (pendingDelete.ids.length === 1 ? '' : 's') : 'Delete activity'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </div>
  );
};

export default AdminDashboardPage;
