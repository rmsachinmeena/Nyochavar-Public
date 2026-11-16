import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../../types';
import { useCategories } from '../../hooks/useCatalog';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SafeImage } from '../../components/ui/SafeImage';
import { eventTracker } from '../../services/eventTracker';

const CATEGORY_BLURBS: Record<string, string> = {
  flowers: 'Hand-tied bouquets & fresh blooms',
  hampers: 'Gourmet treats, curated with love',
  'personalized gifts': 'Keepsakes made just for them',
};

export const CategoriesSection: React.FC<{ products: Product[] }> = ({ products }) => {
  const { categories } = useCategories();
  const containerRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const tiles = useMemo(() => {
    const withCounts = categories.map((category) => ({
      ...category,
      count: products.filter((product) => product.category.toLowerCase() === category.name.toLowerCase()).length,
    }));
    const available = products.length === 0 ? withCounts : withCounts.filter((category) => category.count > 0);
    return (available.length > 0 ? available : withCounts).slice(0, 12);
  }, [categories, products]);

  const updateScrollState = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scrollByCard = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const cardWidth = card ? card.offsetWidth + 16 : 280;
    el.scrollBy({
      left: direction === 'left' ? -cardWidth : cardWidth,
      behavior: 'smooth',
    });
  };

  // Auto-scroll every 2 seconds with user-interaction pause (Same as ProductRail)
  useEffect(() => {
    if (tiles.length <= 1) return;

    let isPaused = false;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      if (isPaused) return;
      const el = containerRef.current;
      if (!el) return;

      const card = el.firstElementChild as HTMLElement | null;
      const cardWidth = card ? card.offsetWidth + 16 : 280;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft >= maxScroll - 15) {
        // Rewind smoothly to start
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 2000); // Auto-scroll every 2 seconds

    const el = containerRef.current;
    const handlePause = () => {
      isPaused = true;
      if (pauseTimer) clearTimeout(pauseTimer);
    };

    const handleResume = () => {
      if (pauseTimer) clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        isPaused = false;
      }, 2500);
    };

    if (el) {
      updateScrollState();
      el.addEventListener('mouseenter', handlePause);
      el.addEventListener('mouseleave', handleResume);
      el.addEventListener('touchstart', handlePause, { passive: true });
      el.addEventListener('touchend', handleResume, { passive: true });
      el.addEventListener('scroll', updateScrollState, { passive: true });
      window.addEventListener('resize', updateScrollState);
    }

    return () => {
      clearInterval(interval);
      if (pauseTimer) clearTimeout(pauseTimer);
      if (el) {
        el.removeEventListener('mouseenter', handlePause);
        el.removeEventListener('mouseleave', handleResume);
        el.removeEventListener('touchstart', handlePause);
        el.removeEventListener('touchend', handleResume);
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      }
    };
  }, [tiles.length]);

  if (tiles.length === 0) return null;

  return (
    <section aria-label="Shop by category" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px] group">
      <SectionHeader eyebrow="Collections" title="Shop by category" action={{ label: 'View all categories', to: '/catalog' }} />

      <div className="relative mt-8">
        {/* Left Arrow Button (Responsive: Mobile & Desktop) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByCard('left')}
            aria-label="Scroll categories left"
            className="absolute left-1 sm:-left-3.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md border border-slate-200/90 backdrop-blur transition hover:bg-white hover:scale-105 active:scale-90"
          >
            <ChevronLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5 stroke-[2.2]" />
          </button>
        )}

        {/* Right Arrow Button (Responsive: Mobile & Desktop) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByCard('right')}
            aria-label="Scroll categories right"
            className="absolute right-1 sm:-right-3.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md border border-slate-200/90 backdrop-blur transition hover:bg-white hover:scale-105 active:scale-90"
          >
            <ChevronRight className="h-4 w-4 sm:h-4.5 sm:w-4.5 stroke-[2.2]" />
          </button>
        )}

        <ul
          ref={containerRef}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth scroll-px-4 px-4 pb-2 sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:px-0"
        >
          {tiles.map((category) => (
            <li key={category.id} className="w-[78vw] max-w-[290px] sm:w-[48%] md:w-[35%] lg:w-[285px] shrink-0 snap-start">
              <Link
                to={`/catalog?category=${encodeURIComponent(category.name)}`}
                onClick={() => {
                  eventTracker.trackPageView(`Category: ${category.name}`, { category: category.name });
                }}
                className="group/card relative block aspect-[4/3] sm:aspect-[4/3] lg:aspect-[4/5] xl:aspect-[3/4] overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-200/60 shadow-sm transition-all duration-500 hover:shadow-card-hover hover:-translate-y-1"
              >
                <SafeImage
                  src={category.image_url || undefined}
                  alt={category.name}
                  className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover/card:scale-105"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2.5 p-4 sm:p-6">
                  <div className="min-w-0 text-white">
                    <h3 className="font-serif text-xl sm:text-[26px] lg:text-[28px] leading-tight font-medium drop-shadow-xs">{category.name}</h3>
                    <p className="mt-0.5 text-xs sm:text-sm text-white/85 line-clamp-1">
                      {CATEGORY_BLURBS[category.name.toLowerCase()] ?? `${category.count} gifts available`}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-md transition-all duration-300 group-hover/card:bg-brand group-hover/card:text-white group-hover/card:scale-110">
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CategoriesSection;
