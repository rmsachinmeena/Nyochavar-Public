export type ProductBadgeKey = 'new' | 'bestseller' | 'trending' | 'top_rated' | 'eco' | 'budget';

export interface BadgeDefinition {
  key: ProductBadgeKey;
  label: string;
  emoji: string;
  color: string; // Tailwind background & text classes
  activeClass: string;
  idleClass: string;
  priority: number; // lower number = higher priority
}

export const MAX_CARD_BADGES = 2;

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    key: 'new',
    label: 'New',
    emoji: '✨',
    color: 'bg-[#6938ef] text-white border-[#6938ef]',
    activeClass: 'bg-[#6938ef] text-white border-[#6938ef] shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 1
  },
  {
    key: 'bestseller',
    label: 'Bestseller',
    emoji: '🏆',
    color: 'bg-slate-900 text-white border-slate-900',
    activeClass: 'bg-slate-900 text-white border-slate-900 shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 2
  },
  {
    key: 'trending',
    label: 'Trending',
    emoji: '🔥',
    color: 'bg-brand text-white border-brand',
    activeClass: 'bg-brand text-white border-brand shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 3
  },
  {
    key: 'top_rated',
    label: 'Top Rated',
    emoji: '⭐',
    color: 'bg-amber-500 text-white border-amber-500',
    activeClass: 'bg-amber-500 text-white border-amber-500 shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 4
  },
  {
    key: 'eco',
    label: 'Eco-Friendly',
    emoji: '🌱',
    color: 'bg-emerald-600 text-white border-emerald-600',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 5
  },
  {
    key: 'budget',
    label: 'Budget Friendly',
    emoji: '🏷️',
    color: 'bg-teal-600 text-white border-teal-600',
    activeClass: 'bg-teal-600 text-white border-teal-600 shadow-xs',
    idleClass: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    priority: 6
  }
];

export const BADGE_MAP: Record<ProductBadgeKey, BadgeDefinition> = BADGE_DEFINITIONS.reduce(
  (acc, item) => {
    acc[item.key] = item;
    return acc;
  },
  {} as Record<ProductBadgeKey, BadgeDefinition>
);

/**
 * Resolves all active badges for a product, sorted by priority (new > bestseller > trending > top_rated > eco > budget).
 */
export function getProductBadges(product?: {
  badges?: (string | ProductBadgeKey)[];
  isNew?: boolean;
  isBestSeller?: boolean;
  is_trending?: boolean;
  is_top_rated_this_week?: boolean;
  is_eco_friendly?: boolean;
  is_budget_friendly?: boolean;
} | null): BadgeDefinition[] {
  if (!product) return [];

  const keys = new Set<ProductBadgeKey>();

  // 1. If product.badges is defined, strictly honor admin's choice only
  if (Array.isArray(product.badges)) {
    for (const b of product.badges) {
      const clean = String(b).trim().toLowerCase() as ProductBadgeKey;
      if (BADGE_MAP[clean]) {
        keys.add(clean);
      }
    }
    return BADGE_DEFINITIONS.filter((def) => keys.has(def.key));
  }

  // 2. Legacy fallback only if product.badges is completely missing/undefined
  if (product.isNew) keys.add('new');
  if (product.isBestSeller) keys.add('bestseller');
  if (product.is_trending) keys.add('trending');
  if (product.is_top_rated_this_week) keys.add('top_rated');
  if (product.is_eco_friendly) keys.add('eco');
  if (product.is_budget_friendly) keys.add('budget');

  // Return sorted by priority
  return BADGE_DEFINITIONS.filter((def) => keys.has(def.key));
}

/**
 * Returns up to MAX_CARD_BADGES (max 2) for ProductCard display.
 */
export function getCardBadges(product?: {
  badges?: (string | ProductBadgeKey)[];
  isNew?: boolean;
  isBestSeller?: boolean;
  is_trending?: boolean;
  is_top_rated_this_week?: boolean;
  is_eco_friendly?: boolean;
  is_budget_friendly?: boolean;
} | null): BadgeDefinition[] {
  return getProductBadges(product).slice(0, MAX_CARD_BADGES);
}
