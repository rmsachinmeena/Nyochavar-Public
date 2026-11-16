import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { SafeImage } from '../../../components/ui/SafeImage';
import type { SellerLoginTheme } from './sellerLoginThemes';

/**
 * The picture and words side of the seller login page. It changes with the kind of seller:
 * a tall panel beside the form on computers, and a short banner above the form on phones.
 */
export const SellerLoginHero: React.FC<{ theme: SellerLoginTheme }> = ({ theme }) => {
  const Icon = theme.icon;

  return (
    <section
      aria-label={`${theme.label} sellers`}
      className="relative h-48 w-full shrink-0 overflow-hidden sm:h-60 lg:h-auto lg:min-h-dvh"
      style={{ backgroundColor: theme.overlay }}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={theme.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <SafeImage src={theme.image} alt="" loading="eager" className="h-full w-full object-cover" />
          {/* Dark shade of the seller's colour, so the words stay readable on any picture */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${theme.overlay}f2 0%, ${theme.overlay}b3 45%, ${theme.overlay}59 100%)`,
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="relative flex h-full flex-col justify-end p-5 text-white sm:p-8 lg:justify-between lg:p-12">
        <div className="hidden items-center gap-2 lg:flex">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/25">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/90">{theme.label}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={theme.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="max-w-xl"
          >
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ring-1 ring-white/25 backdrop-blur-md sm:text-[11px] lg:hidden"
            >
              <Icon className="h-3 w-3" /> {theme.label}
            </span>
            <h2 className="mt-2 font-serif text-2xl leading-[1.1] sm:text-3xl lg:mt-0 lg:text-[2.9rem]">{theme.headline}</h2>
            <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-white/85 sm:block lg:mt-4 lg:text-base">{theme.subtext}</p>
            <ul className="mt-6 hidden space-y-2.5 lg:block">
              {theme.points.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-sm font-medium text-white/95">
                  <CheckCircle2 className="h-[18px] w-[18px] shrink-0" style={{ color: theme.soft }} />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
