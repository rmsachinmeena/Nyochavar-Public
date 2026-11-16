import { DELIVERY_AREAS, isDeliveryArea } from './deliveryAreas';
import { PickerSelect } from '../../components/ui/PickerSelect';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Lock,
  PenLine,
  ShoppingBag,
  Smartphone,
  Home,
  Building2,
  MapPin,
  Loader2,
  Tag,
  ShieldCheck,
  UserPlus,
  AlertCircle,
  PlusCircle,
  Save,
  Heart,
  Users,
  Trash2,
} from 'lucide-react';
import type { CartItem, UserAddress, Product } from '../../types';
import { useCart, useAuth } from '../../context';
import { api } from '../../services/api';
import { productService } from '../../services/productService';
import { paymentService, PaymentCancelledError } from '../../services/paymentService';
import type { PaymentConfig, SettledOrder } from '../../services/paymentService';
import { API_BASE_URL } from '../../services/apiConfig';
import { eventTracker } from '../../services/eventTracker';
import { useInView } from '../../hooks/useInView';
import { formatPrice } from '../../utils/format';
import { SafeImage } from '../../components/ui/SafeImage';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { LockedPhoneTag, PhoneVerifyControl, usePhoneVerification } from '../../components/auth/PhoneVerifyControl';

type DeliveryDay = 'today' | 'tomorrow' | 'later';
type PaymentMethod = 'upi' | 'card' | 'cod';

interface DeliveryDetails {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  gift_message?: string;
  delivery_instructions?: string;
}

interface AppliedCoupon {
  code: string;
  discount: number;
  /** Set for product-specific coupons, e.g. "on Customize Bottle" */
  note?: string;
}

interface PlacedOrder {
  number: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount?: number;
  appliedCoupon?: AppliedCoupon | null;
  total: number;
  details: DeliveryDetails;
  deliveryLabel: string;
  payment: PaymentMethod;
  gift_message?: string;
  delivery_instructions?: string;
}

const DELIVERY_SLOTS = [
  { id: 'morning', label: 'Morning', time: '9 AM – 12 PM', endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', time: '12 – 3 PM', endHour: 15 },
  { id: 'evening', label: 'Evening', time: '3 – 6 PM', endHour: 18 },
];

const PAYMENT_OPTIONS: { id: PaymentMethod; icon: LucideIcon; title: string; text: string; online: boolean }[] = [
  { id: 'upi', icon: Smartphone, title: 'UPI', text: 'Google Pay, PhonePe, Paytm and more', online: true },
  { id: 'cod', icon: Banknote, title: 'Cash on delivery', text: 'Pay when your gift arrives', online: false },
];

// Steps of an online payment, shown while we talk to the server (the payment window itself is Razorpay's)
type PaymentStage = 'preparing' | 'awaiting' | 'verifying' | null;

const ORDER_STEPS = ['Order placed', 'Being hand-finished', 'Out for delivery', 'Delivered'];

const INPUT =
  'block h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-ink shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:text-[15px]';
const CHOICE = 'rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40';
const CHOICE_ACTIVE = 'border-brand bg-brand-soft/60 ring-1 ring-brand';
const CHOICE_IDLE = 'border-slate-200 bg-white hover:border-slate-300';
const TERM = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400';

/** Orders can be booked for delivery from today up to this many days ahead (the server checks it too). */
const MAX_ADVANCE_DAYS = 7;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateInputValue = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const formatDay = (date: Date) => date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const formatShortDay = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Leave an hour of lead time so a same-day slot is never promised after it has effectively passed.
const isSlotOpenToday = (slot: (typeof DELIVERY_SLOTS)[number], now: Date) => now.getHours() < slot.endHour - 1;

function readSavedAddress(): DeliveryDetails {
  const empty: DeliveryDetails = { name: '', phone: '', address: '', city: '', pincode: '', gift_message: '', delivery_instructions: '' };
  try {
    const saved = JSON.parse(localStorage.getItem('petal_pen_selected_address') || 'null');
    if (!saved) return empty;
    return {
      name: saved.name ?? '',
      phone: saved.phone ?? '',
      address: saved.address_line ?? '',
      city: saved.city ?? '',
      pincode: saved.pincode ?? saved.zip_code ?? '',
      gift_message: '',
      delivery_instructions: '',
    };
  } catch {
    return empty;
  }
}

// The kind of address, shown as a small row of icons so it is easy to tell addresses apart
const ADDRESS_TYPES: { label: string; icon: LucideIcon }[] = [
  { label: 'Home', icon: Home },
  { label: 'Work', icon: Building2 },
  { label: 'Family', icon: Heart },
  { label: 'Friend', icon: Users },
  { label: 'Other', icon: MapPin },
];
const addressTypeIcon = (label?: string): LucideIcon => ADDRESS_TYPES.find((type) => type.label === label)?.icon ?? Home;

const CHECKOUT_DRAFT_KEY = 'petal_pen_checkout_draft';
const readCheckoutDraft = (): any | null => {
  try {
    return JSON.parse(localStorage.getItem(CHECKOUT_DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
};

// The handwritten note is short on purpose: at most 30 words
const NOTE_WORD_LIMIT = 30;
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
// Words are counted by the spaces between them, so typing stops for good at the limit: no 31st word, and no extra
// space or new line after the last one. Leading and repeated spaces are dropped.
const limitWords = (text: string, max: number) => {
  const cleaned = text.replace(/^\s+/, '').replace(/\s+/g, ' ');
  const words = cleaned.split(' ').filter(Boolean);
  return words.length < max ? cleaned : words.slice(0, max).join(' ');
};

const itemDetails = (item: CartItem) =>
  [item.variant?.name, item.selectedHue, item.palette, ...(item.addons ?? []).map((addon) => `+ ${addon.name}`)].filter(Boolean).join(' · ');

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  wrapperClassName?: string;
  /** A small button shown inside the input, on its right */
  trailing?: React.ReactNode;
  /** Marks the field red (a missed or wrong value) */
  invalid?: boolean;
}

const INVALID = 'border-red-500! ring-4 ring-red-500/10';

const Field: React.FC<FieldProps> = ({ id, label, hint, wrapperClassName = '', trailing, invalid, ...inputProps }) => (
  <div className={wrapperClassName}>
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
      {label}
    </label>
    {trailing ? (
      <div className="relative">
        <input id={id} aria-invalid={invalid || undefined} className={`${INPUT} pr-32 ${invalid ? INVALID : ''}`} {...inputProps} />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>
      </div>
    ) : (
      <input id={id} aria-invalid={invalid || undefined} className={`${INPUT} ${invalid ? INVALID : ''}`} {...inputProps} />
    )}
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

const CheckoutSection: React.FC<{ step: number; title: string; children: React.ReactNode }> = ({ step, title, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4">
    <div className="flex items-center gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{step}</span>
      <h2 className="font-serif text-base text-ink sm:text-lg">{title}</h2>
    </div>
    <div className="mt-3">{children}</div>
  </section>
);

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  onQuantityChange?: (id: string, delta: number) => void;
  onRemove?: (id: string) => void;
  appliedCoupon?: AppliedCoupon | null;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: () => void;
  couponError?: string | null;
  isValidatingCoupon?: boolean;
  onClearCouponError?: () => void;
  /** The "handwritten note included" strip (hidden on the first checkout step) */
  showNote?: boolean;
  /** The note the shopper wrote, shown in that strip */
  giftMessage?: string;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  items,
  subtotal,
  deliveryFee,
  total,
  onQuantityChange,
  onRemove,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  couponError,
  isValidatingCoupon,
  onClearCouponError,
  showNote = true,
  giftMessage
}) => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const [couponInput, setCouponInput] = useState('');

  // The summary sits inside the checkout <form>, and forms cannot nest: a coupon <form> made "Apply" submit the
  // whole checkout instead. So the coupon box is plain elements; the button and the Enter key apply the code.
  const handleApply = () => {
    if (!couponInput.trim() || isValidatingCoupon) return;
    if (onApplyCoupon) {
      onApplyCoupon(couponInput.trim());
      setCouponInput('');
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl text-ink">Order summary</h2>
        <span className="text-sm text-slate-500">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      <ul className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-3">
        {items.map((item) => {
          const detailText = itemDetails(item);
          return (
            <li key={item.id} className="mb-2.5 flex w-full min-w-0 max-w-68 items-start gap-3 rounded-xl border border-brand/20 bg-brand-soft/30 p-2.5 lg:max-w-none lg:p-2.5">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <SafeImage src={item.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] font-medium leading-snug text-ink">{item.name}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{formatPrice(item.price * item.quantity)}</p>
                {detailText && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{detailText}</p>}
                {onQuantityChange ? (
                  <div className="mt-2">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      min={1}
                      max={99}
                      onChange={(next) => {
                        const safeNext = Math.max(1, next);
                        onQuantityChange(item.id, safeNext - item.quantity);
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">Qty {item.quantity}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="text-ink">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Delivery</dt>
          <dd className={deliveryFee === 0 ? 'font-medium text-emerald-600' : 'text-ink'}>
            {deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
          </dd>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between font-medium text-emerald-600">
            <dt className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Coupon ({appliedCoupon.code})
            </dt>
            <dd>-{formatPrice(appliedCoupon.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="text-xl font-semibold text-ink">{formatPrice(total)}</dd>
        </div>
      </dl>

      {onApplyCoupon && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 border border-emerald-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Tag className="h-3.5 w-3.5" /> Coupon &ldquo;{appliedCoupon.code}&rdquo; applied{appliedCoupon.note ? ` ${appliedCoupon.note}` : ''}!
              </span>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="font-bold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Promo code (e.g. WELCOME200)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponError && onClearCouponError) onClearCouponError();
                    }}
                    onKeyDown={(e) => {
                      // Enter must apply the coupon, never submit the checkout form around it
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApply();
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 pl-8 pr-3 py-2.5 text-xs uppercase tracking-wider text-ink focus:border-brand focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!couponInput.trim() || isValidatingCoupon}
                  className="rounded-2xl bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isValidatingCoupon ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
              {couponError && (
                <p className="flex items-center gap-1 px-1 text-[11px] font-medium text-rose-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {couponError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showNote && (giftMessage?.trim() ? (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="font-semibold">
            Handwritten note <span className="font-normal text-amber-700">· {countWords(giftMessage)}/{NOTE_WORD_LIMIT} words</span>
          </p>
          <p className="mt-0.5 line-clamp-2 font-serif italic wrap-break-word">&ldquo;{giftMessage.trim()}&rdquo;</p>
        </div>
      </div>
      ) : (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand">
        <PenLine className="h-4 w-4 shrink-0" />A handwritten note is included with every gift.
      </p>
      ))}
    </div>
  );
};

const OrderConfirmation: React.FC<{ order: PlacedOrder }> = ({ order }) => {
  const payment = PAYMENT_OPTIONS.find((option) => option.id === order.payment);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:pt-12">
      <div className="text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 220 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600"
        >
          <CheckCircle2 className="h-10 w-10" strokeWidth={1.75} />
        </motion.span>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Order confirmed</p>
        <h1 className="mt-2 font-serif text-[32px] leading-tight text-ink sm:text-4xl">Thank you for your order</h1>
        <p className="mt-3 text-[15px] text-slate-500">
          Order <span className="font-semibold text-ink">#{order.number}</span> is being prepared with care.
        </p>
      </div>

      <ol className="relative mt-10 grid grid-cols-4">
        <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 bg-slate-100" />
        {ORDER_STEPS.map((label, index) => (
          <li key={label} className="relative flex flex-col items-center px-1 text-center">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ring-4 ring-white ${
                index === 0 ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {index === 0 ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
            </span>
            <span className={`mt-2 text-[11px] leading-tight sm:text-xs ${index === 0 ? 'font-semibold text-ink' : 'text-slate-500'}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <dl className="mt-10 grid gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 sm:grid-cols-2 sm:p-7">
        <div>
          <dt className={TERM}>Delivering to</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-ink">
            {order.details.name}
            <br />
            {order.details.address}, {order.details.city} {order.details.pincode}
          </dd>
        </div>
        <div>
          <dt className={TERM}>Arriving</dt>
          <dd className="mt-1.5 text-sm text-ink">{order.deliveryLabel}</dd>
        </div>
        <div>
          <dt className={TERM}>Payment</dt>
          <dd className="mt-1.5 text-sm text-ink">{payment?.title}{order.payment !== 'cod' ? ' · Paid online' : ' · Pay on delivery'}</dd>
        </div>
        <div>
          <dt className={TERM}>Order total</dt>
          <dd className="mt-1.5 text-sm font-semibold text-ink">{formatPrice(order.total)}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <OrderSummary
          items={order.items}
          subtotal={order.subtotal}
          deliveryFee={order.deliveryFee}
          total={order.total}
          appliedCoupon={order.appliedCoupon}
        />
      </div>

      {order.gift_message && (
        <div className="mt-6 rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-amber-50/20 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
            <PenLine className="h-4 w-4 text-amber-700" /> Complimentary Handwritten Note Card
          </div>
          <p className="mt-3 font-serif italic text-[15px] leading-relaxed text-slate-800 bg-white/80 p-4 rounded-2xl border border-amber-100 shadow-inner">
            &ldquo;{order.gift_message}&rdquo;
          </p>
        </div>
      )}

      {order.delivery_instructions && (
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-600">
          <span className="font-semibold text-ink">Delivery instructions:</span> {order.delivery_instructions}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/profile?tab=orders"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand bg-brand-soft/70 px-6 text-sm font-bold text-brand transition hover:bg-brand-soft hover:shadow-sm"
        >
          <ShoppingBag className="h-4 w-4" /> View in My Orders
        </Link>
        <Link
          to="/catalog"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Continue shopping <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/"
          className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
};

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, cartTotalCount, cartSubtotal, handleUpdateQuantity, handleRemoveCartItem, handleClearCart } = useCart();
  const auth = useAuth();
  const currentUser = auth.loggedInUser;

  const [now] = useState(() => new Date());
  const todayOpen = DELIVERY_SLOTS.some((slot) => isSlotOpenToday(slot, now));

  const [details, setDetails] = useState<DeliveryDetails>(readSavedAddress);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>('custom');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  // The add-address popup is reused for editing the selected saved address
  const [isEditModal, setIsEditModal] = useState(false);
  // True once the location was taken from the GPS: the street address field is then not needed
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
  // Kind of address picked in the add / edit popup
  const [addressLabel, setAddressLabel] = useState('Home');
  // The delete button asks for a second tap before it removes the address
  const [confirmDeleteAddress, setConfirmDeleteAddress] = useState(false);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  useEffect(() => {
    if (!isAddAddressModalOpen) setConfirmDeleteAddress(false);
  }, [isAddAddressModalOpen]);
  const [isSavingNewAddress, setIsSavingNewAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({ name: '', phone: '', address: '', location: '' });
  const [checkoutLocationError, setCheckoutLocationError] = useState<string | null>(null);
  // The recipient's number (and the one typed in the add / edit address popup) must be verified before the order goes ahead
  const recipientPhoneVerification = usePhoneVerification(details.phone);
  const newAddressPhoneVerification = usePhoneVerification(newAddressForm.phone);
  // A saved address with a verified number: that number is fixed (the rest of the address can still be edited)
  const selectedAddressPhoneLocked = Boolean(
    selectedAddressId && selectedAddressId !== 'custom' && savedAddresses.find((a) => a.id === selectedAddressId)?.phone_verified
  );

  // "Fetch Live" inside an address field: puts the current location into that field (the shopper can still add house no. etc.)
  const fetchLiveLocation = (apply: (text: string) => void) => {
    if (!navigator.geolocation) {
      setCheckoutLocationError('Not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apply(`Live location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        setCheckoutLocationError(null);
      },
      () => setCheckoutLocationError('Location access denied')
    );
  };

  const fetchLiveButton = (apply: (text: string) => void) => (
    <button
      type="button"
      onClick={() => fetchLiveLocation(apply)}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand shadow-sm transition-colors hover:bg-brand/20"
    >
      <MapPin className="h-3.5 w-3.5" /> Fetch Live
    </button>
  );

  const locationErrorBox = checkoutLocationError ? (
    <details className="mt-2 group rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 transition-all cursor-pointer shadow-sm">
      <summary className="flex items-center justify-between text-xs font-bold list-none outline-none">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{checkoutLocationError}</span>
        </div>
        <span className="text-[10px] text-red-500 underline decoration-red-300 underline-offset-2 shrink-0 group-open:hidden">How to fix</span>
        <span className="text-[10px] text-red-500 hidden group-open:block shrink-0">Hide</span>
      </summary>
      <div className="mt-3 text-[11px] leading-relaxed text-red-600 space-y-1.5 border-t border-red-200/60 pt-2.5 cursor-text">
        <p><strong>1.</strong> Click the lock icon (🔒) next to the URL bar.</p>
        <p><strong>2.</strong> Find the <strong>Location</strong> permission.</p>
        <p><strong>3.</strong> Change it to <strong>Allow</strong>.</p>
        <p><strong>4.</strong> Try fetching again.</p>
      </div>
    </details>
  ) : null;

  const [day, setDay] = useState<DeliveryDay>(todayOpen ? 'today' : 'tomorrow');
  // Once a custom date is picked the calendar is tucked away (tap "Later" again to change it)
  const [laterPicked, setLaterPicked] = useState(false);
  const [laterDate, setLaterDate] = useState(() => toDateInputValue(addDays(now, 2)));
  const [slotId, setSlotId] = useState(DELIVERY_SLOTS[0].id);
  const [payment, setPayment] = useState<PaymentMethod>('upi');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // true for a moment after "Save draft" is pressed
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentStage, setPaymentStage] = useState<PaymentStage>(null);
  // null while loading; online options are only offered when the server has Razorpay configured
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const onlineUnavailable = paymentConfig !== null && !paymentConfig.enabled;

  useEffect(() => {
    let cancelled = false;
    paymentService
      .getConfig()
      .then((config) => {
        if (cancelled) return;
        setPaymentConfig(config);
        if (!config.enabled) setPayment('cod');
      })
      .catch(() => {
        if (!cancelled) setPaymentConfig({ enabled: false, mode: 'test' });
        if (!cancelled) setPayment('cod');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [submitRef, submitInView] = useInView<HTMLDivElement>(true);
  const [endRef, endInView] = useInView<HTMLDivElement>(false);

  // Track checkout initiation
  useEffect(() => {
    if (cart && cart.length > 0) {
      eventTracker.trackCheckoutStart({
        itemCount: cartTotalCount,
        totalAmount: cartSubtotal,
        items: cart
      });
    }
  }, []);

  // Restore draft if user was redirected to login
  useEffect(() => {
    try {
      const draftStr = localStorage.getItem('petal_pen_checkout_draft');
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.details) {
          setDetails((prev) => ({
            ...prev,
            ...draft.details,
            name: draft.details.name || currentUser?.name || prev.name,
            phone: draft.details.phone || currentUser?.phone || prev.phone
          }));
        }
        // A saved "today" may no longer be possible (slots closed): keep the default then
        if (draft.day && (draft.day !== 'today' || todayOpen)) setDay(draft.day);
        if (draft.slotId) setSlotId(draft.slotId);
        if (draft.payment) setPayment(draft.payment);
        if (draft.laterDate) setLaterDate(draft.laterDate);
        if (draft.day === 'later' && draft.laterDate) setLaterPicked(true);
      }
    } catch (e) {
      console.warn('Could not restore checkout draft:', e);
    }
  }, []);

  // Fetch saved user addresses and profile info if logged in
  useEffect(() => {
    if (currentUser?.id) {
      // 1. Fetch user's saved addresses from DB
      api.getUserAddresses(currentUser.id)
        .then((addrs) => {
          if (Array.isArray(addrs) && addrs.length > 0) {
            setSavedAddresses(addrs);
            const draft = readCheckoutDraft();
            const draftAddress = draft?.selectedAddressId ? addrs.find((a: any) => a.id === draft.selectedAddressId) : null;
            const defaultAddr = draftAddress || addrs.find((a: any) => a.is_default) || addrs[0];
            // A saved draft with an address typed by hand keeps that address instead of the default one
            const draftHasOwnAddress = Boolean(draft?.details?.address) && !draftAddress;
            if (defaultAddr && !draftHasOwnAddress) {
              setSelectedAddressId(defaultAddr.id);
              // the note and delivery instructions already written stay
              setDetails((prev) => ({
                ...prev,
                name: defaultAddr.name || currentUser.name || '',
                phone: defaultAddr.phone || currentUser.phone || '',
                address: defaultAddr.address_line || '',
                city: defaultAddr.city || '',
                pincode: defaultAddr.pincode || '',
              }));
            }
          } else {
            // No saved addresses yet: pre-fill recipient name & phone from logged-in user profile
            setDetails((prev) => ({
              ...prev,
              name: prev.name || currentUser.name || '',
              phone: prev.phone || currentUser.phone || '',
            }));
          }
        })
        .catch((err) => console.warn('Could not load saved addresses:', err));
    }
  }, [currentUser?.id]);

  const handleSelectSavedAddress = (addr: UserAddress) => {
    setSelectedAddressId(addr.id);
    setIsEditingAddress(false);
    setDetails((prev) => ({
      ...prev,
      name: addr.name || currentUser?.name || '',
      phone: addr.phone || currentUser?.phone || '',
      address: addr.address_line || '',
      city: addr.city || '',
      pincode: addr.pincode || '',
    }));
  };

  const handleUpdateAddress = async () => {
    if (!currentUser || selectedAddressId === 'custom') return;
    try {
      await api.updateUserAddress(currentUser.id, selectedAddressId, {
        name: details.name,
        phone: details.phone,
        address_line: details.address,
        city: details.city,
        pincode: details.pincode,
      });
      setIsEditingAddress(false);
      setSavedAddresses(prev => prev.map(a => a.id === selectedAddressId ? { ...a, name: details.name, phone: details.phone, address_line: details.address, city: details.city, pincode: details.pincode } : a));
    } catch (err) {
      console.error(err);
    }
  };

  // Removes only the address that is open in the popup (and selected), then picks another saved one if there is any
  const handleDeleteSelectedAddress = async () => {
    if (!currentUser?.id || !selectedAddressId || selectedAddressId === 'custom' || isDeletingAddress) return;
    if (!confirmDeleteAddress) {
      setConfirmDeleteAddress(true);
      return;
    }
    setIsDeletingAddress(true);
    try {
      await api.deleteUserAddress(currentUser.id, selectedAddressId);
      const remaining: UserAddress[] = await api.getUserAddresses(currentUser.id);
      setSavedAddresses(remaining);
      const next = remaining.find((a) => a.is_default) || remaining[0];
      if (next) {
        handleSelectSavedAddress(next);
      } else {
        setSelectedAddressId('custom');
        setDetails((prev) => ({ ...prev, name: currentUser.name || '', phone: currentUser.phone || '', address: '', city: '', pincode: '' }));
      }
      setIsAddAddressModalOpen(false);
      setIsEditModal(false);
      setNewAddressForm({ name: '', phone: '', address: '', location: '' });
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Could not remove the address.');
    } finally {
      setIsDeletingAddress(false);
      setConfirmDeleteAddress(false);
    }
  };

  const handleSaveNewAddress = async () => {
    if (!currentUser) return;
    const missingInModal: string[] = [];
    if (!newAddressForm.name.trim()) missingInModal.push('new-addr-name');
    if (!newAddressForm.phone.trim() || (!newAddressPhoneVerification.verified && !(isEditModal && selectedAddressPhoneLocked))) missingInModal.push('new-addr-phone');
    if (!newAddressForm.address.trim()) missingInModal.push('new-addr-address');
    if (!isDeliveryArea(newAddressForm.location)) missingInModal.push('new-addr-loc');
    if (missingInModal.length > 0) {
      flagInvalid(missingInModal);
      return;
    }
    try {
      setIsSavingNewAddress(true);
      const addressLine = newAddressForm.address;
      if (isEditModal && selectedAddressId && selectedAddressId !== 'custom') {
        const patch = { name: newAddressForm.name, phone: newAddressForm.phone, address_line: addressLine, city: newAddressForm.location, label: addressLabel };
        await api.updateUserAddress(currentUser.id, selectedAddressId, patch);
        setSavedAddresses((prev) => prev.map((a) => (a.id === selectedAddressId ? { ...a, ...patch } : a)));
        setDetails((prev) => ({ ...prev, name: patch.name, phone: patch.phone, address: patch.address_line, city: patch.city }));
        setIsAddAddressModalOpen(false);
        setIsEditModal(false);
        setNewAddressForm({ name: '', phone: '', address: '', location: '' });
        return;
      }
      const res = await api.addUserAddress(currentUser.id, {
        name: newAddressForm.name,
        phone: newAddressForm.phone,
        address_line: addressLine,
        city: newAddressForm.location,
        pincode: '000000',
        label: addressLabel,
      });
      
      const newAddrId = res.address?.id || res.id;
      const addrs = await api.getUserAddresses(currentUser.id);
      setSavedAddresses(addrs);

      const toSelect = addrs.find((a: any) => a.id === newAddrId) || addrs[addrs.length - 1];
      if (toSelect) {
        handleSelectSavedAddress(toSelect);
      }
      
      setIsAddAddressModalOpen(false);
      setNewAddressForm({ name: '', phone: '', address: '', location: '' });
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save address.');
    } finally {
      setIsSavingNewAddress(false);
    }
  };

  const slots = DELIVERY_SLOTS.map((slot) => ({ ...slot, available: day !== 'today' || isSlotOpenToday(slot, now) }));
  const activeSlot = slots.find((slot) => slot.id === slotId && slot.available) ?? slots.find((slot) => slot.available) ?? null;

  const [dbProducts, setDbProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    productService.getAllProducts().then((all) => {
      const map: Record<string, Product> = {};
      for (const p of all) {
        map[p.id] = p;
      }
      setDbProducts(map);
    }).catch((err) => {
      console.warn('Could not load products for delivery fee calculation:', err);
    });
  }, []);

  // Compute Delivery fee dynamically from Database products for items in cart
  const deliveryFee = React.useMemo(() => {
    if (cart.length === 0) return 0;

    let maxCharge = 0;
    let hasCustomCharge = false;
    let isAllFree = true;

    for (const item of cart) {
      const prodId = item.productId || item.id;
      const prod = dbProducts[prodId];

      if (prod) {
        if (prod.is_free_delivery) {
          // Explicitly free delivery on this item
        } else if (prod.delivery_charge !== null && prod.delivery_charge !== undefined) {
          hasCustomCharge = true;
          isAllFree = false;
          maxCharge = Math.max(maxCharge, Number(prod.delivery_charge));
        } else {
          isAllFree = false;
        }
      } else {
        isAllFree = false;
      }
    }

    if (hasCustomCharge) {
      return maxCharge;
    }
    if (isAllFree && Object.keys(dbProducts).length > 0) {
      return 0;
    }
    return 0;
  }, [cart, dbProducts]);

  // Prices are tax-inclusive, so there is no separate tax line
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const total = Math.max(0, cartSubtotal + deliveryFee - discountAmount);

  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Asks the server whether a code works for the current cart. Site-wide coupons discount every item;
  // a product-specific coupon only discounts its own product (the server decides, we just show the result).
  const requestCoupon = async (
    code: string
  ): Promise<{ status: 'ok'; coupon: AppliedCoupon } | { status: 'invalid'; message: string } | { status: 'error' }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          order_amount: cartSubtotal,
          user_id: currentUser?.id,
          items: cart.map((item) => ({
            productId: item.productId || item.id,
            price: item.price,
            quantity: item.quantity
          }))
        })
      });

      if (response.status >= 500) return { status: 'error' };

      const data = await response.json();
      if (!response.ok || !data.valid) {
        return { status: 'invalid', message: data.message || 'Invalid coupon code' };
      }

      const productNames: string[] = Array.isArray(data.product_names) ? data.product_names : [];
      return {
        status: 'ok',
        coupon: {
          code: data.coupon.code,
          discount: Number(data.discount) || 0,
          note: data.applies_to === 'product' && productNames.length > 0 ? `on ${productNames.join(', ')}` : undefined
        }
      };
    } catch (err) {
      console.error('Coupon validation error:', err);
      return { status: 'error' };
    }
  };

  const handleApplyCoupon = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setCouponError(null);
    setIsValidatingCoupon(true);

    const result = await requestCoupon(clean);

    if (result.status === 'ok') {
      setAppliedCoupon(result.coupon);
      eventTracker.trackCouponApplied({
        code: result.coupon.code,
        discountAmount: result.coupon.discount,
        success: true
      });
    } else if (result.status === 'invalid') {
      setCouponError(result.message);
      eventTracker.trackCouponApplied({ code: clean, success: false });
    } else {
      setCouponError('Could not validate the coupon right now. Please try again.');
    }

    setIsValidatingCoupon(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Live recalculation: when the cart changes (quantity, removed item) re-check the applied coupon so the discount
  // always matches the cart. If it no longer qualifies it is removed and the reason is shown.
  const cartSignature = cart.map((item) => `${item.productId || item.id}:${item.price}:${item.quantity}`).join('|');
  useEffect(() => {
    if (!appliedCoupon) return;
    let cancelled = false;

    requestCoupon(appliedCoupon.code).then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setAppliedCoupon(result.coupon);
      } else if (result.status === 'invalid') {
        setAppliedCoupon(null);
        setCouponError(result.message);
      }
      // A network/server error keeps the current coupon; the server re-checks it when the order is placed
    });

    return () => {
      cancelled = true;
    };
  }, [cartSignature]);

  // Restore the coupon saved with the checkout draft (login redirect), once, as soon as the cart is available
  const draftCouponTried = useRef(false);
  useEffect(() => {
    if (draftCouponTried.current || cart.length === 0) return;
    draftCouponTried.current = true;
    try {
      const draftStr = localStorage.getItem('petal_pen_checkout_draft');
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.couponCode) {
          handleApplyCoupon(draft.couponCode);
        }
      }
    } catch {}
  }, [cart.length]);

  const laterDateValue = new Date(`${laterDate}T00:00:00`);
  const hasLaterDate = !Number.isNaN(laterDateValue.getTime());
  // "Later" covers day 2 up to day 7; past dates and dates further out can't be booked
  const minLaterDate = toDateInputValue(addDays(now, 2));
  const maxLaterDate = toDateInputValue(addDays(now, MAX_ADVANCE_DAYS));
  const laterDateError =
    day === 'later' && (!hasLaterDate || laterDate < minLaterDate || laterDate > maxLaterDate)
      ? `Please choose a date between ${formatShortDay(addDays(now, 2))} and ${formatShortDay(addDays(now, MAX_ADVANCE_DAYS))}.`
      : null;
  const dayLabel = day === 'today' ? 'Today' : day === 'tomorrow' ? 'Tomorrow' : hasLaterDate ? formatDay(laterDateValue) : 'Your chosen date';
  const deliveryLabel = activeSlot ? `${dayLabel}, ${activeSlot.time}` : dayLabel;
  const showStickyBar = !submitInView && !endInView;

  const dayOptions: { id: DeliveryDay; label: string; hint: string; disabled?: boolean }[] = [
    { id: 'today', label: 'Today', hint: todayOpen ? formatShortDay(now) : 'Closed', disabled: !todayOpen },
    { id: 'tomorrow', label: 'Tomorrow', hint: formatShortDay(addDays(now, 1)) },
    { id: 'later', label: 'Later', hint: day === 'later' && hasLaterDate ? formatShortDay(laterDateValue) : 'Pick a date' },
  ];

  // Fields the shopper missed: shown with a red border and shaken once. A field turns normal again as soon as it is edited.
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const flagInvalid = (ids: string[]) => {
    setInvalidFields(ids);
    requestAnimationFrame(() => {
      const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
      // a phone field's Verify button shakes along with it
      const verifyButtons = ids.map((id) => document.getElementById(`${id}-verify`)).filter((el): el is HTMLElement => Boolean(el));
      [...elements, ...verifyButtons].forEach((el) => {
        el.classList.remove('field-shake');
        void el.offsetWidth; // restart the animation when the same field is missed again
        el.classList.add('field-shake');
        el.addEventListener('animationend', () => el.classList.remove('field-shake'), { once: true });
      });
      elements[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elements[0]?.focus({ preventScroll: true });
    });
  };
  const clearInvalid = (id: string) => setInvalidFields((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
  const isInvalid = (id: string) => invalidFields.includes(id);

  const DETAIL_FIELD_IDS: Partial<Record<keyof DeliveryDetails, string>> = {
    name: 'recipient-name',
    phone: 'recipient-phone',
    address: 'recipient-address',
    city: 'recipient-city',
  };

  const missingDeliveryFields = () => {
    const missing: string[] = [];
    if (!details.name.trim()) missing.push('recipient-name');
    if (!details.phone.trim() || (!recipientPhoneVerification.verified && !selectedAddressPhoneLocked)) missing.push('recipient-phone');
    if (!details.address.trim()) missing.push('recipient-address');
    if (!isDeliveryArea(details.city)) missing.push('recipient-city');
    return missing;
  };

  const updateDetail = (key: keyof DeliveryDetails) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
    const rawValue = typeof event === 'string' ? event : event.target.value;
    const value = key === 'pincode' ? rawValue.replace(/\D/g, '').slice(0, 6) : rawValue;
    setDetails((prev) => ({ ...prev, [key]: value }));
    const fieldId = DETAIL_FIELD_IDS[key];
    if (fieldId) clearInvalid(fieldId);
  };

  // Checkout shown in 3 steps: 1 address, 2 date/time + note, 3 payment. Later steps stay hidden until the one before is done.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const goNext = () => {
    setSubmitError(null);
    if (step === 1) {
      const missing = missingDeliveryFields();
      if (missing.length > 0) {
        setSubmitError(
          details.city.trim() && !isDeliveryArea(details.city) && missing.length === 1
            ? 'We do not deliver to this area yet. Please choose one of our delivery areas.'
            : details.phone.trim() && missing.length === 1 && missing[0] === 'recipient-phone'
              ? 'Please verify the recipient’s phone number.'
              : 'Please complete all delivery address fields.'
        );
        flagInvalid(missing);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!activeSlot || laterDateError) {
        setSubmitError(laterDateError || "Please choose a delivery slot.");
        return;
      }
      setStep(3);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      goNext();
      return;
    }
    if (!activeSlot || isSubmitting) return;

    if (laterDateError) {
      setSubmitError(laterDateError);
      return;
    }

    if (!currentUser?.id) {
      setSubmitError('Please sign in to complete and book your order. Redirecting to login...');
      try {
        localStorage.setItem('petal_pen_checkout_draft', JSON.stringify({ details, day, slotId, payment, couponCode: appliedCoupon?.code }));
      } catch {}
      setTimeout(() => {
        navigate('/auth?redirect=/checkout');
      }, 1000);
      return;
    }

    const missingAtPay = missingDeliveryFields();
    if (missingAtPay.length > 0) {
      setSubmitError('Please complete all delivery address fields.');
      setStep(1);
      flagInvalid(missingAtPay);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const fallbackOrderNumber = `PP-${Math.floor(100000 + Math.random() * 900000)}`;

    // The server re-prices everything from its own data: totals, payment status and ownership sent from here are
    // only used for display and are never trusted.
    const fullAddressString = `${details.name.trim()} | ${details.phone.trim()} | ${details.address.trim()}, ${details.city.trim()}${details.pincode ? ` ${details.pincode}` : ''}`;
    const orderPayload = {
      buyer_id: currentUser.id,
      items: cart.map(item => ({
        id: item.id,
        productId: item.productId || item.id,
        product_id: item.productId || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        variant: item.variant,
        selectedHue: item.selectedHue,
        palette: item.palette,
        addons: item.addons || []
      })),
      total_amount: total,
      delivery_fee: deliveryFee,
      subtotal: cartSubtotal,
      delivery_address: fullAddressString,
      details: {
        name: details.name.trim(),
        phone: details.phone.trim(),
        address: details.address.trim(),
        city: details.city.trim(),
        pincode: details.pincode,
        gift_message: details.gift_message?.trim() || null,
        delivery_instructions: details.delivery_instructions?.trim() || null
      },
      gift_message: details.gift_message?.trim() || null,
      delivery_instructions: details.delivery_instructions?.trim() || null,
      delivery_date: day === 'today' ? toDateInputValue(now) : day === 'tomorrow' ? toDateInputValue(addDays(now, 1)) : laterDate,
      delivery_slot: activeSlot ? `${activeSlot.label} (${activeSlot.time})` : deliveryLabel,
      deliveryLabel,
      is_same_day: day === 'today',
      payment_method: payment === 'card' ? 'Card' : payment === 'cod' ? 'COD' : 'UPI',
      coupon_code: appliedCoupon?.code || undefined,
      discount_amount: appliedCoupon?.discount || 0,
      session_id: sessionStorage.getItem('petal_pen_session_id') || undefined
    };

    // Shows the confirmation page and empties the cart (runs once the order is final: COD placed, or payment verified)
    const finishOrder = (createdOrder?: Partial<SettledOrder> | null) => {
      const finalOrderNumber = createdOrder?.order_number || (createdOrder?.id ? String(createdOrder.id).toUpperCase() : fallbackOrderNumber);
      eventTracker.trackPurchase({
        orderId: finalOrderNumber,
        totalAmount: createdOrder?.total_amount ?? total,
        itemCount: cartTotalCount
      });

      setPlacedOrder({
        number: finalOrderNumber,
        items: cart,
        subtotal: createdOrder?.subtotal ?? cartSubtotal,
        deliveryFee: createdOrder?.delivery_fee ?? deliveryFee,
        discountAmount: createdOrder?.discount_amount ?? discountAmount,
        appliedCoupon: appliedCoupon,
        total: createdOrder?.total_amount ?? total,
        details: {
          name: details.name.trim(),
          phone: details.phone.trim(),
          address: details.address.trim(),
          city: details.city.trim(),
          pincode: details.pincode,
          gift_message: details.gift_message?.trim(),
          delivery_instructions: details.delivery_instructions?.trim()
        },
        deliveryLabel,
        payment,
        gift_message: details.gift_message?.trim(),
        delivery_instructions: details.delivery_instructions?.trim()
      });

      try {
        localStorage.removeItem('petal_pen_checkout_draft');
      } catch {}
      handleClearCart();
      window.scrollTo(0, 0);
    };

    try {
      if (payment === 'cod') {
        finishOrder(await api.createOrder(orderPayload));
        return;
      }

      // Online payment: server prices the cart and saves the order as "payment pending", Razorpay collects the
      // money in its own window, then the server verifies the signed result before the order counts as paid.
      setPaymentStage('preparing');
      const session = await paymentService.createOrder(orderPayload);
      const orderId = session.order.id;
      // Set once Razorpay has reported a successful payment: from then on no error may invite a second payment
      let paymentReturned = false;

      try {
        setPaymentStage('awaiting');
        const result = await paymentService.openCheckout({
          session,
          method: payment,
          description: `Order ${session.order.order_number} · ${cartTotalCount} ${cartTotalCount === 1 ? 'gift' : 'gifts'}`,
          // The buyer's own details: Razorpay sends payment messages to this contact, never to the gift recipient
          prefill: { name: currentUser.name || undefined, email: currentUser.email || undefined, contact: currentUser.phone || undefined },
          onAttemptFailed: (message) => setSubmitError(message)
        });

        paymentReturned = true;
        setSubmitError(null);
        setPaymentStage('verifying');
        finishOrder(await paymentService.verify(orderId, result));
      } catch (paymentError) {
        // Closed the window, or the confirmation never reached us: ask the server what really happened
        const outcome = await paymentService.abandon(orderId).catch(() => null);
        if (outcome?.paid) {
          finishOrder(outcome.order);
        } else if (outcome?.processing) {
          // The bank has not answered yet (e.g. a UPI approval): the order completes by itself once it does
          setSubmitError(
            'Your bank is still confirming this payment. Please don’t pay again: if it goes through, your order will appear in My Orders within a few minutes. If it fails, no money is taken.'
          );
        } else if (paymentReturned) {
          // Paid, but neither confirmation call got through (usually a dropped connection). The server confirms the
          // order by itself (webhook / background check) and refuses a second payment meanwhile, so do not invite a retry.
          setSubmitError(
            `Your payment was received, but we could not confirm order ${session.order.order_number} because of a connection problem. Please don’t pay again: it will appear in My Orders within a few minutes.`
          );
        } else if (paymentError instanceof PaymentCancelledError) {
          setSubmitError('Payment cancelled. Your cart is safe, so you can try again whenever you are ready.');
        } else {
          throw paymentError;
        }
      }
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setSubmitError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPaymentStage(null);
      setIsSubmitting(false);
    }
  };

  if (placedOrder) return <OrderConfirmation order={placedOrder} />;

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-20 text-center sm:py-28">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-brand">
          <ShoppingBag className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 font-serif text-3xl text-ink sm:text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
          Add a gift or two and we’ll take care of the rest — including a free handwritten note.
        </p>
        <Link
          to="/catalog"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Explore gifts <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // "Save draft": keeps everything typed so far on this device, so the shopper can come back and finish later
  const saveDraft = () => {
    try {
      localStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ details, day, slotId, payment, laterDate, selectedAddressId, couponCode: appliedCoupon?.code, savedAt: Date.now() })
      );
      setDraftSaved(true);
      window.setTimeout(() => setDraftSaved(false), 2500);
    } catch {
      /* storage unavailable */
    }
  };

  const submitLabel = payment === 'cod' ? `Place order · ${formatPrice(total)}` : `Pay ${formatPrice(total)} securely`;
  const busyLabel =
    paymentStage === 'preparing'
      ? 'Preparing secure payment...'
      : paymentStage === 'awaiting'
        ? 'Complete the payment...'
        : paymentStage === 'verifying'
          ? 'Confirming your payment...'
          : 'Placing your order...';

  const summary = (
    <OrderSummary
      items={cart}
      subtotal={cartSubtotal}
      deliveryFee={deliveryFee}
      total={total}
      onQuantityChange={handleUpdateQuantity}
      onRemove={handleRemoveCartItem}
      appliedCoupon={appliedCoupon}
      onApplyCoupon={handleApplyCoupon}
      onRemoveCoupon={handleRemoveCoupon}
      couponError={couponError}
      isValidatingCoupon={isValidatingCoupon}
      onClearCouponError={() => setCouponError(null)}
      showNote={step !== 1}
      giftMessage={details.gift_message}
    />
  );

  return (
    <div className="pb-28 lg:pb-24">
      {/* While we create or confirm the payment, block the page so it cannot be submitted twice */}
      {(paymentStage === 'preparing' || paymentStage === 'verifying') && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-60 grid place-items-center bg-white/80 px-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Loader2 className="h-7 w-7 animate-spin" />
            </span>
            <p className="mt-4 font-serif text-xl text-ink">
              {paymentStage === 'verifying' ? 'Confirming your payment' : 'Preparing secure payment'}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {paymentStage === 'verifying'
                ? 'Please do not close or refresh this page.'
                : 'One moment while we open the payment window.'}
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Lock className="h-3.5 w-3.5" /> Secured by Razorpay
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-5 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/catalog"
              aria-label="Continue shopping"
              title="Continue shopping"
              className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-serif text-2xl leading-tight text-ink sm:text-3xl">Checkout</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Lock className="h-3.5 w-3.5" /> Secure checkout
          </span>
        </div>

        <div className="mt-5 lg:hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((open) => !open)}
            aria-expanded={summaryOpen}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <ShoppingBag className="h-4 w-4 text-brand" />
              {summaryOpen ? 'Hide' : 'Show'} order summary
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
            </span>
            <span className="text-base font-semibold text-ink">{formatPrice(total)}</span>
          </button>
          <AnimatePresence initial={false}>
            {summaryOpen && (
              <motion.div
                key="summary"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3">{summary}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Guest: Single clean card centered on screen with brand theme and single Sign In / Sign Up button */}
        {!currentUser ? (
          <div className="mx-auto max-w-md py-8 sm:py-14">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 text-center shadow-card sm:p-9">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand shadow-xs">
                <Lock className="h-6 w-6" />
              </div>

              <h2 className="mt-5 font-serif text-2xl text-ink sm:text-[26px]">
                Sign in to place your order
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Please sign in or create an account to complete checkout and track your delivery.
              </p>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('petal_pen_checkout_draft', JSON.stringify({ details, day, slotId, payment, couponCode: appliedCoupon?.code }));
                  } catch {}
                  navigate('/auth?redirect=/checkout');
                }}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark shadow-sm active:scale-[0.98] cursor-pointer"
              >
                Sign In / Sign Up <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-5 flex items-center justify-center gap-2.5 text-xs text-slate-400 border-t border-slate-100 pt-4">
                <span>{cartTotalCount} {cartTotalCount === 1 ? 'gift' : 'gifts'} saved in cart</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Logged In: Show Verified Account Banner + Full Form */
          <>
            <form id="checkout-form" onSubmit={placeOrder} className="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-5 lg:col-span-7">
            <nav aria-label="Checkout progress" className="px-1">
              <div className="relative flex items-start justify-between">
                <span aria-hidden="true" className="absolute left-5 right-5 top-5 h-1 rounded-full bg-slate-200" />
                <span
                  aria-hidden="true"
                  className="absolute left-5 top-5 h-1 rounded-full bg-brand transition-all duration-500"
                  style={{ width: `calc((100% - 2.5rem) * ${(step - 1) / 2})` }}
                />
                {([
                  { id: 1, label: 'Address', icon: MapPin },
                  { id: 2, label: 'Delivery', icon: PenLine },
                  { id: 3, label: 'Payment', icon: CreditCard },
                ] as const).map(({ id, label, icon: Icon }) => {
                  const done = id < step;
                  const current = id === step;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!done}
                      onClick={() => setStep(id)}
                      aria-current={current ? 'step' : undefined}
                      className={`relative z-10 flex w-16 flex-col items-center gap-1.5 ${done ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors ${
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : current
                              ? 'border-brand bg-brand text-white ring-4 ring-brand/15'
                              : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className={`text-[11px] font-semibold ${current ? 'text-ink' : done ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {step === 1 && (
            <CheckoutSection step={1} title="Delivery details">
              {/* Saved Address Quick-Selector if user has saved addresses */}
              {savedAddresses.length > 0 && (
                <div className="mb-5 space-y-3 pb-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-brand" />
                      Select Saved Address
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">{savedAddresses.length}/5 saved</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`relative cursor-pointer rounded-xl border p-2.5 transition-all text-left ${
                            isSelected
                              ? 'border-brand bg-brand-soft/60 ring-2 ring-brand/30 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800">
                              {React.createElement(addressTypeIcon(addr.label), { className: 'h-3 w-3 text-brand' })}
                              {addr.label || 'Home'}
                            </span>
                            <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-brand bg-brand text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-ink truncate pr-8">{addr.name || currentUser?.name}</p>
                          <p className="text-[10px] text-slate-500 leading-snug line-clamp-1 pr-8">{addr.address_line}, {addr.city}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{addr.phone || currentUser?.phone}</p>
                          {isSelected && recipientPhoneVerification.required && !recipientPhoneVerification.verified && !selectedAddressPhoneLocked && (
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <PhoneVerifyControl id="recipient-phone-verify" invalid={isInvalid('recipient-phone')} onVerified={() => clearInvalid('recipient-phone')} phone={details.phone} verification={recipientPhoneVerification} saveToAccount={false} />
                            </div>
                          )}
                          {isSelected && (
                            <button
                              type="button"
                              aria-label="Edit address"
                              title="Edit address"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewAddressForm({ name: addr.name || "", phone: addr.phone || "", address: addr.address_line || "", location: addr.city || "" });
                                setAddressLabel(ADDRESS_TYPES.some((type) => type.label === addr.label) ? addr.label : 'Other');
                                setIsEditModal(true);
                                setIsAddAddressModalOpen(true);
                              }}
                              className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-brand text-brand transition-colors hover:bg-brand-soft"
                            >
                              <PenLine className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* "Add New Address" is a card too, the same size as the saved addresses */}
                    <button
                      type="button"
                      disabled={savedAddresses.length >= 5}
                      onClick={() => {
                        setIsEditModal(false);
                        setNewAddressForm({ name: currentUser?.name || '', phone: '', address: '', location: '' });
                        setAddressLabel('Home');
                        setIsAddAddressModalOpen(true);
                      }}
                      className={`flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-2.5 text-center transition-all ${
                        savedAddresses.length >= 5
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                          : 'cursor-pointer border-brand/50 bg-brand-soft/30 text-brand hover:border-brand hover:bg-brand-soft/60'
                      }`}
                    >
                      <PlusCircle className="h-5 w-5" />
                      <span className="text-[11px] font-bold">
                        {savedAddresses.length >= 5 ? 'Limit reached (5/5)' : 'Add New Address'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {(selectedAddressId === 'custom' || isEditingAddress) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="recipient-name"
                  label="Recipient’s name"
                  wrapperClassName="sm:col-span-2"
                  value={details.name}
                  onChange={updateDetail('name')}
                  invalid={isInvalid('recipient-name')}
                  required
                  autoComplete="name"
                  placeholder="Who is this gift for?"
                  readOnly={selectedAddressId !== 'custom' && !isEditingAddress}
                />
                <Field
                  id="recipient-phone"
                  label="Recipient’s phone"
                  type="tel"
                  inputMode="tel"
                  wrapperClassName="sm:col-span-2"
                  value={details.phone}
                  onChange={updateDetail('phone')}
                  invalid={isInvalid('recipient-phone')}
                  required
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  pattern="\+?[0-9 ]{10,14}"
                  title="Enter a valid phone number"
                  hint={selectedAddressPhoneLocked ? 'Verified number: it cannot be changed. Add a new address to use another number.' : 'Only shared with our delivery partner.'}
                  readOnly={(selectedAddressId !== 'custom' && !isEditingAddress) || selectedAddressPhoneLocked}
                  trailing={selectedAddressPhoneLocked ? <LockedPhoneTag /> : <PhoneVerifyControl id="recipient-phone-verify" invalid={isInvalid('recipient-phone')} onVerified={() => clearInvalid('recipient-phone')} phone={details.phone} verification={recipientPhoneVerification} saveToAccount={false} />}
                />
                <Field
                  id="recipient-address"
                  label="Address"
                  wrapperClassName="sm:col-span-2"
                  value={details.address}
                  onChange={updateDetail('address')}
                  invalid={isInvalid('recipient-address')}
                  required
                  autoComplete="street-address"
                  placeholder="House no., street, landmark"
                  readOnly={selectedAddressId !== 'custom' && !isEditingAddress}
                  trailing={
                    selectedAddressId === 'custom' || isEditingAddress
                      ? fetchLiveButton((text) => setDetails((prev) => ({ ...prev, address: text })))
                      : undefined
                  }
                />
                {!isAddAddressModalOpen && locationErrorBox && <div className="sm:col-span-2">{locationErrorBox}</div>}
                <div className="sm:col-span-2">
                  <label htmlFor="recipient-city" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Delivery area
                  </label>
                  <PickerSelect
                    id="recipient-city"
                    title="Delivery area"
                    placeholder="Select delivery area"
                    options={DELIVERY_AREAS}
                    value={isDeliveryArea(details.city) ? details.city : ''}
                    invalid={isInvalid('recipient-city')}
                    disabled={selectedAddressId !== 'custom' && !isEditingAddress}
                    onChange={(area) => {
                      setDetails((prev) => ({ ...prev, city: area }));
                      clearInvalid('recipient-city');
                    }}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">We currently deliver only to these areas.</p>
                </div>
              </div>
              )}
            </CheckoutSection>
            )}

            {step === 2 && (
            <>
            <CheckoutSection step={2} title="Delivery date & note">
              <div role="radiogroup" aria-label="Delivery day" className="grid grid-cols-3 gap-2">
                {dayOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={day === option.id}
                    disabled={option.disabled}
                    onClick={() => {
                      setDay(option.id);
                      if (option.id === 'later') setLaterPicked(false);
                      eventTracker.trackDeliverySlotSelected({ day: option.label, slot: activeSlot?.label || slotId });
                    }}
                    className={`${CHOICE} !p-2 ${day === option.id ? CHOICE_ACTIVE : CHOICE_IDLE}`}
                  >
                    <span className="block text-xs font-semibold text-ink">{option.label}</span>
                    <span className="block truncate text-[10px] text-slate-500">{option.hint}</span>
                  </button>
                ))}
              </div>

              {day === 'later' && !laterPicked && (
                <div className="mt-4 max-w-xs">
                  <label htmlFor="delivery-date" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Delivery date
                  </label>
                  <input
                    id="delivery-date"
                    type="date"
                    required
                    min={minLaterDate}
                    max={maxLaterDate}
                    value={laterDate}
                    onChange={(event) => {
                      setLaterDate(event.target.value);
                      if (event.target.value >= minLaterDate && event.target.value <= maxLaterDate) setLaterPicked(true);
                      setSubmitError(null);
                    }}
                    aria-invalid={Boolean(laterDateError)}
                    aria-describedby="delivery-date-hint"
                    className={INPUT}
                  />
                  <p
                    id="delivery-date-hint"
                    className={`mt-1.5 text-xs ${laterDateError ? 'font-medium text-rose-600' : 'text-slate-500'}`}
                  >
                    {laterDateError ?? `You can book up to ${MAX_ADVANCE_DAYS} days ahead.`}
                  </p>
                </div>
              )}

              {/* Time slot hidden for now (the first available slot is used automatically)
              <p className="mt-4 text-xs font-medium text-slate-700">Time slot</p>
              <div role="radiogroup" aria-label="Delivery time slot" className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const active = activeSlot?.id === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!slot.available}
                      onClick={() => {
                        setSlotId(slot.id);
                        eventTracker.trackDeliverySlotSelected({ day, slot: slot.label });
                      }}
                      className={`${CHOICE} !p-2 ${active ? CHOICE_ACTIVE : CHOICE_IDLE}`}
                    >
                      <span className="block text-xs font-semibold text-ink">{slot.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">{slot.available ? slot.time : 'Closed today'}</span>
                    </button>
                  );
                })}
              </div>
              */}
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                {/* Complimentary handwritten gift note */}
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="gift-message" className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <PenLine className="h-4 w-4 text-brand" /> Handwritten note
                    </label>
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">Free</span>
                  </div>
                  <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                    Penned by hand on textured Italian cotton paper, tucked inside a wax-sealed envelope with your gift.
                  </p>
                  <div className="mt-2 relative">
                    <textarea
                      id="gift-message"
                      maxLength={300}
                      value={details.gift_message || ''}
                      onChange={(e) => updateDetail('gift_message')(limitWords(e.target.value, NOTE_WORD_LIMIT))}
                      placeholder="Write a short message (up to 30 words)"
                      className="block h-20 w-full resize-none rounded-xl border border-amber-200/90 bg-white/95 px-3 py-2.5 font-serif text-sm italic leading-snug text-ink placeholder:font-sans placeholder:text-xs placeholder:not-italic placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span className="hidden sm:inline">Leaves our atelier alongside your gift</span>
                      <span className={countWords(details.gift_message || '') >= NOTE_WORD_LIMIT ? 'font-semibold text-amber-600' : ''}>
                        {countWords(details.gift_message || '')}/{NOTE_WORD_LIMIT} words
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </CheckoutSection>
            </>
            )}

            {step === 3 && (
            <CheckoutSection step={4} title="Payment">
              <div className="space-y-2.5" role="radiogroup" aria-label="Payment method">
                {PAYMENT_OPTIONS.map(({ id, icon: Icon, title, text, online }) => {
                  const active = payment === id;
                  const disabled = online && onlineUnavailable;
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition sm:gap-4 sm:p-4 ${
                        disabled
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                          : `cursor-pointer ${active ? CHOICE_ACTIVE : CHOICE_IDLE}`
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={id}
                        checked={active}
                        disabled={disabled}
                        onChange={() => {
                          setPayment(id);
                          eventTracker.track('checkout_start', { step: 'payment_method_selected', payment_method: id });
                        }}
                        className="peer sr-only"
                      />
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${
                          active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-ink">{title}</span>
                          {online && !disabled && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Instant confirmation
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-500">{disabled ? 'Unavailable right now' : text}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                          active ? 'border-brand' : 'border-slate-300'
                        }`}
                      >
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                      </span>
                    </label>
                  );
                })}
              </div>

              {payment !== 'cod' && paymentConfig?.enabled && (
                <div className="mt-3 space-y-2">
                  <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      You will pay in Razorpay&rsquo;s secure window. Your card or UPI details go straight to Razorpay: we never see or store them.
                    </span>
                  </p>
                  {paymentConfig.mode === 'test' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
                      <p className="font-semibold">Test mode: no real money is charged</p>
                      <p className="mt-0.5">
                        {payment === 'upi' ? (
                          <>UPI: use <span className="font-mono font-semibold">success@razorpay</span> (or <span className="font-mono font-semibold">failure@razorpay</span> to see a failed payment).</>
                        ) : (
                          <>Card: <span className="font-mono font-semibold">4111 1111 1111 1111</span>, any future expiry, any CVV, OTP <span className="font-mono font-semibold">1234</span> if asked.</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {payment === 'cod' && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>Pay in cash when your gift arrives. Please keep the exact amount handy.</span>
                </p>
              )}
            </CheckoutSection>
            )}

            {step === 3 ? (
            <div key="pay-actions" ref={submitRef} className="space-y-3 pt-1">
              {submitError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600 text-center">
                  {submitError}
                </div>
              )}
              {!currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem('petal_pen_checkout_draft', JSON.stringify({ details, day, slotId, payment }));
                    } catch {}
                    navigate('/auth?redirect=/checkout');
                  }}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-amber-600 text-base font-semibold text-white transition hover:bg-amber-700 shadow-sm cursor-pointer"
                >
                  <Lock className="h-4 w-4" /> Sign In / Sign Up · {formatPrice(total)}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!activeSlot || isSubmitting}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> {busyLabel}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> {submitLabel}
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={saveDraft}
                disabled={isSubmitting}
                className={`mx-auto flex items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  draftSaved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {draftSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {draftSaved ? 'Draft saved' : 'Save draft'}
              </button>
              <p className="text-center text-xs text-slate-500">
                Arriving {deliveryLabel.charAt(0).toLowerCase()}
                {deliveryLabel.slice(1)}
                {details.name.trim() ? ` for ${details.name.trim()}` : ''}
              </p>
            </div>
            ) : (
              <div key="continue-actions" className="space-y-3 pt-1">
                {submitError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600 text-center">
                    {submitError}
                  </div>
                )}
                <button
                  key="continue-btn"
                  type="button"
                  onClick={goNext}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white transition hover:bg-brand-dark cursor-pointer"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <aside className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-28">
              {summary}
              <p className="mt-3 text-center text-xs text-slate-400">
                {cartTotalCount} {cartTotalCount === 1 ? 'gift' : 'gifts'} · Wrapped by hand
              </p>
            </div>
          </aside>
        </form>
        </>
      )}
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </div>

      {step === 3 && (
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
          showStickyBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
      >
        {!currentUser ? (
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('petal_pen_checkout_draft', JSON.stringify({ details, day, slotId, payment }));
              } catch {}
              navigate('/auth?redirect=/checkout');
            }}
            tabIndex={showStickyBar ? 0 : -1}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white transition hover:bg-brand-dark shadow-sm cursor-pointer"
          >
            <Lock className="h-4 w-4" /> Sign In / Sign Up · {formatPrice(total)}
          </button>
        ) : (
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={isSubmitting}
            tabIndex={showStickyBar ? 0 : -1}
            aria-label="Save draft"
            className={`flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition disabled:opacity-50 ${
              draftSaved ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {draftSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {draftSaved ? 'Saved' : 'Draft'}
          </button>
          <button
            type="submit"
            form="checkout-form"
            disabled={!activeSlot || isSubmitting}
            tabIndex={showStickyBar ? 0 : -1}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white transition hover:bg-brand-dark disabled:bg-slate-300 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> {submitLabel}
              </>
            )}
          </button>
          </div>
        )}
      </div>
      )}

      {/* Add New Address Modal */}
      <AnimatePresence>
        {isAddAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddAddressModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="shrink-0 border-b border-slate-100 p-4 pb-3 sm:p-5 sm:pb-4">
                <h3 className="font-serif text-xl text-ink">{isEditModal ? 'Edit Address' : 'Add New Address'}</h3>
                <p className="mt-1 text-sm text-slate-500">Fill out the details below for a new delivery address.</p>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div>
                  <p className="mb-1.5 block text-[13px] font-medium text-slate-700">Address type</p>
                  <div role="radiogroup" aria-label="Address type" className="grid grid-cols-5 gap-1.5">
                    {ADDRESS_TYPES.map(({ label, icon: TypeIcon }) => {
                      const active = addressLabel === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setAddressLabel(label)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition ${
                            active
                              ? 'border-brand bg-brand-soft text-brand ring-2 ring-brand/20'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                          }`}
                        >
                          <TypeIcon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(isEditModal || !currentUser?.name) && (
                <Field
                  id="new-addr-name"
                  label="Name"
                  value={newAddressForm.name}
                  onChange={(e) => { setNewAddressForm({ ...newAddressForm, name: e.target.value }); clearInvalid('new-addr-name'); }}
                  invalid={isInvalid('new-addr-name')}
                  placeholder="Recipient's Name"
                />
                )}
                {(isEditModal || !currentUser?.phone || !newAddressPhoneVerification.verified) && (
                <Field
                  id="new-addr-phone"
                  label="Phone"
                  type="tel"
                  inputMode="numeric"
                  value={newAddressForm.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setNewAddressForm({ ...newAddressForm, phone: val });
                    clearInvalid('new-addr-phone');
                  }}
                  invalid={isInvalid('new-addr-phone')}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  disabled={isEditModal && selectedAddressPhoneLocked}
                  hint={isEditModal && selectedAddressPhoneLocked ? 'Verified number: it cannot be changed.' : undefined}
                  trailing={isEditModal && selectedAddressPhoneLocked ? <LockedPhoneTag /> : <PhoneVerifyControl id="new-addr-phone-verify" invalid={isInvalid('new-addr-phone')} onVerified={() => clearInvalid('new-addr-phone')} phone={newAddressForm.phone} verification={newAddressPhoneVerification} saveToAccount={false} />}
                />
                )}
                <div>
                  <Field
                    id="new-addr-address"
                    label="Address"
                    value={newAddressForm.address}
                    onChange={(e) => { setNewAddressForm({ ...newAddressForm, address: e.target.value }); clearInvalid('new-addr-address'); }}
                    invalid={isInvalid('new-addr-address')}
                    placeholder="House no., street, landmark"
                    trailing={fetchLiveButton((text) => setNewAddressForm((prev) => ({ ...prev, address: text })))}
                  />
                  {locationErrorBox}
                </div>
                <div>
                  <label htmlFor="new-addr-loc" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Delivery area
                  </label>
                  <PickerSelect
                    id="new-addr-loc"
                    title="Delivery area"
                    placeholder="Select delivery area"
                    options={DELIVERY_AREAS}
                    value={isDeliveryArea(newAddressForm.location) ? newAddressForm.location : ''}
                    invalid={isInvalid('new-addr-loc')}
                    onChange={(area) => {
                      setNewAddressForm({ ...newAddressForm, location: area });
                      clearInvalid('new-addr-loc');
                    }}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">We currently deliver only to these areas.</p>
                </div>
              </div>
              {confirmDeleteAddress ? (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-red-100 bg-red-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
                <p className="text-sm font-semibold text-red-700">Delete this address?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAddress(false)}
                    disabled={isDeletingAddress}
                    className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white disabled:opacity-50"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSelectedAddress()}
                    disabled={isDeletingAddress}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {isDeletingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isDeletingAddress ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              ) : (
              <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-5">
                {isEditModal && selectedAddressId && selectedAddressId !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteSelectedAddress()}
                    disabled={isSavingNewAddress}
                    aria-label="Delete this address"
                    title="Delete this address"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddAddressModalOpen(false)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/50 sm:px-5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingNewAddress}
                    onClick={handleSaveNewAddress}
                    className="flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50 sm:px-6"
                  >
                    {isSavingNewAddress ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</>
                    ) : (
                      'Save Address'
                    )}
                  </button>
                </div>
              </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckoutPage;
