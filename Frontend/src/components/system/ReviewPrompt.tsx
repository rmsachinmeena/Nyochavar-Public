import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, PackageCheck, Star, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LIVE_NOTIFICATION_EVENT } from '../../services/notificationService';

interface PendingReview {
  id: string;
  order_number?: string;
  items: { product_id: string; name: string; image: string | null }[];
}

const SKIPPED_KEY = 'petal_review_skipped';
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Loved it!'];
// The popup stays away from sign-in, checkout and the admin / rider areas
const QUIET_PATHS = /^\/(admin|rider|auth|sign|checkout)/;

const readSkipped = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SKIPPED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const rememberSkipped = (orderId: string) => {
  try {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...new Set([...readSkipped(), orderId])].slice(-50)));
  } catch {
    /* storage unavailable */
  }
};

/**
 * Asks the customer to rate an order once it is delivered: a small popup in the middle of the screen with the gift's
 * photo and name and a 5-star bar. Shown when the app opens and live when the "delivered" notification arrives.
 */
export const ReviewPrompt: React.FC = () => {
  const { loggedInUser } = useAuth();
  const { pathname } = useLocation();
  const userId = loggedInUser?.id;

  const [pending, setPending] = useState<PendingReview | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const order = await api.getPendingReview();
      if (order && !readSkipped().includes(order.id)) {
        setPending(order);
        setRating(0);
        setHover(0);
        setComment('');
        setError('');
        setDone(false);
      }
    } catch {
      /* a failed check just means no popup */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPending(null);
      return;
    }
    const timer = window.setTimeout(() => void load(), 1500);
    return () => window.clearTimeout(timer);
  }, [userId, load]);

  // The moment the order is delivered, the "delivered" notification arrives live
  useEffect(() => {
    if (!userId) return;
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<{ event_key?: string }>).detail;
      if (detail?.event_key === 'delivered') window.setTimeout(() => void load(), 800);
    };
    window.addEventListener(LIVE_NOTIFICATION_EVENT, onLive);
    return () => window.removeEventListener(LIVE_NOTIFICATION_EVENT, onLive);
  }, [userId, load]);

  const close = () => {
    if (pending && !done) rememberSkipped(pending.id);
    setPending(null);
  };

  const submit = async () => {
    if (!pending || rating < 1 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.submitOrderReview(pending.id, rating, comment.trim());
      setDone(true);
      window.setTimeout(() => setPending(null), 1800);
    } catch (err: any) {
      setError(err?.message || 'Could not save your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!pending || QUIET_PATHS.test(pathname)) return null;

  const shown = hover || rating;
  const first = pending.items[0];
  const names = pending.items.map((item) => item.name).join(', ');

  return (
    <div className="fixed inset-0 z-210 flex items-center justify-center bg-slate-900/50 p-5 animate-in fade-in duration-150" onClick={close}>
      <div
        role="dialog"
        aria-label="Rate your order"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl shadow-slate-900/20 animate-in zoom-in-95 duration-150"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <h3 className="mt-4 font-serif text-xl text-ink">Thank you!</h3>
            <p className="mt-1 text-sm text-slate-500">Your review helps other gift-givers.</p>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
              <PackageCheck className="h-3.5 w-3.5" /> Delivered
            </p>
            <h3 className="mt-1 pr-8 font-serif text-xl text-ink">How was your gift?</h3>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              {first?.image ? (
                <img src={first.image} alt={first.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white text-slate-300">
                  <PackageCheck className="h-7 w-7" />
                </span>
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{names}</p>
                {pending.order_number && <p className="mt-0.5 text-[11px] text-slate-500">Order {pending.order_number}</p>}
              </div>
            </div>

            <div className="mt-5 text-center">
              <div role="radiogroup" aria-label="Rating" className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    className="cursor-pointer p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 rounded-lg"
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`}
                      strokeWidth={1.6}
                    />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 h-5 text-sm font-medium text-slate-600">{RATING_WORDS[shown]}</p>
            </div>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell us more (optional)"
              className="mt-3 block w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />

            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={rating < 1 || submitting}
                onClick={() => void submit()}
                className="flex-1 rounded-full bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Submit review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewPrompt;
