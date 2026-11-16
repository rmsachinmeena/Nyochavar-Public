import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Database,
  Package,
  ShoppingBag,
  LayoutGrid,
  ImageIcon,
  Shield,
  FileText,
  Bike
} from 'lucide-react';
import { api } from '../../../services/api';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterTabs,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Tone,
  cx
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';

interface AuditLogItem {
  id: string;
  admin_id: string | null;
  action: string;
  table_affected: string | null;
  record_id: string | null;
  created_at: string;
  actor_role?: 'admin' | 'rider' | 'buyer' | 'system';
  admin_name?: string;
  admin_email?: string;
}

const PAGE_SIZE = 20;

const humanizeAction = (action: string) => {
  const stock = action.match(/^UPDATE_STOCK_(\d+)$/);
  if (stock) return `Stock set to ${stock[1]}`;
  const text = action.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const actionTone = (action: string): Tone => {
  if (action.includes('DELETE')) return 'danger';
  if (action.includes('CREATE')) return 'success';
  if (action.includes('LOGIN')) return 'violet';
  if (action.includes('DELIVERED')) return 'success';
  if (action.includes('UPDATE') || action.includes('STOCK')) return 'info';
  if (action.includes('ORDER')) return 'warning';
  return 'neutral';
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  products: <Package className="h-3.5 w-3.5" />,
  orders: <ShoppingBag className="h-3.5 w-3.5" />,
  categories: <LayoutGrid className="h-3.5 w-3.5" />,
  banners: <ImageIcon className="h-3.5 w-3.5" />,
  admins: <Shield className="h-3.5 w-3.5" />,
  delivery_partners: <Bike className="h-3.5 w-3.5" />
};

const formatDay = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ACTION_ICON_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-500',
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600'
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.getAuditLogs({ limit: 200 });
      if (res?.logs) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedTable, selectedActionType]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        humanizeAction(log.action).toLowerCase().includes(q) ||
        (log.record_id && log.record_id.toLowerCase().includes(q)) ||
        (log.table_affected && log.table_affected.toLowerCase().includes(q)) ||
        (log.admin_name && log.admin_name.toLowerCase().includes(q)) ||
        (log.admin_email && log.admin_email.toLowerCase().includes(q));

      const matchesTable =
        selectedTable === 'all' || log.table_affected?.toLowerCase() === selectedTable.toLowerCase();

      let matchesActionType = true;
      if (selectedActionType === 'login') matchesActionType = log.action.includes('LOGIN');
      else if (selectedActionType === 'create') matchesActionType = log.action.includes('CREATE');
      else if (selectedActionType === 'update')
        matchesActionType = log.action.includes('UPDATE') || log.action.includes('STOCK');
      else if (selectedActionType === 'delete') matchesActionType = log.action.includes('DELETE');

      return matchesSearch && matchesTable && matchesActionType;
    });
  }, [logs, searchQuery, selectedTable, selectedActionType]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pageLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const metrics = useMemo(() => {
    const total = logs.length;
    const logins = logs.filter((l) => l.action.includes('LOGIN')).length;
    const catalog = logs.filter((l) => l.table_affected === 'products' || l.table_affected === 'categories').length;
    const orders = logs.filter((l) => l.table_affected === 'orders').length;
    return { total, logins, catalog, orders };
  }, [logs]);

  const hasFilters = Boolean(searchQuery) || selectedTable !== 'all' || selectedActionType !== 'all';

  const moduleChip = (log: AuditLogItem) => (
    <span className="inline-flex items-center gap-1.5 text-[13px] capitalize text-slate-700">
      <span className="text-slate-400">
        {MODULE_ICONS[log.table_affected?.toLowerCase() ?? ''] ?? <Database className="h-3.5 w-3.5" />}
      </span>
      {(log.table_affected || 'system').replace(/_/g, ' ')}
    </span>
  );

  const columns: DataColumn<AuditLogItem>[] = [
    {
      key: 'action',
      header: 'Action',
      mobile: 'title',
      cell: (log) => (
        <span title={log.action}>
          <Badge tone={actionTone(log.action)} className="text-xs">
            {humanizeAction(log.action)}
          </Badge>
        </span>
      )
    },
    {
      key: 'time-mobile',
      header: 'Time',
      mobile: 'aside',
      only: 'card',
      cell: (log) => {
        const date = new Date(log.created_at);
        return (
          <div className="text-right text-[11px] leading-tight text-slate-500">
            <p className="font-medium text-slate-700">{formatDay(date)}</p>
            <p className="tabular-nums">{formatTime(date)}</p>
          </div>
        );
      }
    },
    {
      key: 'admin',
      header: 'By',
      mobile: 'subtitle',
      cell: (log, layout) =>
        layout === 'card' ? (
          <p className="truncate font-medium text-slate-800">
            <span className="font-normal text-slate-500">by </span>
            {log.admin_name || 'SuperAdmin'}
          </p>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-600">
              {(log.admin_name || 'A').charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {log.admin_name || 'SuperAdmin'}
                {log.actor_role && log.actor_role !== 'admin' && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold capitalize text-slate-500">{log.actor_role}</span>
                )}
              </p>
              {log.admin_email && <p className="truncate text-xs text-slate-500">{log.admin_email}</p>}
            </div>
          </div>
        )
    },
    {
      key: 'module',
      header: 'Module',
      cell: moduleChip
    },
    {
      key: 'record',
      header: 'Record',
      cell: (log) =>
        log.record_id ? (
          <code className="inline-block max-w-[180px] truncate rounded-md bg-slate-100 px-1.5 py-0.5 align-middle font-mono text-[11px] text-slate-600">
            {log.record_id}
          </code>
        ) : (
          <span className="text-slate-300">—</span>
        )
    },
    {
      key: 'time',
      header: 'When',
      align: 'right',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (log) => {
        const date = new Date(log.created_at);
        return (
          <div>
            <p className="font-medium text-slate-800">{formatDay(date)}</p>
            <p className="mt-0.5 text-xs tabular-nums text-slate-500">{formatTime(date)}</p>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Audit log"
        description="Every catalog, order and sign-in change made from the admin panel."
        inlineActions
        actions={
          <IconButton
            label="Refresh audit log"
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="border-slate-200 bg-white"
          >
            <RefreshCw className={cx('h-4 w-4', isRefreshing && 'animate-spin')} />
          </IconButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total events" value={metrics.total} tone="neutral" icon={<Database className="h-3.5 w-3.5" />} hint="Most recent 200" />
        <StatCard label="Catalog changes" value={metrics.catalog} icon={<Package className="h-3.5 w-3.5" />} hint="Products & categories" />
        <StatCard
          label="Order updates"
          value={metrics.orders}
          tone="warning"
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          hint="Fulfillment changes"
        />
        <StatCard label="Sign-ins" value={metrics.logins} tone="violet" icon={<Shield className="h-3.5 w-3.5" />} hint="Admin & rider logins" />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-3 sm:p-5">
          <FilterTabs
            value={selectedActionType}
            onChange={setSelectedActionType}
            items={[
              { id: 'all', label: 'All', count: logs.length },
              { id: 'create', label: 'Created', count: logs.filter((l) => l.action.includes('CREATE')).length },
              { id: 'update', label: 'Updated', count: logs.filter((l) => l.action.includes('UPDATE') || l.action.includes('STOCK')).length },
              { id: 'delete', label: 'Deleted', count: logs.filter((l) => l.action.includes('DELETE')).length },
              { id: 'login', label: 'Sign-ins', count: metrics.logins }
            ]}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search action, record or admin…"
              icon={<Search className="h-3.5 w-3.5" />}
              className="min-w-0 flex-1"
            />
            <Select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              aria-label="Filter by module"
              className="w-32 sm:w-44"
            >
              <option value="all">All modules</option>
              <option value="products">Products</option>
              <option value="orders">Orders</option>
              <option value="categories">Categories</option>
              <option value="banners">Banners</option>
              <option value="admins">Admins</option>
              <option value="delivery_partners">Riders</option>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                className="col-span-2"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTable('all');
                  setSelectedActionType('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Phones: a compact activity feed grouped by day */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" /> Loading audit records…
            </div>
          ) : pageLogs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={hasFilters ? 'No matching events' : 'No activity yet'}
              description={hasFilters ? 'Try clearing your filters.' : 'Admin actions appear here automatically as they happen.'}
            />
          ) : (
            <ol>
              {pageLogs.map((log, index) => {
                const date = new Date(log.created_at);
                const day = formatDay(date);
                const newDay = index === 0 || formatDay(new Date(pageLogs[index - 1].created_at)) !== day;
                const dayCount = newDay ? pageLogs.filter((l) => formatDay(new Date(l.created_at)) === day).length : 0;
                const tone = actionTone(log.action);
                return (
                  <React.Fragment key={log.id}>
                    {newDay && (
                      <li className="flex items-center justify-between border-y border-slate-100 bg-slate-50 px-4 py-1.5 first:border-t-0">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{day}</span>
                        <span className="text-[10px] font-medium tabular-nums text-slate-400">
                          {dayCount} {dayCount === 1 ? 'event' : 'events'}
                        </span>
                      </li>
                    )}
                    <li className="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', ACTION_ICON_TONES[tone])}>
                        {MODULE_ICONS[log.table_affected?.toLowerCase() ?? ''] ?? <Database className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-slate-900" title={log.action}>
                            {humanizeAction(log.action)}
                          </p>
                          <time className="shrink-0 text-[11px] tabular-nums text-slate-400" dateTime={log.created_at}>
                            {formatTime(date)}
                          </time>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{log.admin_name || 'SuperAdmin'}</span>
                          <span className="mx-1 text-slate-300">·</span>
                          <span className="capitalize">{(log.table_affected || 'system').replace(/_/g, ' ')}</span>
                        </p>
                        {log.record_id && (
                          <code className="mt-1.5 inline-block max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 align-middle font-mono text-[10px] text-slate-500">
                            {log.record_id}
                          </code>
                        )}
                      </div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>
          )}
        </div>

        <DataTable
          className="hidden lg:block"
          columns={columns}
          rows={pageLogs}
          rowKey={(log) => log.id}
          loading={isLoading}
          loadingLabel="Loading audit records…"
          empty={
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={hasFilters ? 'No matching events' : 'No activity yet'}
              description={
                hasFilters
                  ? 'Try clearing your filters.'
                  : 'Admin actions appear here automatically as they happen.'
              }
            />
          }
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          total={filteredLogs.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Card>
    </div>
  );
};

export default AdminAuditLogsPage;
