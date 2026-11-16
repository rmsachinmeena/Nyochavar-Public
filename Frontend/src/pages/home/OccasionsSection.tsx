import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { getOccasionMeta, occasionHref } from '../../utils/occasionUtils';
import { eventTracker } from '../../services/eventTracker';

// The row on the home page: one round icon per occasion, each shown once.
// `name` is the occasion the catalogue filters by, `label` is what the shopper reads.
const ROW: { name: string; label: string }[] = [
  { name: 'Birthday', label: 'Birthday' },
  { name: 'Anniversary', label: 'Anniversary' },
  { name: 'Wedding', label: 'Wedding' },
  { name: 'Diwali', label: 'Diwali' },
  { name: 'Raksha Bandhan', label: 'Rakhi' },
  { name: "Valentine's", label: "Valentine's" },
  { name: 'Housewarming', label: 'Housewarming' },
];

// Festivals have a date. The one that is coming up soon moves to the front with a small badge.
// Dates are for the festival day (update the list when a new year starts); Valentine's falls on 14 Feb every year.
const FESTIVAL_DATES: Record<string, string[]> = {
  Diwali: ['2026-11-08', '2027-10-29', '2028-11-17'],
  'Raksha Bandhan': ['2026-08-28', '2027-08-17', '2028-08-05'],
  "Valentine's": ['2027-02-14', '2028-02-14', '2029-02-14'],
};
const SOON_WITHIN_DAYS = 45;

const daysUntil = (iso: string, today: Date) => {
  const day = new Date(`${iso}T00:00:00`);
  return Math.ceil((day.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
};

/** The festival closest to today (still ahead, or today) and within the next 45 days, or null. */
const upcomingFestival = (today: Date): string | null => {
  let best: { name: string; days: number } | null = null;
  for (const [name, dates] of Object.entries(FESTIVAL_DATES)) {
    for (const iso of dates) {
      const days = daysUntil(iso, today);
      if (days >= 0 && days <= SOON_WITHIN_DAYS && (!best || days < best.days)) best = { name, days };
    }
  }
  return best?.name ?? null;
};

export const OccasionsSection: React.FC = () => {
  const { items, soon } = useMemo(() => {
    const soonName = upcomingFestival(new Date());
    const ordered = soonName ? [...ROW.filter((item) => item.name === soonName), ...ROW.filter((item) => item.name !== soonName)] : ROW;
    return { items: ordered, soon: soonName };
  }, []);

  return (
    <section aria-label="Shop by occasion" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px]">
      <SectionHeader eyebrow="Shop by occasion" title="A gift for every moment" action={{ label: 'All occasions', to: '/catalog' }} />

      {/* One line of round icons: it scrolls sideways on a phone and sits in the middle on a wide screen */}
      <ul className="no-scrollbar -mx-4 mt-7 flex snap-x gap-4 overflow-x-auto px-4 pb-1 pt-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:justify-center lg:gap-8 lg:px-0">
        {items.map((item) => {
          const meta = getOccasionMeta(item.name);
          if (!meta) return null;
          const Icon = meta.icon;
          const isSoon = soon === item.name;

          return (
            <li key={item.name} className="shrink-0 snap-start">
              <Link
                to={occasionHref(item.name)}
                onClick={() => eventTracker.trackPageView(`Occasion: ${item.name}`, { occasion: item.name })}
                className="group flex w-[4.75rem] flex-col items-center gap-2 text-center outline-none transition-transform active:scale-95 sm:w-[5.5rem] lg:w-[6.5rem]"
              >
                <span className="relative">
                  {isSoon && (
                    <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-extrabold leading-none text-white shadow-sm ring-2 ring-white">
                      {item.label} 🔥
                    </span>
                  )}
                  <span
                    className={`grid h-16 w-16 place-items-center rounded-full sm:h-[4.5rem] sm:w-[4.5rem] lg:h-20 lg:w-20 ${meta.tint} ring-1 ring-inset ring-black/[0.04] shadow-xs transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.12)] group-focus-visible:ring-2 group-focus-visible:ring-brand ${
                      isSoon ? 'ring-2 ring-orange-300' : ''
                    }`}
                  >
                    <Icon className={`h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 ${meta.iconColor}`} strokeWidth={1.85} />
                  </span>
                </span>
                <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-slate-800 transition-colors group-hover:text-brand sm:text-xs lg:text-sm">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default OccasionsSection;
