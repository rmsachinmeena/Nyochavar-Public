import React, { useEffect, useRef } from 'react';
import { BadgeCheck, Quote, Star } from 'lucide-react';
import { SectionHeader } from '../../components/ui/SectionHeader';

interface Testimonial {
  name: string;
  occasion: string;
  quote: string;
  stars: number;
}

// PLACEHOLDER TEXT: these cards only show how the section will look. Replace them with real customer reviews before
// the shop goes live (showing made-up reviews as real ones can mislead shoppers and is against the consumer rules).
const TESTIMONIALS: Testimonial[] = [
  { name: 'Aarav Sharma', occasion: 'Birthday', stars: 5, quote: 'Reached before the cake was cut. Mummy loved the handwritten note!' },
  { name: 'Priya Nair', occasion: 'Anniversary', stars: 5, quote: 'The roses were fresh and the wrapping looked really premium.' },
  { name: 'Rohan Mehta', occasion: 'Raksha Bandhan', stars: 5, quote: 'Sent a hamper to my sister in Jaipur. Perfect timing.' },
  { name: 'Ananya Iyer', occasion: 'Housewarming', stars: 4, quote: 'Simple, elegant and on the dot. Will order again.' },
  { name: 'Vikram Singh', occasion: 'Diwali', stars: 5, quote: 'Great packaging. My parents were pleasantly surprised.' },
  { name: 'Sneha Patil', occasion: 'Wedding', stars: 5, quote: 'The personalised gift looked exactly like the photo I chose.' },
  { name: 'Karan Malhotra', occasion: "Valentine's", stars: 5, quote: 'Same-day delivery saved my plan. Thank you!' },
  { name: 'Meera Joshi', occasion: 'Thank you gift', stars: 4, quote: 'The delivery partner was polite and called before arriving.' },
  { name: 'Imran Qureshi', occasion: 'Eid', stars: 5, quote: 'Neat, tasteful and delivered with a smile.' },
  { name: 'Divya Reddy', occasion: 'Birthday', stars: 5, quote: 'Easy to order from my phone, and my friend cried happy tears.' },
];

const AVATAR_TONES = ['bg-blue-100 text-blue-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700'];

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// The cards are listed twice, so when the first half has scrolled past, the strip jumps back and nobody sees an end
const LOOPED = [...TESTIMONIALS, ...TESTIMONIALS];
const SPEED_PX_PER_FRAME = 0.5; // slow and steady

export const TestimonialsSection: React.FC = () => {
  const stripRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let position = el.scrollLeft;
    let paused = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;

    const tick = () => {
      if (!paused) {
        position += SPEED_PX_PER_FRAME;
        const half = el.scrollWidth / 2;
        if (half > 0 && position >= half) position -= half;
        el.scrollLeft = position;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // The shopper takes over (finger, mouse or wheel): the strip waits, then glides on from where they left it
    const hold = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const release = (delay = 1800) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        position = el.scrollLeft;
        paused = false;
      }, delay);
    };
    const onWheel = () => {
      hold();
      release();
    };

    el.addEventListener('touchstart', hold, { passive: true });
    el.addEventListener('touchend', () => release(), { passive: true });
    el.addEventListener('mouseenter', hold);
    el.addEventListener('mouseleave', () => release(600));
    el.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      if (resumeTimer) clearTimeout(resumeTimer);
      el.removeEventListener('touchstart', hold);
      el.removeEventListener('mouseenter', hold);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <section aria-label="Customer stories" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px]">
      <SectionHeader align="center" eyebrow="Loved by gifters" title="Moments we've been part of" description="A few kind words about gifting with Nyochavar." />

      <ul
        ref={stripRef}
        className="no-scrollbar -mx-4 mt-10 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:gap-6 lg:px-0"
      >
        {LOOPED.map((testimonial, index) => (
          <li key={`${testimonial.name}-${index}`} aria-hidden={index >= TESTIMONIALS.length || undefined} className="w-[17.5rem] shrink-0 sm:w-[19rem] lg:w-[21rem]">
            <figure className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-card-hover sm:p-6">
              <div>
                <div className="flex items-center justify-between">
                  <Quote className="h-6 w-6 text-brand/30" strokeWidth={1.5} />
                  <div className="flex items-center gap-0.5" aria-label={`${testimonial.stars} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < testimonial.stars ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />
                    ))}
                  </div>
                </div>
                <blockquote className="mt-3 font-serif text-[15px] leading-relaxed text-ink sm:text-base">&ldquo;{testimonial.quote}&rdquo;</blockquote>
              </div>

              <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                  {initials(testimonial.name)}
                </span>
                <div className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-bold text-ink">
                    <span className="truncate">{testimonial.name}</span>
                    <BadgeCheck className="h-4 w-4 shrink-0 text-brand" />
                  </span>
                  <span className="block truncate text-xs font-medium text-slate-500">{testimonial.occasion}</span>
                </div>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default TestimonialsSection;
