import React from 'react';

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export const CARD = 'bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children
}) => <div className={cx(CARD, className)}>{children}</div>;

/* ------------------------------------------------------------------ *
 * Badge — one tone per meaning, used everywhere status is shown
 * ------------------------------------------------------------------ */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';

const TONE_STYLES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200'
};

export const Badge: React.FC<{
  tone?: Tone;
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone = 'neutral', className, icon, children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      TONE_STYLES[tone],
      className
    )}
  >
    {icon}
    {children}
  </span>
);

/* ------------------------------------------------------------------ *
 * Button — taller targets on touch, tighter on desktop
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-transparent shadow-[0_1px_2px_rgba(37,99,235,0.25)]',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'h-9 sm:h-8 px-3 text-xs gap-1.5',
  md: 'h-10 sm:h-9 px-4 text-[13px] gap-2'
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}) => (
  <button
    type="button"
    {...rest}
    className={cx(
      'inline-flex items-center justify-center rounded-xl font-semibold transition-colors cursor-pointer',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1',
      VARIANT_STYLES[variant],
      SIZE_STYLES[size],
      className
    )}
  >
    {icon}
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Form controls
 * ------------------------------------------------------------------ */

const FIELD_BASE =
  'w-full rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 ' +
  'transition-colors focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...rest }) => (
  <input {...rest} className={cx(FIELD_BASE, 'h-10 sm:h-9 px-3', className)} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...rest }) => (
  <select {...rest} className={cx(FIELD_BASE, 'h-10 sm:h-9 px-3 font-medium cursor-pointer', className)} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={cx(FIELD_BASE, 'px-3 py-2.5 resize-none', className)} />
);

export const Label: React.FC<{ htmlFor?: string; className?: string; children: React.ReactNode }> = ({
  htmlFor,
  className,
  children
}) => (
  <label htmlFor={htmlFor} className={cx('block text-xs font-semibold text-slate-700 mb-1.5', className)}>
    {children}
  </label>
);

export const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon: React.ReactNode;
}> = ({ value, onChange, placeholder, className, icon }) => (
  <div className={cx('relative', className)}>
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cx(FIELD_BASE, 'h-10 sm:h-9 pl-9 pr-3')}
    />
  </div>
);

/* ------------------------------------------------------------------ *
 * Page header — identical rhythm on every admin screen
 * ------------------------------------------------------------------ */

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Keep actions beside the title on phones — for a single icon button */
  inlineActions?: boolean;
}> = ({ icon, title, description, actions, inlineActions = false }) => (
  <div className={cx(CARD, 'p-4 sm:p-5')}>
    <div
      className={cx(
        'flex gap-3 sm:flex-row sm:items-center sm:justify-between',
        inlineActions ? 'items-center justify-between' : 'flex-col'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] sm:text-lg font-semibold tracking-tight text-slate-900 leading-tight">{title}</h1>
          {description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 leading-relaxed">{description}</p>}
        </div>
      </div>
      {actions && (
        <div
          className={cx(
            'flex shrink-0 items-center gap-2',
            // Phones: a full-width action row where text buttons share the space and icon buttons stay square
            !inlineActions &&
              'border-t border-slate-100 pt-3 [&>*]:flex-1 [&>*]:justify-center [&>[title]]:flex-none sm:border-0 sm:pt-0 sm:[&>*]:flex-none'
          )}
        >
          {actions}
        </div>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * Stat card — KPI tile
 * ------------------------------------------------------------------ */

const STAT_ICON_TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600'
};

const STAT_VALUE_TONES: Record<Tone, string> = {
  neutral: 'text-slate-900',
  info: 'text-slate-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  violet: 'text-violet-600'
};

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  badge?: React.ReactNode;
}> = ({ label, value, icon, hint, tone = 'info', badge }) => (
  <div className={cx(CARD, 'min-w-0 p-3.5 sm:p-4')}>
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">{label}</span>
      <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', STAT_ICON_TONES[tone])}>{icon}</span>
    </div>
    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={cx(
          'text-xl font-bold tracking-tight tabular-nums sm:text-2xl',
          STAT_VALUE_TONES[value === 0 ? 'neutral' : tone]
        )}
      >
        {value}
      </span>
      {badge}
    </div>
    {hint && <p className="mt-1 truncate text-[11px] text-slate-400">{hint}</p>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Filter pills — scrollable on mobile, wrapped on desktop
 * ------------------------------------------------------------------ */

export const FilterTabs: React.FC<{
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ items, value, onChange, className }) => (
  <div
    className={cx(
      'flex items-center gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:pb-0',
      '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className
    )}
  >
    {items.map((item) => {
      const active = value === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active}
          className={cx(
            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors cursor-pointer sm:h-8',
            active
              ? 'bg-blue-600 text-white shadow-[0_2px_6px_rgba(37,99,235,0.3)]'
              : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <span className="whitespace-nowrap">{item.label}</span>
          {item.count !== undefined && (
            <span
              className={cx(
                'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">{icon}</span>
    <h4 className="mt-3 text-sm font-semibold text-slate-900">{title}</h4>
    {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Toast — bottom of the screen on phones, top-right on desktop
 * ------------------------------------------------------------------ */

export const Toast: React.FC<{ message: string | null; tone?: 'success' | 'danger' }> = ({
  message,
  tone = 'success'
}) =>
  message ? (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'fixed inset-x-4 bottom-28 z-[80] flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium text-white shadow-lg',
        'sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:max-w-sm',
        tone === 'success' ? 'bg-slate-900' : 'bg-rose-600'
      )}
    >
      <span
        className={cx(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full',
          tone === 'success' ? 'bg-emerald-500' : 'bg-white/20'
        )}
      >
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          {tone === 'success' ? (
            <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
          )}
        </svg>
      </span>
      <span className="min-w-0">{message}</span>
    </div>
  ) : null;

/* ------------------------------------------------------------------ *
 * Icon button — for dense row actions
 * ------------------------------------------------------------------ */

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' }
> = ({ label, tone = 'default', className, children, ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    {...rest}
    className={cx(
      'grid h-9 w-9 place-items-center rounded-lg border border-transparent text-slate-500 transition-colors cursor-pointer sm:h-8 sm:w-8',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      tone === 'danger'
        ? 'hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600'
        : 'hover:border-slate-200 hover:bg-white hover:text-slate-900',
      className
    )}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Checkbox — row selection; the padded label keeps the tap target large
 * ------------------------------------------------------------------ */

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Some but not all rows selected (header "select all" box) */
  indeterminate?: boolean;
  className?: string;
}> = ({ checked, onChange, label, indeterminate = false, className }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={cx('-m-2 inline-grid shrink-0 cursor-pointer place-items-center p-2', className)}
    >
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      />
    </label>
  );
};

/* ------------------------------------------------------------------ *
 * Bulk action bar — floats above the list while rows are selected
 * ------------------------------------------------------------------ */

export const BulkActionBar: React.FC<{
  count: number;
  onClear: () => void;
  onDelete: () => void;
  busy?: boolean;
  deleteLabel?: string;
}> = ({ count, onClear, onDelete, busy = false, deleteLabel = 'Delete selected' }) =>
  count > 0 ? (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cx(
        'fixed inset-x-4 bottom-24 z-60 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-xl shadow-slate-900/20',
        'sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:min-w-88 lg:bottom-6'
      )}
    >
      <span className="text-[13px] font-semibold tabular-nums">{count} selected</span>
      <span className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy} className="text-slate-300 hover:bg-white/10 hover:text-white">
          Clear
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={onDelete}
          disabled={busy}
          className="bg-rose-600 hover:bg-rose-700 shadow-none"
          icon={
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          {busy ? 'Deleting…' : deleteLabel}
        </Button>
      </span>
    </div>
  ) : null;

/* ------------------------------------------------------------------ *
 * Pagination footer
 * ------------------------------------------------------------------ */

export const Pagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}> = ({ page, totalPages, total, pageSize, onChange }) => {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
      <p className="text-xs text-slate-500">
        <span className="font-semibold text-slate-700 tabular-nums">
          {start}–{end}
        </span>{' '}
        of <span className="tabular-nums">{total}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => onChange(page - 1)}>
            Previous
          </Button>
          <span className="px-1.5 text-xs font-medium text-slate-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="ghost" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Switch — bare toggle for inline use
 * ------------------------------------------------------------------ */

export const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  showLabel?: boolean;
}> = ({ checked, onChange, label, showLabel = false }) => (
  <label className="inline-flex cursor-pointer items-center gap-2">
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        aria-label={showLabel ? undefined : label}
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40" />
      <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </span>
    {showLabel && <span className="text-xs font-semibold text-slate-700">{label}</span>}
  </label>
);

/* ------------------------------------------------------------------ *
 * Switch field — for on/off settings in forms
 * ------------------------------------------------------------------ */

export const SwitchField: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  editable?: boolean;
  onEditLabel?: (newLabel: string) => void;
}> = ({ label, description, checked, onChange, editable, onEditLabel }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(label);

  React.useEffect(() => {
    setEditValue(label);
  }, [label]);

  const handleSave = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editValue.trim() && onEditLabel) {
      onEditLabel(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(label);
    setIsEditing(false);
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave(e);
                if (e.key === 'Escape') handleCancel(e as any);
              }}
              autoFocus
              className="w-full rounded-md border border-blue-400 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSave}
              title="Save name"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={handleCancel}
              title="Cancel"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-700 text-xs hover:bg-slate-300 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group/label">
            <span className="block text-[13px] font-semibold text-slate-800">{label}</span>
            {editable && onEditLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                title="Edit name"
                className="opacity-70 group-hover/label:opacity-100 hover:text-blue-600 transition-opacity p-0.5 rounded hover:bg-blue-50 text-slate-400 text-xs cursor-pointer"
              >
                ✏️
              </button>
            )}
          </div>
        )}
        {description && <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{description}</span>}
      </div>
      <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </label>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Inline alert / toast banner
 * ------------------------------------------------------------------ */

export const Alert: React.FC<{
  tone: 'success' | 'danger';
  children: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone, children, icon, onDismiss }) => (
  <div
    role="status"
    className={cx(
      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] font-medium',
      tone === 'success'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-rose-50 text-rose-800 border-rose-200'
    )}
  >
    <span className="flex min-w-0 items-center gap-2">
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/50 cursor-pointer"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </button>
    )}
  </div>
);
