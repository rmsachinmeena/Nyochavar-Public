import React, { useState, useEffect, useMemo } from 'react';
import {
  Bike,
  Plus,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  CheckCircle2,
  Pencil,
  KeyRound,
  Trash2,
  ExternalLink,
  Users,
  Navigation,
  Coffee,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../../../services/api';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterTabs,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
  Switch,
  SwitchField,
  Toast,
  cx,
  useRowSelection
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  city?: string;
  assigned_area?: string;
  is_active?: boolean;
  duty_status?: 'on_duty' | 'on_leave';
  /** Current 4-digit login PIN (null until one is issued) */
  login_pin?: string | null;
  created_at?: string;
}

type Filter = 'all' | 'on_duty' | 'on_leave' | 'inactive';

const isOnDuty = (r: DeliveryPartner) => r.is_active !== false && r.duty_status !== 'on_leave';

const EMPTY_FORM = {
  name: '',
  phone: '',
  city: 'Ajmer',
  assigned_area: '',
  is_active: true,
  duty_status: 'on_duty' as 'on_duty' | 'on_leave'
};

export const AdminRidersPage: React.FC = () => {
  const [riders, setRiders] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingRider, setEditingRider] = useState<DeliveryPartner | null>(null);
  const [deletingRider, setDeletingRider] = useState<DeliveryPartner | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [resettingRider, setResettingRider] = useState<DeliveryPartner | null>(null);
  /** PIN dialog: `fresh` means it was just generated, otherwise the admin is viewing the current PIN */
  const [issuedPin, setIssuedPin] = useState<{ id: string; name: string; pin: string; fresh: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  /** Which rider PINs the admin has masked (PINs are shown by default) */
  const [hiddenPins, setHiddenPins] = useState<Record<string, boolean>>({});
  /** Riders whose account toggle is waiting on the server */
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({});
  /** Which rider PINs were just copied (for checkmark feedback) */
  const [copiedPins, setCopiedPins] = useState<Record<string, boolean>>({});

  const flash = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), type === 'success' ? 3000 : 4000);
  };

  const fetchRiders = async () => {
    setLoading(true);
    try {
      const data = await api.getAllDeliveryPartners();
      setRiders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch delivery partners:', err);
      flash('error', err.message || 'Failed to load delivery partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const metrics = useMemo(() => {
    const total = riders.length;
    const onDuty = riders.filter(isOnDuty).length;
    const onLeave = riders.filter((r) => r.duty_status === 'on_leave').length;
    const inactive = riders.filter((r) => r.is_active === false).length;
    const areasCount = new Set(riders.map((r) => r.assigned_area).filter(Boolean)).size;
    return { total, onDuty, onLeave, inactive, areasCount };
  }, [riders]);

  const filteredRiders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return riders.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.assigned_area && r.assigned_area.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'on_duty' && isOnDuty(r)) ||
        (statusFilter === 'on_leave' && r.duty_status === 'on_leave') ||
        (statusFilter === 'inactive' && r.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }, [riders, searchQuery, statusFilter]);

  // Multi-select works on the riders currently shown (this filter / search)
  const selection = useRowSelection(filteredRiders.map((r) => r.id));

  const closeForm = () => {
    setIsAddModalOpen(false);
    setEditingRider(null);
    setFormError(null);
  };

  const handleOpenAdd = () => {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (rider: DeliveryPartner) => {
    setEditingRider(rider);
    setFormError(null);
    setFormData({
      name: rider.name,
      phone: rider.phone,
      city: rider.city || 'Ajmer',
      assigned_area: rider.assigned_area || '',
      is_active: rider.is_active !== false,
      duty_status: rider.duty_status || 'on_duty'
    });
  };

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      setFormError('Name and phone number are required.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingRider) {
        await api.updateDeliveryPartner(editingRider.id, formData);
        setRiders((prev) => prev.map((r) => (r.id === editingRider.id ? { ...r, ...formData } : r)));
        flash('success', `${formData.name} updated`);
      } else {
        const created = await api.createDeliveryPartner(formData);
        if (created) {
          setRiders((prev) => [created, ...prev]);
        } else {
          await fetchRiders();
        }
        flash('success', `${formData.name} added to the fleet`);
      }
      closeForm();
    } catch (err: any) {
      console.error('Failed to save rider:', err);
      setFormError(err.message || 'Could not save this rider. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (rider: DeliveryPartner, newStatus: boolean) => {
    if (togglingIds[rider.id]) return;
    setTogglingIds((prev) => ({ ...prev, [rider.id]: true }));
    try {
      const updated = await api.updateDeliveryPartner(rider.id, { is_active: newStatus });
      setRiders((prev) =>
        prev.map((r) =>
          r.id === rider.id
            ? { ...r, is_active: newStatus, duty_status: updated?.duty_status ?? r.duty_status }
            : r
        )
      );
      flash('success', `${rider.name}'s account ${newStatus ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      flash('error', err.message || 'Could not update status');
    } finally {
      setTogglingIds((prev) => ({ ...prev, [rider.id]: false }));
    }
  };

  const handleToggleDutyStatus = async (rider: DeliveryPartner) => {
    const newDuty = rider.duty_status === 'on_leave' ? 'on_duty' : 'on_leave';
    try {
      await api.updateDeliveryPartner(rider.id, { duty_status: newDuty });
      setRiders((prev) => prev.map((r) => (r.id === rider.id ? { ...r, duty_status: newDuty } : r)));
      flash('success', `${rider.name} is now ${newDuty === 'on_duty' ? 'on duty' : 'on leave'}`);
    } catch (err: any) {
      flash('error', err.message || 'Could not update duty status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRider) return;
    const rider = deletingRider;
    setDeletingRider(null);
    try {
      await api.deleteDeliveryPartner(rider.id);
      setRiders((prev) => prev.filter((r) => r.id !== rider.id));
      flash('success', `${rider.name} removed from the fleet`);
    } catch (err: any) {
      flash('error', err.message || 'Could not remove rider');
    }
  };

  const handleDeleteSelectedConfirm = async () => {
    const ids = [...selection.selected];
    setConfirmBulkDelete(false);
    setBulkDeleting(true);
    try {
      const { deleted } = await api.bulkDelete('delivery-partners', ids);
      const removed = new Set(ids);
      setRiders((prev) => prev.filter((r) => !removed.has(r.id)));
      selection.clear();
      flash('success', `${deleted} ${deleted === 1 ? 'rider' : 'riders'} removed from the fleet`);
    } catch (err: any) {
      flash('error', err.message || 'Could not remove the selected riders');
    } finally {
      setBulkDeleting(false);
    }
  };

  // A new 4-digit PIN replaces the old one and signs the rider out everywhere
  const handleResetPinConfirm = async () => {
    if (!resettingRider) return;
    const rider = resettingRider;
    setResettingRider(null);
    try {
      const pin = await api.resetRiderPin(rider.id);
      setRiders((prev) => prev.map((r) => (r.id === rider.id ? { ...r, login_pin: pin } : r)));
      setHiddenPins((prev) => ({ ...prev, [rider.id]: false }));
      setIssuedPin({ id: rider.id, name: rider.name, pin, fresh: true });
    } catch (err: any) {
      flash('error', err.message || 'Could not reset PIN');
    }
  };

  const handleCopyPin = (riderId: string, pin: string) => {
    navigator.clipboard.writeText(pin).catch(() => {});
    setCopiedPins((prev) => ({ ...prev, [riderId]: true }));
    setTimeout(() => setCopiedPins((prev) => ({ ...prev, [riderId]: false })), 2000);
  };

  const toggleHidePin = (riderId: string) => {
    setHiddenPins((prev) => ({ ...prev, [riderId]: !prev[riderId] }));
  };

  // Key button: show the current PIN, or offer to issue one if the rider has none yet
  const openPin = (rider: DeliveryPartner) => {
    if (rider.login_pin) setIssuedPin({ id: rider.id, name: rider.name, pin: rider.login_pin, fresh: false });
    else setResettingRider(rider);
  };

  const dutyToggle = (rider: DeliveryPartner) => {
    const onDuty = rider.duty_status !== 'on_leave';
    return (
      <button
        type="button"
        onClick={() => handleToggleDutyStatus(rider)}
        title={onDuty ? 'Mark as on break' : 'Mark as on duty'}
        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
      >
        <Badge tone={onDuty ? 'success' : 'danger'}>
          <span className={cx('h-1.5 w-1.5 rounded-full', onDuty ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')} />
          {onDuty ? 'On duty' : 'Rider on break'}
        </Badge>
      </button>
    );
  };

  const accountToggle = (rider: DeliveryPartner) => {
    const active = rider.is_active !== false;
    const busy = Boolean(togglingIds[rider.id]);
    return (
      <div
        title={active ? 'Disable this account' : 'Enable this account'}
        className={cx('inline-flex items-center gap-2', busy && 'pointer-events-none opacity-60')}
      >
        <Switch
          checked={active}
          onChange={(checked) => handleToggleStatus(rider, checked)}
          label={`${active ? 'Disable' : 'Enable'} ${rider.name}'s account`}
        />
        <span className={cx('w-14 text-left text-xs font-semibold', active ? 'text-emerald-600' : 'text-rose-600')}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : active ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    );
  };

  /** PIN chip shown inline — visible by default, the eye button masks it */
  const PinChip = ({ rider }: { rider: DeliveryPartner }) => {
    const pin = rider.login_pin;
    if (!pin) {
      return (
        <button
          type="button"
          onClick={() => setResettingRider(rider)}
          title="Generate a 4-digit PIN for this rider"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 transition hover:border-violet-400 hover:text-violet-600"
        >
          <KeyRound className="h-3 w-3" />
          Issue PIN
        </button>
      );
    }
    const revealed = !hiddenPins[rider.id];
    const copied = copiedPins[rider.id];
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 py-0.5 pl-2.5 pr-1">
        <KeyRound className="h-3 w-3 text-violet-500 shrink-0" />
        <span className="w-11 text-center font-mono text-[13px] font-bold tracking-widest text-violet-700 select-all">
          {revealed ? pin : '••••'}
        </span>
        <button
          type="button"
          onClick={() => toggleHidePin(rider.id)}
          title={revealed ? 'Hide PIN' : 'Show PIN'}
          aria-label={revealed ? 'Hide PIN' : 'Show PIN'}
          className="ml-0.5 grid h-7 w-7 place-items-center rounded-full text-violet-400 transition hover:bg-violet-100 hover:text-violet-700 sm:h-5 sm:w-5"
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5 sm:h-3 sm:w-3" /> : <Eye className="h-3.5 w-3.5 sm:h-3 sm:w-3" />}
        </button>
        <button
          type="button"
          onClick={() => handleCopyPin(rider.id, pin)}
          title="Copy PIN"
          aria-label="Copy PIN"
          className="grid h-7 w-7 place-items-center rounded-full text-violet-400 transition hover:bg-violet-100 hover:text-violet-700 sm:h-5 sm:w-5"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </span>
    );
  };

  const cardIconClass =
    'grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900';

  const columns: DataColumn<DeliveryPartner>[] = [
    {
      key: 'rider',
      header: 'Rider',
      mobile: 'title',
      cell: (rider, layout) => (
        <div className={cx('flex min-w-0 items-center', layout === 'card' ? 'gap-2.5' : 'gap-3')}>
          <span
            className={cx(
              'grid shrink-0 place-items-center rounded-full font-semibold',
              layout === 'card' ? 'h-9 w-9 text-[13px]' : 'h-10 w-10 text-sm',
              rider.is_active === false ? 'bg-slate-100 text-slate-400' : 'bg-violet-50 text-violet-700'
            )}
          >
            {rider.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="truncate text-[13px] font-semibold text-slate-900">{rider.name}</p>
              {rider.duty_status === 'on_leave' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Rider on break
                </span>
              )}
            </div>
            {layout === 'card' && (
              <p className="flex items-center gap-1 truncate text-[11px] font-normal text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {rider.city || 'Ajmer'}
                  {rider.assigned_area ? ` · ${rider.assigned_area}` : ''}
                </span>
              </p>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'duty-card',
      header: 'Availability',
      mobile: 'aside',
      only: 'card',
      cell: dutyToggle
    },
    {
      // Phone card: one compact row — account switch, PIN, then quick actions
      key: 'card-controls',
      header: 'Controls',
      mobile: 'block',
      only: 'card',
      cell: (rider) => {
        const active = rider.is_active !== false;
        return (
          <div className="flex items-center gap-2">
            <div className={cx('flex items-center gap-1.5', togglingIds[rider.id] && 'pointer-events-none opacity-60')}>
              <Switch
                checked={active}
                onChange={(checked) => handleToggleStatus(rider, checked)}
                label={`${active ? 'Disable' : 'Enable'} ${rider.name}'s account`}
              />
              {!active && <span className="text-[11px] font-semibold text-rose-600">Off</span>}
            </div>
            <button
              type="button"
              onClick={() => openPin(rider)}
              title={rider.login_pin ? 'Show PIN' : 'Issue a login PIN'}
              className={cx(
                'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition',
                rider.login_pin
                  ? 'border-violet-200 bg-violet-50 font-mono font-bold tracking-widest text-violet-700 hover:bg-violet-100'
                  : 'border-dashed border-slate-300 font-medium text-slate-500 hover:border-violet-400 hover:text-violet-600'
              )}
            >
              <KeyRound className="h-3 w-3 shrink-0" />
              {rider.login_pin ? '••••' : 'Set PIN'}
            </button>
            <div className="ml-auto flex items-center">
              <a href={`tel:${rider.phone}`} aria-label={`Call ${rider.name}`} title="Call" className={cardIconClass}>
                <Phone className="h-4 w-4" />
              </a>
              <button type="button" aria-label={`Edit ${rider.name}`} title="Edit" onClick={() => handleOpenEdit(rider)} className={cardIconClass}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${rider.name}`}
                title="Remove"
                onClick={() => setDeletingRider(rider)}
                className={cx(cardIconClass, 'hover:bg-rose-50 hover:text-rose-600')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      }
    },
    {
      key: 'phone',
      header: 'Phone',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (rider) => (
        <a
          href={`tel:${rider.phone}`}
          className="inline-flex items-center gap-1.5 font-medium tabular-nums text-slate-700 hover:text-blue-600"
        >
          <Phone className="h-3.5 w-3.5 text-slate-400" />
          {rider.phone}
        </a>
      )
    },
    {
      key: 'area',
      header: 'Area',
      only: 'table',
      cell: (rider) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{rider.city || 'Ajmer'}</p>
          {rider.assigned_area && (
            <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500">{rider.assigned_area}</p>
          )}
        </div>
      )
    },
    {
      key: 'pin',
      header: (
        <span className="flex items-center gap-1">
          <KeyRound className="h-3 w-3" /> Login PIN
        </span>
      ),
      align: 'center',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (rider) => <PinChip rider={rider} />
    },
    {
      key: 'duty',
      header: 'Availability',
      align: 'center',
      only: 'table',
      cell: dutyToggle
    },
    {
      key: 'account',
      header: 'Account',
      align: 'center',
      only: 'table',
      cell: accountToggle
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      only: 'table',
      cell: (rider) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={`Edit ${rider.name}`} onClick={() => handleOpenEdit(rider)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label={rider.login_pin ? `Show PIN for ${rider.name}` : `Issue PIN for ${rider.name}`} onClick={() => openPin(rider)}>
            <KeyRound className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Remove ${rider.name}`} tone="danger" onClick={() => setDeletingRider(rider)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <Toast message={feedback?.text ?? null} tone={feedback?.type === 'error' ? 'danger' : 'success'} />

      <PageHeader
        icon={<Bike className="h-5 w-5" />}
        title="Delivery riders"
        description="Your delivery fleet, their areas and who's available for dispatch today."
        actions={
          <>
            <a
              href="/rider"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:h-9"
            >
              Rider portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <IconButton label="Refresh riders" onClick={fetchRiders} className="border-slate-200 bg-white">
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="h-4 w-4" />}>
              Add rider
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total riders" value={metrics.total} icon={<Users className="h-3.5 w-3.5" />} hint="Onboarded partners" />
        <StatCard
          label="On duty"
          value={metrics.onDuty}
          tone="success"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          hint="Available for dispatch"
        />
        <StatCard
          label="Rider on break"
          value={metrics.onLeave}
          tone="danger"
          icon={<Coffee className="h-3.5 w-3.5 text-rose-600" />}
          hint={metrics.onLeave > 0 ? 'Off-duty (Cannot assign orders)' : 'All active riders ready'}
        />
        <StatCard
          label="Coverage areas"
          value={metrics.areasCount}
          tone="neutral"
          icon={<Navigation className="h-3.5 w-3.5" />}
          hint="Distinct assigned areas"
        />
      </div>

      {/* Small Red Alert Card when any rider is on break */}
      {metrics.onLeave > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
            </span>
            <div>
              <p className="font-bold">
                {metrics.onLeave} {metrics.onLeave === 1 ? 'Rider on break' : 'Riders on break'} (Offline)
              </p>
              <p className="text-[11px] text-rose-700">
                System prevents order assignments to riders on break until they switch back to On Duty.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('on_leave')}
            className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 shadow-xs hover:bg-rose-100 transition cursor-pointer"
          >
            Filter on break
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <FilterTabs
            value={statusFilter}
            onChange={(id) => setStatusFilter(id as Filter)}
            items={[
              { id: 'all', label: 'All riders', count: metrics.total },
              { id: 'on_duty', label: 'On duty', count: metrics.onDuty },
              { id: 'on_leave', label: 'On break', count: metrics.onLeave },
              { id: 'inactive', label: 'Disabled', count: metrics.inactive }
            ]}
          />
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, phone or area…"
            icon={<Search className="h-3.5 w-3.5" />}
            className="sm:max-w-sm"
          />
        </div>

        <DataTable
          columns={columns}
          rows={filteredRiders}
          rowKey={(r) => r.id}
          selectedKeys={selection.selected}
          onSelectionChange={selection.setSelected}
          selectLabel={(r) => r.name}
          loading={loading && riders.length === 0}
          loadingLabel="Loading your delivery fleet…"
          empty={
            <EmptyState
              icon={<Bike className="h-6 w-6" />}
              title={searchQuery || statusFilter !== 'all' ? 'No matching riders' : 'No riders yet'}
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Add your first delivery partner to start dispatching orders.'
              }
              action={
                !searchQuery && statusFilter === 'all' ? (
                  <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="h-4 w-4" />}>
                    Add rider
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <Modal
        open={isAddModalOpen || Boolean(editingRider)}
        onClose={closeForm}
        title={editingRider ? 'Edit rider' : 'Add a delivery partner'}
        subtitle={
          editingRider ? 'Update contact details or assigned area.' : 'They sign in to the rider portal with this phone number.'
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="rider-form"
              disabled={actionLoading}
              icon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {editingRider ? 'Save changes' : 'Add rider'}
            </Button>
          </div>
        }
      >
        <form id="rider-form" onSubmit={handleSaveRider} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {formError}
            </p>
          )}

          <div>
            <Label htmlFor="rider-name">Full name</Label>
            <Input
              id="rider-name"
              required
              autoComplete="off"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
            />
          </div>

          <div>
            <Label htmlFor="rider-phone">Mobile number</Label>
            <Input
              id="rider-phone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="off"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 98765 43219"
              className="tabular-nums"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rider-city">City</Label>
              <Input
                id="rider-city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Ajmer"
              />
            </div>
            <div>
              <Label htmlFor="rider-area">Area</Label>
              <Input
                id="rider-area"
                value={formData.assigned_area}
                onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                placeholder="e.g. Pushkar Road"
              />
            </div>
          </div>

          <SwitchField
            label="Account enabled"
            description="Allow this rider to sign in and receive orders"
            checked={formData.is_active}
            onChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(resettingRider)}
        title="Issue a new login PIN?"
        message={
          <>
            <span className="font-semibold text-slate-900">{resettingRider?.name}</span> will be signed out everywhere and must use the
            new PIN to sign in.
          </>
        }
        confirmLabel="Generate PIN"
        onConfirm={handleResetPinConfirm}
        onCancel={() => setResettingRider(null)}
      />

      <Modal
        open={Boolean(issuedPin)}
        onClose={() => setIssuedPin(null)}
        title={issuedPin?.fresh ? 'New login PIN' : 'Login PIN'}
        subtitle={`${issuedPin?.name ?? 'Rider'} signs in to the rider portal with their phone number and this PIN.`}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => {
                const rider = riders.find((r) => r.id === issuedPin?.id);
                setIssuedPin(null);
                if (rider) setResettingRider(rider);
              }}
            >
              New PIN
            </Button>
            <Button variant="primary" onClick={() => setIssuedPin(null)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3">
          <p className="w-full rounded-2xl border border-violet-200 bg-violet-50 py-6 text-center font-mono text-4xl font-bold tracking-[0.5em] text-violet-700 select-all">
            {issuedPin?.pin}
          </p>
          <button
            type="button"
            onClick={() => issuedPin && handleCopyPin(`modal-${issuedPin.id}`, issuedPin.pin)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {issuedPin && copiedPins[`modal-${issuedPin.id}`] ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy PIN
              </>
            )}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingRider)}
        title="Remove this rider?"
        message={
          <>
            <span className="font-semibold text-slate-900">{deletingRider?.name}</span> will lose access to the rider
            portal and can't be assigned new orders.
          </>
        }
        confirmLabel="Remove rider"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingRider(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Remove ${selection.selected.size} ${selection.selected.size === 1 ? 'rider' : 'riders'}?`}
        message="The selected riders will be deleted, signed out of the rider portal and can't be assigned new orders. This can't be undone."
        confirmLabel="Remove selected"
        onConfirm={handleDeleteSelectedConfirm}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <BulkActionBar
        count={selection.selected.size}
        busy={bulkDeleting}
        deleteLabel="Remove selected"
        onClear={selection.clear}
        onDelete={() => setConfirmBulkDelete(true)}
      />
    </div>
  );
};

export default AdminRidersPage;
