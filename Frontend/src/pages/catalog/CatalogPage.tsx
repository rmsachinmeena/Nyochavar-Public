import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useCategories, useProducts } from '../../hooks/useCatalog';
import { ProductCard, ProductCardSkeleton } from '../../components/product/ProductCard';
import { ProductRail } from '../../components/product/ProductRail';
import { Sheet } from '../../components/ui/Sheet';
import { FilterPanel } from './FilterPanel';
import type { FacetCounts } from './FilterPanel';
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  PRICE_BANDS,
  RECIPIENT_OPTIONS,
  SORT_OPTIONS,
  TAG_OPTIONS,
  countActiveFilters,
  filtersToParams,
  isInPriceBand,
  parseFilters,
  pickMostLoved,
  productMatches,
  sortProducts,
} from '../../utils/catalog';
import type { CatalogFilters, SortKey, TagKey } from '../../utils/catalog';
import { exploreSettingsService, ExploreSettings } from '../../services/exploreSettingsService';
import { eventTracker } from '../../services/eventTracker';
import { useSeo } from '../../hooks/useSeo';

const CATEGORY_COPY: Record<string, string> = {
  flowers: 'Fresh, hand-tied bouquets and arrangements for every feeling.',
  hampers: 'Curated hampers of gourmet treats, keepsakes and blooms.',
  'personalized gifts': 'Keepsakes made just for them — names, photos and heartfelt messages.',
};

const DEFAULT_COPY = 'Thoughtfully curated gifts';

const GRID = 'mt-6 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 lg:gap-x-6 lg:gap-y-10';

function describeFilters(filters: CatalogFilters): { title: string; crumb: string | null } {
  if (filters.query) return { title: `Results for “${filters.query}”`, crumb: 'Search results' };

  const occasion = filters.occasions.length === 1 ? filters.occasions[0] : null;
  if (filters.category !== 'All') {
    return {
      title: occasion ? `${occasion} ${filters.category.toLowerCase()}` : filters.category,
      crumb: filters.category,
    };
  }
  if (occasion) return { title: `${occasion} gifts`, crumb: `${occasion} gifts` };

  if (filters.tags.length === 1) {
    const tag = TAG_OPTIONS.find((option) => option.value === filters.tags[0]);
    if (tag && (tag.value === 'on-sale' || tag.value === 'bestseller' || tag.value === 'new')) {
      return { title: tag.label, crumb: tag.label };
    }
  }
  if (filters.recipient) {
    const label = filters.recipient === 'her' ? 'Gifts for her' : 'Gifts for him';
    return { title: label, crumb: label };
  }
  if (filters.price) {
    const band = PRICE_BANDS.find((candidate) => candidate.id === filters.price);
    if (band) return { title: `Gifts ${band.label.charAt(0).toLowerCase()}${band.label.slice(1)}`, crumb: band.label };
  }
  return { title: 'All gifts', crumb: null };
}

// Custom dropdown (instead of a native <select>) so the list matches the theme and stays small on every screen
const SortSelect: React.FC<{ value: SortKey; onChange: (value: SortKey) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, SORT_OPTIONS.findIndex((option) => option.value === value));
  const selected = SORT_OPTIONS[selectedIndex];

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (next: SortKey) => {
    onChange(next);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openMenu();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + step + SORT_OPTIONS.length) % SORT_OPTIONS.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(SORT_OPTIONS[activeIndex].value);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Sort gifts"
        className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border bg-white pl-4 pr-3 text-sm font-medium text-ink transition hover:border-slate-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/10 ${
          open ? 'border-brand ring-4 ring-brand/10' : 'border-slate-200'
        }`}
      >
        <span className="whitespace-nowrap">{selected.value === 'recommended' ? 'Sort: Recommended' : selected.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Sort gifts"
          className="absolute right-0 top-full z-30 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150"
        >
          {SORT_OPTIONS.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option.value)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                  isSelected ? 'font-semibold text-brand' : 'font-medium text-ink'
                } ${index === activeIndex ? 'bg-brand-soft' : ''}`}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const CatalogPage: React.FC = () => {
  useSeo({
    title: 'Shop gifts',
    description: 'Browse bespoke hampers, flowers and personalised gifts from Nyochavar. Pick a date and slot, and we deliver it with a handwritten note.',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const { products, isLoading } = useProducts();
  const { categories } = useCategories();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exploreSettings, setExploreSettings] = useState<ExploreSettings>(exploreSettingsService.getSettings());
  const [selectedCurated, setSelectedCurated] = useState<'trending' | 'new' | 'budget' | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = exploreSettingsService.subscribe(setExploreSettings);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (filters.query && filters.query.trim()) {
      eventTracker.trackSearch(filters.query.trim(), results.length);
    } else if (filters.price) {
      const band = PRICE_BANDS.find((candidate) => candidate.id === filters.price);
      eventTracker.trackSearch(`Budget: ${band?.label || filters.price}`, results.length);
    } else if (filters.category && filters.category !== 'All') {
      eventTracker.trackPageView(`Catalog: ${filters.category}`, { category: filters.category, results_count: results.length });
    }
  }, [filters.query, filters.price, filters.category, isLoading]);

  const curatedCounts = useMemo(() => ({
    trending: products.filter((p) => p.is_trending).length,
    new: products.filter((p) => p.isNew).length,
    budget: products.filter((p) => p.is_budget_friendly || p.price <= exploreSettings.budgetMaxPrice).length,
  }), [products, exploreSettings.budgetMaxPrice]);

  const scrollMobile = (direction: 'left' | 'right') => {
    if (mobileScrollRef.current) {
      const cardWidth = 275;
      mobileScrollRef.current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth',
      });
    }
  };

  const paramsKey = searchParams.toString();
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [paramsKey]);

  const applyFilters = (next: CatalogFilters) => setSearchParams(filtersToParams(next), { replace: true });
  const updateFilters = (patch: Partial<CatalogFilters>) => applyFilters({ ...filters, ...patch });
  const clearFacets = () =>
    applyFilters({ ...EMPTY_FILTERS, category: filters.category, query: filters.query, sort: filters.sort });

  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCurated === 'trending') {
      list = list.filter((p) => p.is_trending);
    } else if (selectedCurated === 'new') {
      list = list.filter((p) => p.isNew);
    } else if (selectedCurated === 'budget') {
      list = list.filter((p) => p.is_budget_friendly || p.price <= exploreSettings.budgetMaxPrice);
    }
    return list;
  }, [products, selectedCurated, exploreSettings]);

  const results = useMemo(
    () => sortProducts(filteredProducts.filter((product) => productMatches(product, filters)), filters.sort),
    [filteredProducts, filters]
  );
  const visible = results.slice(0, visibleCount);

  const categoryChips = useMemo(() => {
    const inScope = products.filter((product) => productMatches(product, filters, 'category'));
    const counts = new Map<string, { name: string; count: number }>();
    inScope.forEach((product) => {
      const key = product.category.toLowerCase();
      const existing = counts.get(key);
      counts.set(key, { name: existing?.name ?? product.category, count: (existing?.count ?? 0) + 1 });
    });

    const ordered = categories.map((category) => counts.get(category.name.toLowerCase()) ?? { name: category.name, count: 0 });
    counts.forEach((value, key) => {
      if (!categories.some((category) => category.name.toLowerCase() === key)) ordered.push(value);
    });

    return {
      total: inScope.length,
      chips: ordered.filter(
        (chip) => chip.count > 0 || chip.name.toLowerCase() === filters.category.toLowerCase()
      ),
    };
  }, [products, categories, filters]);

  const counts: FacetCounts = useMemo(() => {
    const occasionCounts = new Map<string, number>();
    products
      .filter((product) => productMatches(product, filters, 'occasions'))
      .forEach((product) =>
        (product.occasions ?? []).forEach((occasion) => occasionCounts.set(occasion, (occasionCounts.get(occasion) ?? 0) + 1))
      );
    filters.occasions.forEach((occasion) => {
      const known = [...occasionCounts.keys()].some((name) => name.toLowerCase() === occasion.toLowerCase());
      if (!known) occasionCounts.set(occasion, 0);
    });

    const priceScope = products.filter((product) => productMatches(product, filters, 'price'));
    const tagScope = products.filter((product) => productMatches(product, filters, 'tags'));

    return {
      occasions: [...occasionCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      prices: Object.fromEntries(
        PRICE_BANDS.map((band) => [band.id, priceScope.filter((product) => isInPriceBand(product.price, band)).length])
      ),
      tags: Object.fromEntries(
        TAG_OPTIONS.map((tag) => [
          tag.value,
          tagScope.filter((product) => productMatches(product, { ...EMPTY_FILTERS, tags: [tag.value] })).length,
        ])
      ) as Record<TagKey, number>,
    };
  }, [products, filters]);

  const activeChips = [
    ...(filters.query ? [{ key: 'q', label: `“${filters.query}”`, onRemove: () => updateFilters({ query: '' }) }] : []),
    ...(filters.recipient
      ? [
          {
            key: 'for',
            label: RECIPIENT_OPTIONS.find((option) => option.value === filters.recipient)?.label ?? '',
            onRemove: () => updateFilters({ recipient: null }),
          },
        ]
      : []),
    ...filters.occasions.map((occasion) => ({
      key: `occasion-${occasion}`,
      label: occasion,
      onRemove: () => updateFilters({ occasions: filters.occasions.filter((value) => value !== occasion) }),
    })),
    ...(filters.price
      ? [
          {
            key: 'price',
            label: PRICE_BANDS.find((band) => band.id === filters.price)?.label ?? '',
            onRemove: () => updateFilters({ price: null }),
          },
        ]
      : []),
    ...filters.tags.map((tag) => ({
      key: `tag-${tag}`,
      label: TAG_OPTIONS.find((option) => option.value === tag)?.label ?? tag,
      onRemove: () => updateFilters({ tags: filters.tags.filter((value) => value !== tag) }),
    })),
  ];

  const facetCount = countActiveFilters(filters);
  const { title, crumb } = describeFilters(filters);
  const description =
    filters.category !== 'All' ? CATEGORY_COPY[filters.category.toLowerCase()] ?? DEFAULT_COPY : DEFAULT_COPY;
  const suggestions = useMemo(() => pickMostLoved(products, 8), [products]);

  return (
    <div className="pb-20 sm:pb-24">
      <div className="mx-auto max-w-7xl px-5 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <Link to="/" className="transition-colors hover:text-ink">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          {crumb ? (
            <>
              <Link to="/catalog" className="transition-colors hover:text-ink">
                Shop
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span aria-current="page" className="truncate text-ink">
                {crumb}
              </span>
            </>
          ) : (
            <span aria-current="page" className="text-ink">
              Shop
            </span>
          )}
        </nav>

        <div className="mt-4 max-w-3xl">
          <h1 className="font-serif text-[32px] leading-[1.1] tracking-[-0.01em] text-ink sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-500">{description}</p>
        </div>

        <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
          {/* All gifts chip */}
          <button
            type="button"
            aria-pressed={filters.category === 'All' && selectedCurated === null}
            onClick={() => {
              setSelectedCurated(null);
              updateFilters({ category: 'All' });
            }}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
              filters.category === 'All' && selectedCurated === null
                ? 'border-ink bg-ink text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-ink'
            }`}
          >
            All gifts
            {!isLoading && (
              <span className={`text-xs tabular-nums ${filters.category === 'All' && selectedCurated === null ? 'text-white/60' : 'text-slate-400'}`}>
                {categoryChips.total}
              </span>
            )}
          </button>

          {/* Admin Curated Collections: 🔥 Trending */}
          {exploreSettings.collections.trending.enabled && (
            <button
              type="button"
              aria-pressed={selectedCurated === 'trending'}
              onClick={() => setSelectedCurated((prev) => (prev === 'trending' ? null : 'trending'))}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${
                selectedCurated === 'trending'
                  ? 'border-brand bg-brand text-white shadow-xs'
                  : 'border-blue-100 bg-blue-50/70 text-brand hover:border-blue-200 hover:bg-blue-100/70'
              }`}
            >
              <span>🔥</span> Trending
              {!isLoading && (
                <span className={`text-xs tabular-nums ${selectedCurated === 'trending' ? 'text-white/80' : 'text-blue-600/80 font-bold'}`}>
                  {curatedCounts.trending}
                </span>
              )}
            </button>
          )}

          {/* Admin Curated Collections: ✨ New Arrivals */}
          {exploreSettings.collections.new.enabled && (
            <button
              type="button"
              aria-pressed={selectedCurated === 'new'}
              onClick={() => setSelectedCurated((prev) => (prev === 'new' ? null : 'new'))}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${
                selectedCurated === 'new'
                  ? 'border-[#6938ef] bg-[#6938ef] text-white shadow-xs'
                  : 'border-purple-100 bg-purple-50/70 text-[#6938ef] hover:border-purple-200 hover:bg-purple-100/70'
              }`}
            >
              <span>✨</span> New Arrivals
              {!isLoading && (
                <span className={`text-xs tabular-nums ${selectedCurated === 'new' ? 'text-white/80' : 'text-purple-600/80 font-bold'}`}>
                  {curatedCounts.new}
                </span>
              )}
            </button>
          )}

          {/* Admin Curated Collections: 🏷️ Budget Friendly */}
          {exploreSettings.collections.budget.enabled && (
            <button
              type="button"
              aria-pressed={selectedCurated === 'budget'}
              onClick={() => setSelectedCurated((prev) => (prev === 'budget' ? null : 'budget'))}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${
                selectedCurated === 'budget'
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                  : 'border-emerald-100 bg-emerald-50/70 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100/70'
              }`}
            >
              <span>🏷️</span> Under ₹{exploreSettings.budgetMaxPrice}
              {!isLoading && (
                <span className={`text-xs tabular-nums ${selectedCurated === 'budget' ? 'text-white/80' : 'text-emerald-600/80 font-bold'}`}>
                  {curatedCounts.budget}
                </span>
              )}
            </button>
          )}

          {/* Standard Categories - All preserved! */}
          {categoryChips.chips.map((chip) => {
            const active = selectedCurated === null && filters.category.toLowerCase() === chip.name.toLowerCase();
            return (
              <button
                key={chip.name}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedCurated(null);
                  updateFilters({ category: chip.name });
                }}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
                  active
                    ? 'border-ink bg-ink text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-ink'
                }`}
              >
                {chip.name}
                {!isLoading && (
                  <span className={`text-xs tabular-nums ${active ? 'text-white/60' : 'text-slate-400'}`}>{chip.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky top-[72px] z-30 mt-5 border-y border-slate-100 bg-white/95 backdrop-blur-md sm:top-[80px] lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-ink transition hover:border-slate-300"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {facetCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                {facetCount}
              </span>
            )}
          </button>
          <SortSelect value={filters.sort} onChange={(sort) => updateFilters({ sort })} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-12">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="no-scrollbar sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Filters</h2>
                {facetCount > 0 && (
                  <button type="button" onClick={clearFacets} className="text-sm font-medium text-brand hover:underline">
                    Clear all
                  </button>
                )}
              </div>
              <FilterPanel filters={filters} counts={counts} onChange={updateFilters} />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-sm text-slate-500">
                {isLoading ? (
                  'Loading gifts…'
                ) : (
                  <>
                    <span className="font-semibold text-ink">{results.length}</span> {results.length === 1 ? 'gift' : 'gifts'}
                  </>
                )}
              </p>
              <div className="hidden lg:block">
                <SortSelect value={filters.sort} onChange={(sort) => updateFilters({ sort })} />
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft pl-3 pr-2 text-[13px] font-medium text-brand transition hover:bg-blue-100"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                {activeChips.length > 1 && (
                  <button
                    type="button"
                    onClick={() => applyFilters({ ...EMPTY_FILTERS, category: filters.category, sort: filters.sort })}
                    className="px-1 text-[13px] font-medium text-slate-500 underline-offset-2 transition hover:text-ink hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {isLoading ? (
              <>
                {/* Mobile skeleton carousel */}
                <div className="flex gap-3 overflow-hidden sm:hidden mt-4">
                  {Array.from({ length: 2 }, (_, index) => (
                    <div key={index} className="w-[78vw] max-w-[270px] shrink-0">
                      <ProductCardSkeleton />
                    </div>
                  ))}
                </div>
                {/* Desktop skeleton grid */}
                <ul className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5 lg:gap-6 mt-6">
                  {Array.from({ length: 6 }, (_, index) => (
                    <li key={index}>
                      <ProductCardSkeleton />
                    </li>
                  ))}
                </ul>
              </>
            ) : results.length === 0 ? (
              <div className="mt-6">
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
                    <SearchX className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-serif text-2xl text-ink">No gifts match just yet</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                    Try removing a filter or two — or explore our most-loved gifts below.
                  </p>
                  <button
                    type="button"
                    onClick={() => applyFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
                    className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-soft"
                  >
                    Clear all filters
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-14">
                    <h2 className="font-serif text-2xl text-ink">You might love these</h2>
                    <div className="mt-6">
                      <ProductRail products={suggestions} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* MOBILE VIEW (< sm): Horizontal swipe slider / carousel showing 1 card at a time with 2nd card peeking */}
                <div className="relative sm:hidden mt-4">
                  {/* Floating Circular Arrow Buttons */}
                  {results.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => scrollMobile('left')}
                        aria-label="Previous card"
                        className="absolute -left-2.5 top-[38%] -translate-y-1/2 z-20 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 active:scale-90 transition-transform"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollMobile('right')}
                        aria-label="Next card"
                        className="absolute -right-2.5 top-[38%] -translate-y-1/2 z-20 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 active:scale-90 transition-transform"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {/* Horizontal Track with peek on next card */}
                  <div
                    ref={mobileScrollRef}
                    className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 snap-x snap-mandatory no-scrollbar scroll-smooth"
                    style={{ scrollSnapType: 'x mandatory' }}
                  >
                    {visible.map((product) => (
                      <div
                        key={product.id}
                        className="w-[78vw] max-w-[270px] min-w-[245px] shrink-0 snap-start"
                      >
                        <ProductCard product={product} className="w-full" />
                      </div>
                    ))}
                  </div>

                  <p className="text-center text-[11px] font-medium text-slate-400 mt-1">
                    ← Swipe or tap arrows to explore {results.length} gifts →
                  </p>
                </div>

                {/* DESKTOP VIEW (>= sm): Standard multi-column grid */}
                <ul className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5 lg:gap-6 mt-6">
                  {visible.map((product) => (
                    <li key={product.id} className="flex">
                      <ProductCard product={product} className="w-full" />
                    </li>
                  ))}
                </ul>

                {results.length > visible.length && (
                  <div className="mt-12 flex flex-col items-center gap-4">
                    <p className="text-sm text-slate-500">
                      Showing {visible.length} of {results.length} gifts
                    </p>
                    <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-ink transition-all duration-500"
                        style={{ width: `${(visible.length / results.length) * 100}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                      className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 px-8 text-sm font-semibold text-ink transition hover:border-ink hover:bg-ink hover:text-white"
                    >
                      Load more gifts
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="bottom"
        title="Filters"
        footer={
          <div className="flex items-center gap-3 px-5 py-3">
            <button
              type="button"
              onClick={clearFacets}
              disabled={facetCount === 0}
              className="h-12 flex-1 rounded-full border border-slate-200 text-sm font-semibold text-ink transition disabled:opacity-40"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="h-12 flex-[2] rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-ink-soft"
            >
              Show {results.length} {results.length === 1 ? 'gift' : 'gifts'}
            </button>
          </div>
        }
      >
        <div className="px-5 pb-4 pt-5">
          <FilterPanel filters={filters} counts={counts} onChange={updateFilters} />
        </div>
      </Sheet>
    </div>
  );
};

export default CatalogPage;
