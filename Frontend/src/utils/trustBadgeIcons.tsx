import React from 'react';
import {
  Award,
  BadgeCheck,
  Ban,
  Banknote,
  BanknoteX,
  Clock,
  CreditCard,
  Gift,
  Headphones,
  HeartHandshake,
  ImagePlus,
  Leaf,
  Lock,
  MessageSquareText,
  PackageCheck,
  PackageX,
  PenLine,
  Printer,
  RotateCcw,
  ShieldCheck,
  Signature,
  Truck,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface TrustBadgeIconOption {
  value: string;
  label: string;
  emoji: string;
  Icon: LucideIcon;
}

export const TRUST_BADGE_ICON_OPTIONS: TrustBadgeIconOption[] = [
  { value: 'clock', label: 'Clock (Cancellation / Timer)', emoji: '🕒', Icon: Clock },
  { value: 'return', label: 'Return Box (7-Day Return)', emoji: '🔄', Icon: RotateCcw },
  { value: 'cod', label: 'Cash on Delivery (COD / Rupee)', emoji: '💵', Icon: Banknote },
  { value: 'shield', label: 'Assured Shield (Quality Assured)', emoji: '🛡️', Icon: ShieldCheck },
  { value: 'truck', label: 'Truck (Safe & Fast Delivery)', emoji: '🚚', Icon: Truck },
  { value: 'no_return', label: 'No Return (Box with cross)', emoji: '📦', Icon: PackageX },
  { value: 'no_refund', label: 'No Refund (Money with cross)', emoji: '💸', Icon: BanknoteX },
  { value: 'no_cancel', label: 'No Cancellation (Blocked)', emoji: '🚫', Icon: Ban },
  { value: 'verified', label: 'Verified Check (Trusted)', emoji: '✅', Icon: BadgeCheck },
  { value: 'secure_payment', label: 'Secure Payment (Lock)', emoji: '🔒', Icon: Lock },
  { value: 'card', label: 'Online Payment (Card)', emoji: '💳', Icon: CreditCard },
  { value: 'package', label: 'Packed Safely (Package)', emoji: '📬', Icon: PackageCheck },
  { value: 'gift', label: 'Gift Wrap (Gift)', emoji: '🎁', Icon: Gift },
  { value: 'award', label: 'Top Quality (Award)', emoji: '🏅', Icon: Award },
  { value: 'fast', label: 'Fast Dispatch (Lightning)', emoji: '⚡', Icon: Zap },
  { value: 'support', label: '24x7 Support (Headphones)', emoji: '🎧', Icon: Headphones },
  { value: 'eco', label: 'Eco Friendly (Leaf)', emoji: '🌿', Icon: Leaf },
  { value: 'pen', label: 'Handwritten Note (Pen)', emoji: '✍️', Icon: PenLine },
  { value: 'heart', label: 'Delight Guarantee (Heart)', emoji: '🤝', Icon: HeartHandshake },
  { value: 'photo', label: 'Upload Photo (Image)', emoji: '🖼️', Icon: ImagePlus },
  { value: 'name', label: 'Print Name (Text)', emoji: '🔤', Icon: Type },
  { value: 'signature', label: 'Signature', emoji: '🖋️', Icon: Signature },
  { value: 'message', label: 'Custom Message (Chat)', emoji: '💬', Icon: MessageSquareText },
  { value: 'print', label: 'Printing (Printer)', emoji: '🖨️', Icon: Printer },
];

const FALLBACK_ICON: LucideIcon = ShieldCheck;

export const getTrustBadgeIcon = (icon?: string): LucideIcon =>
  TRUST_BADGE_ICON_OPTIONS.find((option) => option.value === icon)?.Icon ?? FALLBACK_ICON;

export const TrustBadgeIcon: React.FC<{ icon?: string; className?: string }> = ({
  icon,
  className = 'h-5 w-5',
}) => {
  const Icon = getTrustBadgeIcon(icon);
  return <Icon className={className} strokeWidth={1.8} />;
};
