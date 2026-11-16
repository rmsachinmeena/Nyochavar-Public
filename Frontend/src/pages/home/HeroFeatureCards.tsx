import React from 'react';
import { Gift, PenLine, ShieldCheck, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// One slim line of trust points instead of four big tiles: it saves room on a phone and still builds trust.
// Icons (not emoji) so they look the same on every phone and computer.
const TRUST_CHIPS: { id: string; icon: LucideIcon; label: string; tone: string }[] = [
  { id: 'same-day', icon: Zap, label: 'Same-day delivery', tone: 'bg-amber-100 text-amber-600' },
  { id: 'handwritten-note', icon: PenLine, label: 'Free handwritten note', tone: 'bg-violet-100 text-violet-600' },
  { id: 'premium-wrapping', icon: Gift, label: 'Premium wrapping', tone: 'bg-rose-100 text-rose-600' },
  { id: 'delight-guarantee', icon: ShieldCheck, label: 'Delight guarantee', tone: 'bg-emerald-100 text-emerald-600' },
];

export const HeroFeatureCards: React.FC = () => (
  <section aria-label="Why choose Nyochavar" className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 xl:max-w-[1360px]">
    {/*
      Phone and tablet: one line of pills that scrolls sideways.
      Desktop: one clean bar split into four equal parts.
    */}
    <ul
      className="flex snap-x gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] sm:justify-center sm:gap-3
        lg:grid lg:snap-none lg:grid-cols-4 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white lg:py-0 lg:shadow-[0_2px_12px_rgba(15,23,42,0.05)]
        lg:divide-x lg:divide-slate-100 [&::-webkit-scrollbar]:hidden"
    >
      {TRUST_CHIPS.map((chip) => {
        const Icon = chip.icon;
        return (
          <li
            key={chip.id}
            className="inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]
              sm:text-[13px] lg:justify-center lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-4 lg:py-4 lg:text-sm lg:font-bold lg:text-slate-800 lg:shadow-none"
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full lg:h-9 lg:w-9 ${chip.tone}`}>
              <Icon className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5" strokeWidth={2.2} aria-hidden="true" />
            </span>
            {chip.label}
          </li>
        );
      })}
    </ul>
  </section>
);

export default HeroFeatureCards;
