import type { LucideIcon } from 'lucide-react';
import {
  Cake,
  Flame,
  Flower2,
  Gem,
  HandHeart,
  Heart,
  HeartHandshake,
  House,
  PartyPopper,
  Smile,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Occasion } from '../types';

// COMMENTED: Occasion metadata moved to utils to avoid static data files
// Icons and metadata for occasions
export interface OccasionMeta {
  name: Occasion;
  icon: LucideIcon;
  tint: string;
  iconColor: string;
  href?: string;
}

export const OCCASION_META: OccasionMeta[] = [
  { name: 'Birthday', icon: Cake, tint: 'bg-blue-50', iconColor: 'text-blue-600' },
  { name: 'Anniversary', icon: Heart, tint: 'bg-rose-50', iconColor: 'text-rose-500', href: '/anniversary' },
  { name: 'Wedding', icon: Gem, tint: 'bg-yellow-50', iconColor: 'text-yellow-700' },
  { name: 'Diwali', icon: Flame, tint: 'bg-orange-50', iconColor: 'text-orange-600' },
  { name: 'Raksha Bandhan', icon: HeartHandshake, tint: 'bg-rose-50', iconColor: 'text-rose-600' },
  { name: 'Housewarming', icon: House, tint: 'bg-green-50', iconColor: 'text-green-600' },
  { name: 'Festivals', icon: PartyPopper, tint: 'bg-purple-50', iconColor: 'text-purple-600' },
  { name: "Valentine's", icon: Sparkles, tint: 'bg-pink-50', iconColor: 'text-pink-500' },
  { name: 'Congratulations', icon: Trophy, tint: 'bg-amber-50', iconColor: 'text-amber-600' },
  { name: 'Thank You', icon: HandHeart, tint: 'bg-teal-50', iconColor: 'text-teal-600' },
  { name: 'Get Well Soon', icon: Flower2, tint: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { name: 'Sympathy', icon: Flower2, tint: 'bg-slate-100', iconColor: 'text-slate-600' },
  { name: 'Just Because', icon: Smile, tint: 'bg-sky-50', iconColor: 'text-sky-600' },
];

// Occasions displayed on home page
export const HOME_OCCASIONS: Occasion[] = [
  'Birthday',
  'Anniversary',
  'Wedding',
  'Diwali',
  'Raksha Bandhan',
  'Housewarming',
  'Festivals',
  "Valentine's",
];

// Helper: Get metadata for an occasion
export const getOccasionMeta = (name: string): OccasionMeta | undefined =>
  OCCASION_META.find((occasion) => occasion.name.toLowerCase() === name.toLowerCase());

// Helper: Get href for an occasion
export const occasionHref = (name: string): string =>
  getOccasionMeta(name)?.href ?? `/catalog?occasion=${encodeURIComponent(name)}`;
