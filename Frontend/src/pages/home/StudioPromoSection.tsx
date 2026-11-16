import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { SafeImage } from '../../components/ui/SafeImage';

// COMMENTED: Static palette options removed. Should fetch from API instead.
const DEFAULT_PALETTE = {
  id: 'default',
  name: 'Default Palette',
  tagline: 'Curated gift experiences',
  colorSwatches: ['#3B82F6', '#1F2937'],
  previewImage: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=1200'
};

const STEPS = [
  { title: 'Pick a theme', text: 'Choose blooms, treats and a colour story.' },
  { title: 'Make it personal', text: 'Add a photo and a handwritten letter.' },
  { title: 'We hand-deliver', text: 'Wrapped, wax-sealed and delivered same-day.' },
];

export const StudioPromoSection: React.FC = () => {
  const [hero, second, third] = [DEFAULT_PALETTE, DEFAULT_PALETTE, DEFAULT_PALETTE];

  return (
    <section aria-label="Hamper Studio" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px]">
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-[#0f172a] to-blue-950 text-white shadow-2xl">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-brand/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative grid items-center gap-10 p-6 pb-12 sm:p-10 sm:pb-14 lg:grid-cols-12 lg:gap-12 xl:gap-16 lg:p-16">
          {/* Left Column (Content & Steps) */}
          <div className="lg:col-span-6 xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Hamper Studio</span>
            </div>

            <h2 className="mt-4 font-serif text-[28px] leading-[1.12] sm:text-4xl lg:text-[2.75rem] xl:text-5xl">
              Build a hamper as unique as they are
            </h2>
            <p className="mt-4 max-w-lg text-[15px] sm:text-base leading-relaxed text-slate-300">
              Design a one-of-a-kind gift in three simple steps — we’ll hand-assemble it with artisanal precision in our atelier.
            </p>

            <ol className="mt-8 space-y-4 sm:space-y-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full bg-white/10 border border-white/20 font-serif text-sm sm:text-base text-blue-300">
                    {index + 1}
                  </span>
                  <div className="pt-0.5">
                    <span className="block text-sm sm:text-base font-bold text-white">{step.title}</span>
                    <span className="mt-0.5 block text-xs sm:text-sm text-slate-400">{step.text}</span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* The studio is not open yet: a small tag instead of the "Start building" button */}
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-3.5 py-1.5 text-xs font-bold tracking-wide text-amber-200 sm:h-12 sm:gap-2 sm:px-6 sm:text-sm">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                Services coming soon
              </span>
              <Link
                to="/catalog?category=Hampers"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                Shop ready-made hampers
              </Link>
            </div>
          </div>

          {/* Right Column (Visual Collage) */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none lg:col-span-6 xl:col-span-5">
            <div className="grid grid-cols-5 gap-3 sm:gap-4">
              <div className="col-span-3 aspect-[4/5] overflow-hidden rounded-3xl bg-white/5 border border-white/10 shadow-lg">
                <SafeImage src={hero?.previewImage} alt={hero?.name ?? 'Signature hamper'} className="h-full w-full object-cover" />
              </div>
              <div className="col-span-2 flex flex-col gap-3 sm:gap-4">
                <div className="flex-1 overflow-hidden rounded-3xl bg-white/5 border border-white/10 shadow-md">
                  <SafeImage src={third?.previewImage} alt={third?.name ?? ''} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 overflow-hidden rounded-3xl bg-white/5 border border-white/10 shadow-md">
                  <SafeImage src={second?.previewImage} alt={second?.name ?? ''} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>

            {/* Handwritten Note Floating Card */}
            <div className="absolute -bottom-5 left-2 max-w-[15rem] sm:max-w-[17rem] -rotate-2 rounded-2xl bg-white p-4 text-ink shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] border border-slate-100 sm:-left-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Handwritten Note</p>
              <p className="mt-1 font-script text-2xl leading-tight text-brand">“Happy anniversary, my love — here’s to forever.”</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudioPromoSection;
