import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PRICE_BANDS, isInPriceBand, isSoldOut } from '../../utils/catalog';
import { eventTracker } from '../../services/eventTracker';

/** "Budget batao": four chips, each one opens the catalogue already filtered to that budget. */
export const BudgetSection: React.FC<{ products: Product[] }> = ({ products }) => {
  const bands = useMemo(
    () =>
      PRICE_BANDS.map((band) => ({
        band,
        count: products.filter((product) => !isSoldOut(product) && isInPriceBand(product.price, band)).length,
      })),
    [products]
  );

  return (
    <section aria-label="Shop by budget" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px]">
      <SectionHeader eyebrow="Gift by budget" title="Budget batao, gift hum dhoondhenge" />

      <ul className="mt-6 flex flex-wrap gap-2.5 sm:gap-3 lg:mt-8 lg:justify-center lg:gap-4">
        {bands.map(({ band, count }) => {
          const premium = band.maxExclusive === null;
          return (
            <li key={band.id}>
              <Link
                to={`/catalog?price=${band.id}`}
                onClick={() => eventTracker.trackSearch(`Budget: ${band.label}`, count)}
                className={`inline-flex h-12 items-center rounded-full border px-5 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-6 lg:h-14 lg:px-9 lg:text-base ${
                  premium
                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-brand hover:text-brand'
                }`}
              >
                {band.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default BudgetSection;
