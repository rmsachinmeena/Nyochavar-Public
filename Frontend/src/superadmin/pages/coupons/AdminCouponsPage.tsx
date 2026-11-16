import React, { useEffect, useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  Percent,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  TrendingUp,
  Gift
} from 'lucide-react';
import { api } from '../../../services/api';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
  Switch,
  Toast,
  cx
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';

interface CouponItem {
  id: string;
  code: string;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  min_order_amount?: number | null;
  max_discount?: number | null;
  expiry_date?: string | null;
  usage_limit?: number | null;
  used_count?: number;
  per_user_limit?: number;
  first_order_only?: boolean;
  is_active: boolean;
  created_at?: string;
}

const emptyCouponForm = {
  code: '',
  discount_type: 'flat' as 'flat' | 'percentage',
  discount_value: 100,
  min_order_amount: 500,
  max_discount: '',
  expiry_date: '',
  usage_limit: 100,
  per_user_limit: 1,
  first_order_only: false,
  is_active: true
};

export const AdminCouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState(emptyCouponForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CouponItem | null>(null);

  const showToast = (msg: string, tone: 'success' | 'danger' = 'success') => {
    setToastMessage(msg);
    setToastTone(tone);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const data = await api.getAllCouponsAdmin();
      setCoupons(data || []);
    } catch (err: any) {
      console.error('Failed to load coupons:', err);
      showToast(err.message || 'Failed to load coupons', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingCouponId(null);
    setCouponForm(emptyCouponForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CouponItem) => {
    setEditingCouponId(c.id);
    setCouponForm({
      code: c.code,
      discount_type: c.discount_type || 'flat',
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount ?? 0,
      max_discount: c.max_discount !== null && c.max_discount !== undefined ? String(c.max_discount) : '',
      expiry_date: c.expiry_date ? c.expiry_date.slice(0, 10) : '',
      usage_limit: c.usage_limit ?? 100,
      per_user_limit: c.per_user_limit ?? 1,
      first_order_only: Boolean(c.first_order_only),
      is_active: c.is_active !== false
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      setFormError('Please enter a coupon code.');
      return;
    }
    if (!couponForm.discount_value || Number(couponForm.discount_value) <= 0) {
      setFormError('Please enter a valid discount value greater than 0.');
      return;
    }

    setFormError(null);
    setIsSaving(true);

    const payload = {
      code: couponForm.code.trim().toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      min_order_amount: Number(couponForm.min_order_amount) || 0,
      max_discount: couponForm.max_discount !== '' ? Number(couponForm.max_discount) : null,
      expiry_date: couponForm.expiry_date || null,
      usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : null,
      per_user_limit: Number(couponForm.per_user_limit) || 1,
      first_order_only: Boolean(couponForm.first_order_only),
      is_active: Boolean(couponForm.is_active)
    };

    try {
      if (editingCouponId) {
        await api.updateCoupon(editingCouponId, payload);
        showToast(`Coupon "${payload.code}" updated successfully`);
      } else {
        await api.createCoupon(payload);
        showToast(`Coupon "${payload.code}" created successfully`);
      }
      setIsModalOpen(false);
      loadCoupons();
    } catch (err: any) {
      console.error('Error saving coupon:', err);
      setFormError(err.message || 'Failed to save coupon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (c: CouponItem) => {
    try {
      await api.toggleCouponStatus(c.id);
      setCoupons((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, is_active: !item.is_active } : item))
      );
      showToast(`Coupon "${c.code}" is now ${!c.is_active ? 'Active' : 'Disabled'}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle coupon status', 'danger');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.deleteCoupon(pendingDelete.id);
      setCoupons((prev) => prev.filter((item) => item.id !== pendingDelete.id));
      showToast(`Coupon "${pendingDelete.code}" deleted`);
      setPendingDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete coupon', 'danger');
    }
  };

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return coupons.filter((c) => {
      const matchesSearch = !q || c.code.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.is_active) ||
        (statusFilter === 'inactive' && !c.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [coupons, searchQuery, statusFilter]);

  const activeCount = coupons.filter((c) => c.is_active).length;
  const totalUses = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);

  const columns: DataColumn<CouponItem>[] = [
    {
      key: 'code',
      header: 'Coupon Code',
      cell: (coupon) => (
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold tracking-wider text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80">
            {coupon.code}
          </span>
          <button
            type="button"
            onClick={() => handleCopyCode(coupon.code)}
            title="Copy promo code"
            className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            {copiedCode === coupon.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {coupon.first_order_only && (
            <Badge tone="purple" className="text-[10px] px-1.5 py-0.5">
              1st Order Only
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'discount',
      header: 'Discount Benefit',
      cell: (coupon) => (
        <div className="text-xs">
          <span className="font-bold text-slate-900">
            {coupon.discount_type === 'percentage'
              ? `${coupon.discount_value}% OFF`
              : `₹${coupon.discount_value.toLocaleString('en-IN')} Flat OFF`}
          </span>
          {coupon.max_discount ? (
            <span className="block text-[11px] text-slate-500">Max ₹{coupon.max_discount.toLocaleString('en-IN')}</span>
          ) : null}
        </div>
      )
    },
    {
      key: 'min_order',
      header: 'Min. Order',
      cell: (coupon) => (
        <span className="text-xs text-slate-700 font-medium">
          {coupon.min_order_amount && coupon.min_order_amount > 0
            ? `₹${coupon.min_order_amount.toLocaleString('en-IN')}`
            : 'No minimum'}
        </span>
      )
    },
    {
      key: 'usage',
      header: 'Redemptions',
      cell: (coupon) => {
        const used = coupon.used_count || 0;
        const limit = coupon.usage_limit;
        const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
        return (
          <div className="text-xs">
            <span className="font-semibold text-slate-800 tabular-nums">
              {used} {limit ? `/ ${limit}` : 'uses'}
            </span>
            {limit && (
              <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cx(
                    'h-full rounded-full transition-all',
                    percent && percent >= 90 ? 'bg-rose-500' : 'bg-blue-600'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'expiry',
      header: 'Expiry Date',
      cell: (coupon) => {
        if (!coupon.expiry_date) return <span className="text-xs text-slate-400">Never expires</span>;
        const isExpired = new Date(`${coupon.expiry_date}T23:59:59.999Z`) < new Date();
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className={isExpired ? 'font-semibold text-rose-600 line-through' : 'text-slate-700'}>
              {new Date(coupon.expiry_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
            {isExpired && <Badge tone="danger" className="text-[10px]">Expired</Badge>}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      cell: (coupon) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(coupon)}
          className="cursor-pointer rounded-full focus-visible:outline-none"
        >
          <Badge tone={coupon.is_active ? 'success' : 'neutral'}>
            <span className={cx('h-1.5 w-1.5 rounded-full mr-1.5', coupon.is_active ? 'bg-emerald-500' : 'bg-slate-400')} />
            {coupon.is_active ? 'Active' : 'Disabled'}
          </Badge>
        </button>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (coupon) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton label={`Edit ${coupon.code}`} onClick={() => handleOpenEdit(coupon)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Delete ${coupon.code}`} tone="danger" onClick={() => setPendingDelete(coupon)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & Discounts"
        description="Create promotional promo codes, flat or percentage discounts, minimum cart values, and track live customer redemptions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadCoupons} icon={<RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />}>
              Refresh
            </Button>
            <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="h-4 w-4" />}>
              Create Coupon
            </Button>
          </div>
        }
      />

      {toastMessage && <Toast message={toastMessage} tone={toastTone} onClose={() => setToastMessage(null)} />}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Coupons"
          value={coupons.length}
          icon={<Tag className="h-5 w-5 text-blue-600" />}
          tone="default"
        />
        <StatCard
          label="Active & Available"
          value={activeCount}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          tone="success"
        />
        <StatCard
          label="Total Redemptions"
          value={totalUses}
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          tone="default"
        />
      </div>

      {/* Main Table Card */}
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-72">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by code (e.g. WELCOME)..."
            />
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {(['all', 'active', 'inactive'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={cx(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer',
                  statusFilter === tab
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <EmptyState
            title="No coupons found"
            description={searchQuery ? 'Try changing your search term.' : 'Create your first promo code to boost conversions.'}
            action={
              <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="h-4 w-4" />}>
                Create Coupon
              </Button>
            }
          />
        ) : (
          <DataTable rows={filteredCoupons} columns={columns} rowKey={(c) => c.id} />
        )}
      </Card>

      {/* Create / Edit Coupon Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        title={editingCouponId ? 'Edit Coupon' : 'Create New Coupon'}
        subtitle={
          editingCouponId
            ? 'Update discount terms or limit rules.'
            : 'New promo codes become redeemable at checkout as soon as saved.'
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="coupon-form"
              disabled={isSaving}
              icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {editingCouponId ? 'Save changes' : 'Create coupon'}
            </Button>
          </div>
        }
      >
        <form id="coupon-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {formError}
            </p>
          )}

          <div>
            <Label htmlFor="coupon-code">Coupon Code (Promo Code)</Label>
            <Input
              id="coupon-code"
              required
              value={couponForm.code}
              onChange={(e) => setCouponForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. WELCOME200, FESTIVE15, DIWALI50"
              className="font-mono uppercase font-bold tracking-wider"
            />
            <p className="mt-1 text-[11px] text-slate-400">Buyers type this uppercase code at checkout to claim the discount.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="discount-type">Discount Type</Label>
              <select
                id="discount-type"
                value={couponForm.discount_type}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, discount_type: e.target.value as 'flat' | 'percentage' }))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="flat">Flat Amount Off (₹)</option>
                <option value="percentage">Percentage Off (%)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="discount-val">
                {couponForm.discount_type === 'flat' ? 'Discount Amount (₹)' : 'Discount Rate (%)'}
              </Label>
              <Input
                id="discount-val"
                type="number"
                min={1}
                required
                value={couponForm.discount_value}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, discount_value: Number(e.target.value) }))}
                placeholder={couponForm.discount_type === 'flat' ? 'e.g. 200' : 'e.g. 15'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="min-order">Min Order Amount (₹)</Label>
              <Input
                id="min-order"
                type="number"
                min={0}
                value={couponForm.min_order_amount}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, min_order_amount: Number(e.target.value) }))}
                placeholder="e.g. 1000"
              />
              <p className="mt-1 text-[11px] text-slate-400">Cart subtotal required before coupon applies (0 for none).</p>
            </div>
            <div>
              <Label htmlFor="max-discount">Max Discount Cap (₹)</Label>
              <Input
                id="max-discount"
                type="number"
                min={0}
                value={couponForm.max_discount}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, max_discount: e.target.value }))}
                placeholder="Optional (e.g. 500)"
              />
              <p className="mt-1 text-[11px] text-slate-400">Limits maximum discount given on large percentage orders.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="usage-limit">Total Usage Limit</Label>
              <Input
                id="usage-limit"
                type="number"
                min={1}
                value={couponForm.usage_limit}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, usage_limit: Number(e.target.value) }))}
                placeholder="e.g. 100"
              />
              <p className="mt-1 text-[11px] text-slate-400">Global redemptions allowed across all customers.</p>
            </div>
            <div>
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={couponForm.expiry_date}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
              />
              <p className="mt-1 text-[11px] text-slate-400">Leave blank for a permanent ongoing code.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
              <span>First Order Only</span>
              <input
                type="checkbox"
                checked={couponForm.first_order_only}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, first_order_only: e.target.checked }))}
                className="h-4 w-4 rounded text-blue-600 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
              <span>Active Status (Ready to redeem)</span>
              <input
                type="checkbox"
                checked={couponForm.is_active}
                onChange={(e) => setCouponForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded text-blue-600 cursor-pointer"
              />
            </label>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {pendingDelete && (
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          onClose={() => setPendingDelete(null)}
          title={`Delete coupon "${pendingDelete.code}"?`}
          description="Shoppers will no longer be able to apply this code at checkout. This cannot be undone."
          confirmLabel="Delete coupon"
          confirmTone="danger"
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

export default AdminCouponsPage;
