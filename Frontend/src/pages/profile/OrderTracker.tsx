import React from 'react';
import { CheckCircle2, Clock, Package, ShoppingBag, Truck, XCircle, AlertTriangle } from 'lucide-react';

interface TrackerOrder {
  order_status?: string | null;
  created_at?: string | null;
  assigned_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  delivery_partner_name?: string | null;
  delivery_issue?: 'failed' | 'reschedule' | null;
  delivery_date?: string | null;
  delivery_slot?: string | null;
}

const STEPS = [
  { key: 'placed', label: 'Placed', icon: ShoppingBag },
  { key: 'processing', label: 'Preparing', icon: Package },
  { key: 'out_for_delivery', label: 'On the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const;

const formatTime = (iso?: string | null) => {
  const time = iso ? new Date(iso) : null;
  if (!time || Number.isNaN(time.getTime())) return '';
  return `${time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};

// "2026-10-24" -> "Sat, 24 Oct"
const formatDay = (value?: string | null) => {
  const day = value ? new Date(`${value}T00:00:00`) : null;
  if (!day || Number.isNaN(day.getTime())) return value || '';
  return day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

// "Morning (9 AM – 12 PM)" -> "12 PM": the time the slot ends, so the shopper knows when it will have arrived
const slotEnd = (slot?: string | null) => {
  const times = [...String(slot || '').matchAll(/(d{1,2}(?::d{2})?)s*(AM|PM)/gi)];
  const last = times[times.length - 1];
  return last ? `${last[1]} ${last[2].toUpperCase()}` : '';
};

const statusSentence = (order: TrackerOrder, index: number) => {
  if (index === 0) return 'We have received your order and are getting it ready.';
  if (index === 1) {
    return order.delivery_partner_name
      ? `${order.delivery_partner_name} is assigned and will pick up your gift soon.`
      : 'Your gift is being hand-finished with care.';
  }
  if (index === 2) return 'Your gift is on its way. Share the delivery code with the rider only at handover.';
  return 'Delivered. We hope they loved it!';
};

/** A progress timeline for one order: placed, preparing, on the way, delivered. */
export const OrderTracker: React.FC<{ order: TrackerOrder }> = ({ order }) => {
  const status = order.order_status || 'placed';

  if (status === 'cancelled') {
    return (
      <div className="my-3 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
          <XCircle className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-rose-800">Order cancelled</p>
          <p className="text-xs text-rose-600">This order will not be delivered.</p>
        </div>
      </div>
    );
  }

  // Paid online, but the bank has not confirmed yet: no timeline until the order really exists
  if (status === 'awaiting_payment') {
    return (
      <div className="my-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800">Confirming your payment</p>
          <p className="text-xs text-slate-600">
            We are waiting for your bank. If the payment goes through, this order is confirmed automatically; if not, it is
            cancelled and no money is taken.
          </p>
        </div>
      </div>
    );
  }

  const index = Math.max(0, STEPS.findIndex((step) => step.key === status));
  const delivered = index === STEPS.length - 1;
  const percent = (index / (STEPS.length - 1)) * 100;
  const times = [order.created_at, order.assigned_at, order.out_for_delivery_at, order.delivered_at];
  const end = slotEnd(order.delivery_slot);
  const expected = !delivered && order.delivery_date ? `${formatDay(order.delivery_date)}${end ? ` · before ${end}` : order.delivery_slot ? ` · ${order.delivery_slot}` : ''}` : '';

  return (
    <div className="my-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
      <div className="relative">
        {/* the line between the first and the last circle: grey track, coloured fill that grows with the order */}
        <div className="absolute left-[12.5%] right-[12.5%] top-[17px] h-1 rounded-full bg-slate-200" aria-hidden>
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${delivered ? 'bg-emerald-500' : 'bg-linear-to-r from-brand to-sky-400'}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-4" aria-label="Order progress">
          {STEPS.map((step, i) => {
            const done = i < index || (delivered && i === index);
            const current = i === index && !delivered;
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
                <span className="relative grid h-9 w-9 place-items-center">
                  {current && <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" aria-hidden />}
                  <span
                    className={`relative grid h-9 w-9 place-items-center rounded-full border-2 transition-colors duration-500 ${
                      done
                        ? delivered
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-brand bg-brand text-white'
                        : current
                          ? 'border-brand bg-white text-brand shadow-md shadow-brand/20'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                </span>
                <span className={`mt-2 text-[11px] font-bold leading-tight ${done || current ? 'text-ink' : 'text-slate-400'}`}>{step.label}</span>
                <span className="mt-0.5 min-h-3 text-[10px] leading-tight text-slate-400">{i <= index ? formatTime(times[i]) : ''}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={`mt-3.5 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${delivered ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50/70 text-slate-700'}`}>
        <p className="font-medium">{statusSentence(order, index)}</p>
        {expected && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="h-3 w-3 shrink-0" /> Expected: {expected}
          </p>
        )}
      </div>

      {order.delivery_issue && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="font-medium">
            {order.delivery_issue === 'failed'
              ? 'We could not complete the delivery. Our team will contact you shortly.'
              : 'Your delivery is being rescheduled. We will confirm the new time with you.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderTracker;
