import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../../types';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

interface ProductRailProps {
  products: Product[];
  isLoading?: boolean;
}

// Responsive widths for horizontal snap carousel
const ITEM = 'w-[68%] sm:w-[45%] md:w-[32%] lg:w-[280px] shrink-0 snap-start';

export const ProductRail: React.FC<ProductRailProps> = ({ products, isLoading = false }) => {
  const containerRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const displayProducts = products.slice(0, 12);

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

  // Auto-scroll every 3 seconds with user-interaction pause
  useEffect(() => {
    if (isLoading || displayProducts.length <= 1) return;

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
    }, 2000); // 2 second gap

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
      el.addEventListener('mouseenter', handlePause);
      el.addEventListener('mouseleave', handleResume);
      el.addEventListener('touchstart', handlePause, { passive: true });
      el.addEventListener('touchend', handleResume, { passive: true });
      el.addEventListener('scroll', updateScrollState, { passive: true });
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
      }
    };
  }, [isLoading, displayProducts.length]);

  return (
    <div className="relative group">
      {/* Desktop/Tablet Left Arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCard('left')}
          aria-label="Scroll products left"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 transition hover:bg-slate-50 hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
      )}

      {/* Desktop/Tablet Right Arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCard('right')}
          aria-label="Scroll products right"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 transition hover:bg-slate-50 hover:scale-105 active:scale-95"
        >
          <ChevronRight className="h-4.5 w-4.5" />
        </button>
      )}

      <ul
        ref={containerRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth scroll-px-4 px-4 pb-3 sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 md:gap-5 lg:mx-0 lg:px-0"
      >
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <li key={index} className={ITEM}>
                <ProductCardSkeleton />
              </li>
            ))
          : displayProducts.map((product) => (
              <li key={product.id} className={ITEM}>
                <ProductCard product={product} className="w-full" />
              </li>
            ))}
      </ul>
    </div>
  );
};

export default ProductRail;
