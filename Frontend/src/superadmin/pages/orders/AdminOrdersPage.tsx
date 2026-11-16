import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  CreditCard,
  Phone,
  MapPin,
  Eye,
  Bike,
  KeyRound,
  UserCheck,
  ShoppingBag,
  Trash2,
  MessageCircle
} from 'lucide-react';
import { api } from '../../../services/api';
import { createPortal } from 'react-dom';
import { whatsappService } from '../../../services/whatsappService';
import type { WhatsappTemplate } from '../../../services/whatsappService';
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterTabs,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  Tone,
  cx,
  useRowSelection
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';

export interface AdminOrder {
  id: string;
  buyer_id: string | null;
  items: any[];
  total_amount: number;
  delivery_address: string;
  delivery_date: string | null;
  delivery_slot: string | null;
  is_same_day: boolean;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: 'Card' | 'UPI' | 'COD' | string;
  order_status: 'awaiting_payment' | 'placed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  /** "razorpay:order_X" while unpaid, "razorpay:order_X:pay_Y" once paid */
  payment_ref?: string | null;
  refund_id?: string | null;
  /** due: refund it in the Razorpay dashboard · partial: part of the money given back · processed: fully refunded */
  refund_status?: 'due' | 'partial' | 'processed' | null;
  refund_amount?: number | null;
  refund_error?: string | null;
  created_at: string;
  delivery_partner_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  delivery_otp?: string;
  assigned_at?: string;
  out_for_delivery_at?: string;
  delivered_at?: string;
  delivery_issue?: 'failed' | 'reschedule' | null;
  delivery_issue_at?: string | null;
}

const STATUS_TONES: Record<string, Tone> = {
  awaiting_payment: 'neutral',
  placed: 'info',
  processing: 'warning',
  out_for_delivery: 'violet',
  delivered: 'success',
  cancelled: 'danger'
};

// awaiting_payment: an online checkout Razorpay has not confirmed yet. It becomes "Placed" by itself once paid (or is
// cancelled if never paid), so it is shown but cannot be picked or changed by hand.
const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  placed: 'Placed',
  processing: 'Hand-Finishing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const STATUS_OPTIONS = ['placed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];

const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

// What happened to the money, in one badge (refund states win over "Paid")
const paymentBadge = (order: AdminOrder): { tone: Tone; label: string } => {
  if (order.refund_status === 'processed' || order.payment_status === 'refunded') return { tone: 'violet', label: 'Refunded' };
  if (order.refund_status === 'due') return { tone: 'danger', label: 'Refund due' };
  if (order.refund_status === 'partial') return { tone: 'violet', label: 'Partly refunded' };
  if (order.payment_status === 'paid') return { tone: 'success', label: 'Paid' };
  if (order.payment_status === 'failed') return { tone: 'neutral', label: 'Not paid' };
  return { tone: 'neutral', label: 'Pending' };
};

// Refunds are issued by hand in the Razorpay dashboard; these orders are waiting for one
const isRefundDue = (order: AdminOrder) => order.refund_status === 'due' && order.payment_status === 'paid';

const razorpayPaymentId = (order: AdminOrder) => String(order.payment_ref || '').split(':')[2] || '';

const addressPart = (address: string | undefined, index: number) =>
  address?.split('|')?.[index]?.trim() || '';

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // WhatsApp "click to send": the admin picks a message, WhatsApp opens with it ready, and only Send is left to press
  const [waTemplates, setWaTemplates] = useState<WhatsappTemplate[]>([]);
  const [waMenuOrderId, setWaMenuOrderId] = useState<string | null>(null);
  const [waBusy, setWaBusy] = useState(false);
  useEffect(() => {
    whatsappService.listTemplates().then((list) => setWaTemplates(list.filter((t) => t.is_active && t.event_key !== 'verify_otp'))).catch(() => {});
  }, []);
  const openWhatsApp = async (orderId: string, eventKey: string) => {
    setWaBusy(true);
    try {
      const { url } = await whatsappService.createLink(orderId, eventKey);
      window.open(url, '_blank', 'noopener,noreferrer');
      setWaMenuOrderId(null);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Could not prepare the WhatsApp message' });
      setTimeout(() => setFeedback(null), 5000);
      setWaMenuOrderId(null);
    } finally {
      setWaBusy(false);
    }
  };
  // The menu opens as a small popup in the middle of the screen (a dropdown under the icon gets cut off by the table and
  // by the phone's edge, so it was not visible)
  const whatsappButton = (order: AdminOrder, _compact: boolean) => (
    <>
      <IconButton
        label={`Send a WhatsApp message for order ${order.id}`}
        onClick={() => setWaMenuOrderId(order.id)}
        disabled={waTemplates.length === 0}
      >
        <MessageCircle className="h-4 w-4 text-emerald-600" />
      </IconButton>
      {waMenuOrderId === order.id &&
        createPortal(
          <div className="fixed inset-0 z-200 flex items-center justify-center bg-slate-900/50 p-5" onClick={() => setWaMenuOrderId(null)}>
            <div
              role="dialog"
              aria-label="Send on WhatsApp"
              className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Send on WhatsApp</p>
                  <p className="truncate text-[11px] text-slate-500">Order {order.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaMenuOrderId(null)}
                  aria-label="Close"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
                >
                  <span aria-hidden="true" className="text-lg leading-none">×</span>
                </button>
              </div>
              <div className="space-y-1.5 p-3">
                {waTemplates.map((template) => (
                  <button
                    key={template.event_key}
                    type="button"
                    disabled={waBusy}
                    onClick={() => void openWhatsApp(order.id, template.event_key)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
  const [partners, setPartners] = useState<any[]>([]);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  /** Orders waiting for delete confirmation: one from a row's trash button, or the multi-selection */
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch delivery partners
  const fetchPartners = async () => {
    try {
      const data = await api.getAllDeliveryPartners();
      setPartners(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Failed to fetch delivery partners:', err.message);
    }
  };

  // Fetch all orders from backend
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getAllOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to load orders from database' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchPartners();
  }, []);

  // Assign Delivery Partner
  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    if (!partnerId) return;
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return;

    if (partner.duty_status === 'on_leave' || partner.is_active === false) {
      setFeedback({
        type: 'error',
        text: `Cannot assign order: ${partner.name} is currently on break / offline.`
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setAssigningOrderId(orderId);
    try {
      const res = await api.assignOrderRider(orderId, {
        partnerId: partner.id,
        partnerName: partner.name,
        partnerPhone: partner.phone
      });

      const updated = res.order || {};
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                delivery_partner_id: partner.id,
                delivery_partner_name: partner.name,
                delivery_partner_phone: partner.phone,
                delivery_otp: updated.delivery_otp || o.delivery_otp,
                order_status: updated.order_status || o.order_status
              }
            : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                delivery_partner_id: partner.id,
                delivery_partner_name: partner.name,
                delivery_partner_phone: partner.phone,
                delivery_otp: updated.delivery_otp || prev.delivery_otp,
                order_status: updated.order_status || prev.order_status
              }
            : null
        );
      }

      setFeedback({
        type: 'success',
        text: `Assigned to ${partner.name}. Delivery verification code generated.`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error('Assigning partner failed:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to assign delivery partner' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setAssigningOrderId(null);
    }
  };

  // Update order status directly in database
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      // The server's copy also carries "Refund due" when a paid online order is cancelled
      const updated = (await api.updateOrderStatus(orderId, newStatus)) || {};
      const merge = (o: AdminOrder): AdminOrder => ({ ...o, ...updated, order_status: newStatus as any });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? merge(o) : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? merge(prev) : null));
      }
      const refundNote =
        newStatus === 'cancelled' && updated.refund_status === 'due'
          ? ` Refund due: refund ${formatMoney(updated.refund_amount ?? updated.total_amount)} from the Razorpay dashboard.`
          : '';
      setFeedback({
        type: 'success',
        text: `Order #${orderId.toUpperCase()} moved to ${STATUS_LABELS[newStatus] || newStatus}.${refundNote}`
      });
      setTimeout(() => setFeedback(null), refundNote ? 6000 : 3000);
    } catch (err: any) {
      console.error('Status update failed:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to update order status' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // "Mark as refunded": the refund was issued by hand in the Razorpay dashboard but the webhook did not update the order
  const [markingRefundedId, setMarkingRefundedId] = useState<string | null>(null);
  const [refundIdInput, setRefundIdInput] = useState('');
  useEffect(() => setRefundIdInput(''), [selectedOrder?.id]);
  const handleMarkRefunded = async (orderId: string) => {
    setMarkingRefundedId(orderId);
    try {
      const updated = (await api.markOrderRefunded(orderId, refundIdInput.trim() || undefined)) || {};
      const merge = (o: AdminOrder): AdminOrder => ({ ...o, ...updated });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? merge(o) : o)));
      setSelectedOrder((prev) => (prev && prev.id === orderId ? merge(prev) : prev));
      setRefundIdInput('');
      setFeedback({ type: 'success', text: `Order #${orderId.toUpperCase()} marked as refunded. The customer has been told.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Could not mark the order refunded' });
    } finally {
      setMarkingRefundedId(null);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = orders.length;
    const placed = orders.filter((o) => o.order_status === 'placed').length;
    const processing = orders.filter((o) => o.order_status === 'processing').length;
    const outForDelivery = orders.filter((o) => o.order_status === 'out_for_delivery').length;
    const delivered = orders.filter((o) => o.order_status === 'delivered').length;
    const awaitingPayment = orders.filter((o) => o.order_status === 'awaiting_payment').length;
    const refundDue = orders.filter(isRefundDue).length;
    // Paid revenue leaves out money that is owed back (refund due) or has been given back (in full or in part)
    const revenue = orders
      .filter((o) => o.payment_status === 'paid' && o.refund_status !== 'due')
      .reduce((sum, o) => sum + Number(o.total_amount || 0) - (o.refund_status === 'partial' ? Number(o.refund_amount || 0) : 0), 0);

    return { total, placed, processing, outForDelivery, delivered, awaitingPayment, refundDue, revenue };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        order.id?.toLowerCase().includes(query) ||
        order.delivery_address?.toLowerCase().includes(query) ||
        (order.payment_method && order.payment_method.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'refund_due' ? isRefundDue(order) : order.order_status === statusFilter);
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  // Multi-select works on the orders currently shown (this filter / search)
  const selection = useRowSelection(filteredOrders.map((order) => order.id));

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteIds) return;
    const ids = pendingDeleteIds;
    setPendingDeleteIds(null);
    setDeleting(true);
    try {
      const { deleted } = await api.bulkDelete('orders', ids);
      const removed = new Set(ids);
      setOrders((prev) => prev.filter((order) => !removed.has(order.id)));
      selection.setSelected((prev) => new Set([...prev].filter((id) => !removed.has(id))));
      setFeedback({ type: 'success', text: `${deleted} ${deleted === 1 ? 'order' : 'orders'} deleted` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Could not delete the order(s)' });
    } finally {
      setDeleting(false);
    }
  };

  const statusSelect = (order: AdminOrder) => (
    <Select
      value={order.order_status}
      disabled={updatingOrderId === order.id || order.order_status === 'awaiting_payment'}
      onChange={(e) => handleStatusChange(order.id, e.target.value)}
      aria-label={`Fulfillment status for order ${order.id}`}
      title={order.order_status === 'awaiting_payment' ? 'Waiting for the customer’s online payment: changes automatically' : undefined}
      className={`h-9 text-xs sm:h-8 ${order.order_status === 'cancelled' ? 'border-red-300! bg-red-50! font-semibold text-red-600!' : ''}`}
    >
      {!STATUS_OPTIONS.includes(order.order_status) && (
        <option value={order.order_status} disabled>
          {STATUS_LABELS[order.order_status] ?? order.order_status}
        </option>
      )}
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </Select>
  );

  const riderCell = (order: AdminOrder) => {
    const assignedPartner = order.delivery_partner_id ? partners.find((p) => p.id === order.delivery_partner_id) : null;
    const isAssignedOnBreak = assignedPartner && (assignedPartner.duty_status === 'on_leave' || assignedPartner.is_active === false);

    return order.delivery_partner_name ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={isAssignedOnBreak ? 'danger' : 'violet'} icon={<Bike className="h-3 w-3" />} className="max-w-full">
          <span className="truncate">{order.delivery_partner_name}</span>
        </Badge>
        {isAssignedOnBreak && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Rider on break
          </span>
        )}
        {order.delivery_otp && order.order_status !== 'delivered' && (
          <Badge tone="warning" icon={<KeyRound className="h-2.5 w-2.5" />} className="font-mono">
            {order.delivery_otp}
          </Badge>
        )}
        {order.delivery_issue && (
          <Badge tone={order.delivery_issue === 'failed' ? 'danger' : 'warning'} icon={<AlertCircle className="h-3 w-3" />}>
            {order.delivery_issue === 'failed' ? 'Delivery failed' : 'Reschedule asked'}
          </Badge>
        )}
      </div>
    ) : (
      <Select
        value=""
        disabled={assigningOrderId === order.id}
        onChange={(e) => handleAssignPartner(order.id, e.target.value)}
        aria-label={`Assign rider to order ${order.id}`}
        className="h-9 border-dashed text-xs text-slate-500 sm:h-8"
      >
        <option value="" disabled>
          + Assign a rider
        </option>
        {partners.map((p) => {
          const onBreak = p.duty_status === 'on_leave' || p.is_active === false;
          return (
            <option key={p.id} value={p.id} disabled={onBreak}>
              {p.name} ({p.phone}) {onBreak ? '— 🔴 Rider on break' : '— 🟢 On Duty'}
            </option>
          );
        })}
      </Select>
    );
  };

  const columns: DataColumn<AdminOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      mobile: 'title',
      className: 'whitespace-nowrap',
      cell: (order) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold uppercase text-slate-900">#{order.id}</span>
            {order.is_same_day && <Badge tone="warning">Same day</Badge>}
          </div>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            {new Date(order.created_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      mobile: 'aside',
      only: 'card',
      cell: (order) => (
        <div className="text-right">
          <p className="text-[15px] font-bold tabular-nums text-slate-900">{formatMoney(order.total_amount)}</p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
            {order.payment_method || 'Online'}
            <Badge tone={paymentBadge(order).tone}>{paymentBadge(order).label}</Badge>
          </p>
        </div>
      )
    },
    {
      key: 'recipient',
      header: 'Recipient',
      mobile: 'block',
      cell: (order, layout) => (
        <div className={cx('min-w-0', layout === 'table' && 'max-w-[190px]')}>
          <p className="truncate font-medium text-slate-900">
            {addressPart(order.delivery_address, 0) || 'Valued customer'}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {addressPart(order.delivery_address, 2) || order.delivery_address || 'Address provided'}
          </p>
          {order.delivery_slot && (
            <p className="mt-0.5 text-[11px] font-medium text-blue-600">{order.delivery_slot}</p>
          )}
        </div>
      )
    },
    {
      key: 'items',
      header: 'Items',
      mobile: 'block',
      mobileClassName: 'rounded-xl bg-slate-50 p-2',
      cell: (order, layout) => {
        const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
        const firstItem = Array.isArray(order.items) && order.items[0] ? order.items[0] : null;
        return (
          <div className={cx('flex min-w-0 items-center gap-2.5', layout === 'table' && 'max-w-[200px]')}>
            {firstItem?.image ? (
              <img
                src={firstItem.image}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                <Package className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-slate-800">
                {firstItem?.name || `${itemsCount} items`}
              </p>
              {itemsCount > 1 && <p className="text-[11px] text-slate-400">+{itemsCount - 1} more</p>}
            </div>
          </div>
        );
      }
    },
    {
      key: 'total',
      header: 'Amount',
      align: 'right',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (order) => (
        <div>
          <p className="text-sm font-bold tabular-nums text-slate-900">{formatMoney(order.total_amount)}</p>
          <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
            {order.payment_method || 'Online'}
            <Badge tone={paymentBadge(order).tone}>{paymentBadge(order).label}</Badge>
          </p>
        </div>
      )
    },
    {
      key: 'dispatch',
      header: 'Dispatch',
      only: 'table',
      cell: (order) => (
        <div className="w-[172px] space-y-1.5">
          {statusSelect(order)}
          {riderCell(order)}
        </div>
      )
    },
    {
      key: 'rider',
      header: 'Rider',
      mobile: 'block',
      only: 'card',
      cell: riderCell
    },
    {
      key: 'status',
      header: 'Status',
      mobile: 'footer',
      only: 'card',
      mobileClassName: 'flex-1',
      cell: statusSelect
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobile: 'footer',
      cell: (order, layout) =>
        layout === 'table' ? (
          <div className="flex items-center justify-end gap-1">
            {whatsappButton(order, false)}
            <IconButton label={`View order ${order.id}`} onClick={() => setSelectedOrder(order)}>
              <Eye className="h-4 w-4" />
            </IconButton>
            <IconButton label={`Delete order ${order.id}`} tone="danger" disabled={deleting} onClick={() => setPendingDeleteIds([order.id])}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {whatsappButton(order, true)}
            <Button size="sm" onClick={() => setSelectedOrder(order)} icon={<Eye className="h-3.5 w-3.5" />}>
              View
            </Button>
            <IconButton label={`Delete order ${order.id}`} tone="danger" disabled={deleting} onClick={() => setPendingDeleteIds([order.id])}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        )
    }
  ];

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert
          tone={feedback.type === 'success' ? 'success' : 'danger'}
          onDismiss={() => setFeedback(null)}
          icon={
            feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )
          }
        >
          {feedback.text}
        </Alert>
      )}

      <PageHeader
        icon={<ShoppingBag className="h-5 w-5" />}
        title="Orders & dispatch"
        description="Packing progress and rider assignment for every buyer order."
        inlineActions
        actions={
          <IconButton
            label="Refresh orders"
            onClick={fetchOrders}
            disabled={loading}
            className="border-slate-200 bg-white"
          >
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
          </IconButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total placed"
          value={metrics.total}
          icon={<Package className="h-3.5 w-3.5" />}
          hint="All-time buyer orders"
        />
        <StatCard
          label="Awaiting packing"
          value={metrics.placed}
          tone="warning"
          icon={<Clock className="h-3.5 w-3.5" />}
          hint="Placed by customers"
          badge={metrics.placed > 0 ? <Badge tone="warning">Action needed</Badge> : undefined}
        />
        <StatCard
          label="In progress"
          value={metrics.processing + metrics.outForDelivery}
          tone="violet"
          icon={<Truck className="h-3.5 w-3.5" />}
          hint={`${metrics.outForDelivery} out for delivery`}
        />
        <StatCard
          label="Paid revenue"
          value={formatMoney(metrics.revenue)}
          tone="success"
          icon={<CreditCard className="h-3.5 w-3.5" />}
          hint={`${metrics.delivered} orders delivered`}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            items={[
              { id: 'all', label: 'All orders', count: metrics.total },
              { id: 'placed', label: 'Placed', count: metrics.placed },
              { id: 'processing', label: 'Hand-finishing', count: metrics.processing },
              { id: 'out_for_delivery', label: 'Out for delivery', count: metrics.outForDelivery },
              { id: 'delivered', label: 'Delivered', count: metrics.delivered },
              { id: 'awaiting_payment', label: 'Awaiting payment', count: metrics.awaitingPayment },
              { id: 'refund_due', label: 'Refund due', count: metrics.refundDue }
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search order ID, recipient…"
              icon={<Search className="h-3.5 w-3.5" />}
              className="flex-1"
            />
            <Select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              aria-label="Filter by payment status"
              className="sm:w-44"
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </Select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredOrders}
          rowKey={(order) => order.id}
          selectedKeys={selection.selected}
          onSelectionChange={selection.setSelected}
          selectLabel={(order) => `order ${order.id}`}
          loading={loading}
          loadingLabel="Loading orders from the database…"
          empty={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No orders found"
              description={
                searchQuery || statusFilter !== 'all' || paymentFilter !== 'all'
                  ? 'Try changing your search or filters.'
                  : 'Orders placed on the storefront will appear here instantly.'
              }
            />
          }
        />
      </Card>

      {/* Order detail */}
      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        size="lg"
        title={
          selectedOrder ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="uppercase">Order #{selectedOrder.id}</span>
              <Badge tone={STATUS_TONES[selectedOrder.order_status] ?? 'neutral'}>
                {STATUS_LABELS[selectedOrder.order_status] ?? selectedOrder.order_status}
              </Badge>
              {selectedOrder.delivery_issue && (
                <Badge tone={selectedOrder.delivery_issue === 'failed' ? 'danger' : 'warning'} icon={<AlertCircle className="h-3 w-3" />}>
                  {selectedOrder.delivery_issue === 'failed' ? 'Delivery failed' : 'Reschedule asked'}
                </Badge>
              )}
            </span>
          ) : (
            ''
          )
        }
        subtitle={
          selectedOrder ? `Placed on ${new Date(selectedOrder.created_at).toLocaleString('en-IN')}` : undefined
        }
        footer={
          selectedOrder ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500">
                  {selectedOrder.payment_method} · {paymentBadge(selectedOrder).label}
                  {razorpayPaymentId(selectedOrder) && (
                    <span className="font-mono"> · {razorpayPaymentId(selectedOrder)}</span>
                  )}
                </p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {formatMoney(selectedOrder.total_amount)}
                </p>
                {(selectedOrder.refund_status === 'processed' || selectedOrder.refund_status === 'partial') && (
                  <p className="mt-0.5 text-[11px] text-violet-700">
                    Refunded {formatMoney(selectedOrder.refund_amount ?? selectedOrder.total_amount)}
                    {selectedOrder.refund_id && <span className="font-mono text-slate-500"> · {selectedOrder.refund_id}</span>}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedOrder && (
          <div className="space-y-5">
            {/* Refund due: refunds are issued by hand in the Razorpay dashboard */}
            {isRefundDue(selectedOrder) && (
              <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Refund due · {formatMoney(selectedOrder.refund_amount ?? selectedOrder.total_amount)}
                </h4>
                {selectedOrder.refund_error && <p className="mt-2 text-[13px] font-medium text-red-700">{selectedOrder.refund_error}</p>}
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-700">
                  <li>
                    Razorpay Dashboard → Transactions → Payments → search{' '}
                    <span className="select-all break-all font-mono font-semibold text-slate-900">{razorpayPaymentId(selectedOrder)}</span>
                  </li>
                  <li>Click <strong>Issue refund</strong> for the full amount.</li>
                  <li>This order changes to <strong>Refunded</strong> by itself within a minute (refund webhook).</li>
                </ol>
                <p className="mt-3 text-[12px] text-slate-500">
                  Already refunded but it still shows here? Mark it by hand (the refund ID is optional):
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={refundIdInput}
                    onChange={(e) => setRefundIdInput(e.target.value)}
                    placeholder="rfnd_… (optional)"
                    aria-label="Razorpay refund ID"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-[13px] outline-none focus:border-blue-500"
                  />
                  <Button
                    variant="secondary"
                    disabled={markingRefundedId === selectedOrder.id}
                    onClick={() => void handleMarkRefunded(selectedOrder.id)}
                  >
                    {markingRefundedId === selectedOrder.id ? 'Saving…' : 'Mark as refunded'}
                  </Button>
                </div>
              </section>
            )}

            {/* Destination */}
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  Delivery destination
                </h4>
                {selectedOrder.delivery_slot && <Badge tone="info">{selectedOrder.delivery_slot}</Badge>}
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900">
                {addressPart(selectedOrder.delivery_address, 0) || 'Customer'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {addressPart(selectedOrder.delivery_address, 2) || selectedOrder.delivery_address}
              </p>
              {addressPart(selectedOrder.delivery_address, 1) && (
                <a
                  href={`tel:${addressPart(selectedOrder.delivery_address, 1)}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {addressPart(selectedOrder.delivery_address, 1)}
                </a>
              )}
            </section>

            {/* Items */}
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Purchased keepsakes ({selectedOrder.items?.length || 0})
              </h4>
              <ul className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                            <Package className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-900">
                            {item.name || 'Gift hamper'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Qty {item.quantity || 1}
                            {item.variant?.name ? ` · ${item.variant.name}` : ''}
                            {item.selectedHue ? ` · ${item.selectedHue}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">
                        {formatMoney(item.price)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="p-4 text-center text-xs text-slate-400">No item details saved</li>
                )}
              </ul>
            </section>

            {/* Rider dispatch */}
            <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <Bike className="h-3.5 w-3.5 text-violet-600" />
                  Rider dispatch
                </h4>
                {selectedOrder.delivery_partner_name ? (
                  <Badge tone="violet" icon={<UserCheck className="h-3 w-3" />}>
                    Assigned
                  </Badge>
                ) : (
                  <Badge tone="warning">Unassigned</Badge>
                )}
              </div>

              {selectedOrder.delivery_partner_name ? (
                <div className="mt-3 space-y-3 rounded-xl border border-violet-100 bg-white p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {selectedOrder.delivery_partner_name}
                      </p>
                      {selectedOrder.delivery_partner_phone && (
                        <a
                          href={`tel:${selectedOrder.delivery_partner_phone}`}
                          className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {selectedOrder.delivery_partner_phone}
                        </a>
                      )}
                    </div>
                    {selectedOrder.delivery_otp && (
                      <div className="text-right">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Delivery code
                        </span>
                        <span className="mt-0.5 inline-block rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-mono text-base font-bold text-amber-700">
                          {selectedOrder.delivery_otp}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Red Card: If assigned rider is currently on break */}
                  {(() => {
                    const assignedP = partners.find(p => p.id === selectedOrder.delivery_partner_id);
                    if (assignedP && (assignedP.duty_status === 'on_leave' || assignedP.is_active === false)) {
                      return (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 flex items-center gap-2 text-rose-700 text-xs font-bold animate-fadeIn">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                          <span>Rider on break: {selectedOrder.delivery_partner_name} is currently offline. Please reassign if delivery is pending.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <p className="border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-500">
                    The rider confirms this code with the customer at the doorstep to mark the order delivered.
                  </p>
                  <div>
                    <label
                      htmlFor="reassign-rider"
                      className="mb-1.5 block text-[11px] font-semibold text-slate-600"
                    >
                      Reassign to another rider
                    </label>
                    <Select
                      id="reassign-rider"
                      defaultValue=""
                      disabled={assigningOrderId === selectedOrder.id}
                      onChange={(e) => {
                        if (e.target.value) handleAssignPartner(selectedOrder.id, e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Choose another rider…
                      </option>
                      {partners.map((p) => {
                        const onBreak = p.duty_status === 'on_leave' || p.is_active === false;
                        return (
                          <option key={p.id} value={p.id} disabled={onBreak}>
                            {p.name} ({p.phone}) {onBreak ? '— 🔴 Rider on break (Cannot assign)' : '— 🟢 On Duty'}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3 rounded-xl border border-dashed border-slate-200 bg-white p-3.5">
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Assign a verified rider. A delivery code is generated automatically for the customer to confirm.
                  </p>
                  <Select
                    defaultValue=""
                    aria-label="Select delivery partner"
                    disabled={assigningOrderId === selectedOrder.id}
                    onChange={(e) => {
                      if (e.target.value) handleAssignPartner(selectedOrder.id, e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Select a delivery partner…
                    </option>
                    {partners.map((p) => {
                      const onBreak = p.duty_status === 'on_leave' || p.is_active === false;
                      return (
                        <option key={p.id} value={p.id} disabled={onBreak}>
                          {p.name} ({p.phone}) {onBreak ? '— 🔴 Rider on break (Cannot assign)' : '— 🟢 On Duty'}
                        </option>
                      );
                    })}
                  </Select>
                  {partners.some((p) => p.duty_status === 'on_leave' || p.is_active === false) && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span>Riders on break are disabled from order assignment.</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Fulfillment stage */}
            <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Update fulfillment stage
                </h4>
                <span className="text-[11px] text-slate-500">Syncs immediately to the customer</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STATUS_OPTIONS.filter((s) => s !== 'cancelled').map((status) => {
                  const active = selectedOrder.order_status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={updatingOrderId === selectedOrder.id || selectedOrder.order_status === 'awaiting_payment'}
                      onClick={() => handleStatusChange(selectedOrder.id, status)}
                      className={cx(
                        'h-10 rounded-xl border px-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50',
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDeleteIds)}
        title={
          pendingDeleteIds?.length === 1
            ? 'Delete this order?'
            : `Delete ${pendingDeleteIds?.length ?? 0} orders?`
        }
        message={
          pendingDeleteIds?.length === 1 ? (
            <>
              Order <span className="font-semibold uppercase text-slate-900">#{pendingDeleteIds[0]}</span> will be permanently
              removed, including its items, payment and delivery details. This can't be undone.
            </>
          ) : (
            "The selected orders will be permanently removed, including their items, payment and delivery details. This can't be undone."
          )
        }
        confirmLabel={pendingDeleteIds?.length === 1 ? 'Delete order' : 'Delete orders'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDeleteIds(null)}
      />

      <BulkActionBar
        count={selection.selected.size}
        busy={deleting}
        onClear={selection.clear}
        onDelete={() => setPendingDeleteIds([...selection.selected])}
      />
    </div>
  );
};

export default AdminOrdersPage;
