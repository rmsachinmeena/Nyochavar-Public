import type { Product } from '../types';

export type SortKey = 'recommended' | 'bestselling' | 'newest' | 'price-asc' | 'price-desc' | 'rating';
export type TagKey = 'on-sale' | 'bestseller' | 'new' | 'personalized' | 'in-stock';
export type RecipientKey = 'her' | 'him';
export type FacetKey = 'category' | 'occasions' | 'price' | 'recipient' | 'tags';

export interface PriceBand {
  id: string;
  label: string;
  min: number;
  maxExclusive: number | null;
}

export interface CatalogFilters {
  category: string;
  occasions: string[];
  price: string | null;
  recipient: RecipientKey | null;
  tags: TagKey[];
  query: string;
  sort: SortKey;
}

export const PAGE_SIZE = 12;

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'bestselling', label: 'Best selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export const TAG_OPTIONS: { value: TagKey; label: string }[] = [
  { value: 'on-sale', label: 'On sale' },
  { value: 'bestseller', label: 'Best sellers' },
  { value: 'new', label: 'New arrivals' },
  { value: 'personalized', label: 'Personalizable' },
  { value: 'in-stock', label: 'In stock' },
];

export const RECIPIENT_OPTIONS: { value: RecipientKey; label: string }[] = [
  { value: 'her', label: 'For her' },
  { value: 'him', label: 'For him' },
];

// The budgets shoppers pick from (home page chips and the catalogue's price filter use the same list)
export const PRICE_BANDS: PriceBand[] = [
  { id: 'under-500', label: 'Under ₹499', min: 0, maxExclusive: 500 },
  { id: '500-1000', label: '₹500 – ₹999', min: 500, maxExclusive: 1000 },
  { id: '1000-2000', label: '₹1,000 – ₹1,999', min: 1000, maxExclusive: 2000 },
  { id: '2000-plus', label: 'Premium ₹2,000+', min: 2000, maxExclusive: null },
];

export const EMPTY_FILTERS: CatalogFilters = {
  category: 'All',
  occasions: [],
  price: null,
  recipient: null,
  tags: [],
  query: '',
  sort: 'recommended',
};

const RECIPIENT_GENDER: Record<RecipientKey, 'women' | 'men'> = { her: 'women', him: 'men' };

const normalize = (value: string | undefined | null) => (value ?? '').trim().toLowerCase();

const splitList = (value: string | null) =>
  value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];

const isSortKey = (value: string | null): value is SortKey =>
  SORT_OPTIONS.some((option) => option.value === value);

const isTagKey = (value: string): value is TagKey => TAG_OPTIONS.some((option) => option.value === value);

const createdTime = (product: Product) => (product.created_at ? Date.parse(product.created_at) || 0 : 0);

export const isSoldOut = (product: Product) => product.stock !== undefined && product.stock <= 0;

export const isLowStock = (product: Product) =>
  product.stock !== undefined && product.stock > 0 && product.stock < 10;

export const getDiscountPercent = (product: Product) =>
  product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

export const isInPriceBand = (price: number, band: PriceBand) =>
  price >= band.min && (band.maxExclusive === null || price < band.maxExclusive);

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const price = params.get('price');
  const recipient = params.get('for');
  const sort = params.get('sort');

  return {
    category: params.get('category')?.trim() || 'All',
    occasions: splitList(params.get('occasion')),
    price: PRICE_BANDS.some((band) => band.id === price) ? price : null,
    recipient: recipient === 'her' || recipient === 'him' ? recipient : null,
    tags: splitList(params.get('tags')).filter(isTagKey),
    query: params.get('q')?.trim() || '',
    sort: isSortKey(sort) ? sort : 'recommended',
  };
}

export function filtersToParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category !== 'All') params.set('category', filters.category);
  if (filters.occasions.length > 0) params.set('occasion', filters.occasions.join(','));
  if (filters.price) params.set('price', filters.price);
  if (filters.recipient) params.set('for', filters.recipient);
  if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.query) params.set('q', filters.query);
  if (filters.sort !== 'recommended') params.set('sort', filters.sort);
  return params;
}

export const countActiveFilters = (filters: CatalogFilters) =>
  filters.occasions.length + filters.tags.length + (filters.price ? 1 : 0) + (filters.recipient ? 1 : 0);

export function productMatches(product: Product, filters: CatalogFilters, ignore?: FacetKey): boolean {
  if (
    ignore !== 'category' &&
    filters.category !== 'All' &&
    normalize(product.category) !== normalize(filters.category)
  ) {
    return false;
  }

  if (ignore !== 'occasions' && filters.occasions.length > 0) {
    const productOccasions = (product.occasions ?? []).map(normalize);
    if (!filters.occasions.some((occasion) => productOccasions.includes(normalize(occasion)))) return false;
  }

  if (ignore !== 'price' && filters.price) {
    const band = PRICE_BANDS.find((candidate) => candidate.id === filters.price);
    if (band && !isInPriceBand(product.price, band)) return false;
  }

  if (ignore !== 'recipient' && filters.recipient) {
    const gender = product.gender;
    if (gender && gender !== 'unisex' && gender !== RECIPIENT_GENDER[filters.recipient]) return false;
  }

  if (ignore !== 'tags') {
    for (const tag of filters.tags) {
      if (tag === 'on-sale' && getDiscountPercent(product) === 0) return false;
      if (tag === 'bestseller' && !product.isBestSeller) return false;
      if (tag === 'new' && !product.isNew) return false;
      if (tag === 'personalized' && !product.is_customizable) return false;
      if (tag === 'in-stock' && isSoldOut(product)) return false;
    }
  }

  if (filters.query) {
    const haystack = [product.name, product.tagline, product.category, product.description, ...(product.occasions ?? [])]
      .map(normalize)
      .join(' ');
    const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  return true;
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  const soldOutLast = (a: Product, b: Product) => Number(isSoldOut(a)) - Number(isSoldOut(b));

  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => soldOutLast(a, b) || a.price - b.price);
    case 'price-desc':
      return list.sort((a, b) => soldOutLast(a, b) || b.price - a.price);
    case 'rating':
      return list.sort((a, b) => soldOutLast(a, b) || b.rating - a.rating || b.reviewCount - a.reviewCount);
    case 'newest':
      return list.sort(
        (a, b) =>
          soldOutLast(a, b) || Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || createdTime(b) - createdTime(a)
      );
    case 'bestselling':
      return list.sort(
        (a, b) =>
          soldOutLast(a, b) ||
          Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller)) ||
          b.reviewCount - a.reviewCount
      );
    default:
      return list.sort(soldOutLast);
  }
}

export function pickMostLoved(products: Product[], limit = 8): Product[] {
  const available = products.filter((product) => !isSoldOut(product));
  const bestSellers = sortProducts(available.filter((product) => product.isBestSeller), 'bestselling');
  const topRated = sortProducts(available.filter((product) => !product.isBestSeller), 'rating');
  return [...bestSellers, ...topRated].slice(0, limit);
}

export function pickNewArrivals(products: Product[], limit = 8): Product[] {
  return sortProducts(products.filter((product) => product.isNew && !isSoldOut(product)), 'newest').slice(0, limit);
}

export function pickDeals(products: Product[], limit = 8): Product[] {
  return products
    .filter((product) => getDiscountPercent(product) > 0 && !isSoldOut(product))
    .sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))
    .slice(0, limit);
}

export function pickRelated(product: Product, products: Product[], limit = 8): Product[] {
  const occasions = product.occasions ?? [];
  const score = (candidate: Product) =>
    (normalize(candidate.category) === normalize(product.category) ? 2 : 0) +
    (candidate.occasions ?? []).filter((occasion) => occasions.includes(occasion)).length;

  return products
    .filter((candidate) => candidate.id !== product.id && !isSoldOut(candidate))
    .sort((a, b) => score(b) - score(a) || b.rating - a.rating)
    .slice(0, limit);
}
