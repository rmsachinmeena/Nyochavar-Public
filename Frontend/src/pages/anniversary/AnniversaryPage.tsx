import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import { useProducts } from '../../hooks/useCatalog';
// COMMENTED: Static palette options removed. Fetch from API dynamically.
const PALETTE_OPTIONS = [
  {
    id: 'default',
    name: 'Default',
    tagline: 'Curated celebration',
    colorSwatches: ['#3B82F6'],
    previewImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200'
  }
];
import { ProductCard, ProductCardSkeleton } from '../../components/product/ProductCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SafeImage } from '../../components/ui/SafeImage';
import { StudioPromoSection } from '../home/StudioPromoSection';
import { TestimonialsSection } from '../home/TestimonialsSection';
import { sortProducts } from '../../utils/catalog';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=1400';
const ROMANTIC_OCCASIONS = ['Anniversary', "Valentine's", 'Wedding'];
const GRID = 'mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10';

export const AnniversaryPage: React.FC = () => {
  const { products, isLoading } = useProducts();

  const gifts = useMemo(
    () =>
      sortProducts(
        products.filter((product) => (product.occasions ?? []).some((occasion) => ROMANTIC_OCCASIONS.includes(occasion))),
        'bestselling'
      ),
    [products]
  );
  const hasAnniversaryGifts = products.some((product) => (product.occasions ?? []).includes('Anniversary'));

  return (
    <div className="pb-16 sm:pb-24">
      <section className="mx-auto max-w-7xl px-3 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-brand-soft via-white to-blue-50 px-5 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand shadow-sm">
                <Heart className="h-3.5 w-3.5 fill-current" /> The Anniversary Collection
              </p>
              <h1 className="mt-5 font-serif text-[40px] leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl lg:text-6xl">
                Celebrate your <em className="text-brand">love story</em>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                Every milestone deserves an unforgettable gesture — from champagne hampers to engraved keepsakes, each
                finished with a handwritten note.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#anniversary-gifts"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Shop anniversary gifts <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/builder"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-ink transition hover:border-ink"
                >
                  Build a couple hamper
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm pb-6 sm:max-w-md lg:max-w-none">
              <div className="aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-slate-100 shadow-float lg:ml-auto lg:w-[85%]">
                <SafeImage src={HERO_IMAGE} alt="Softly glowing hearts" loading="eager" className="h-full w-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -left-1 w-40 -rotate-[4deg] rounded-2xl bg-white p-2 shadow-float sm:w-48 lg:left-0">
                <div className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                  <SafeImage src={PALETTE_OPTIONS[2]?.previewImage} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="px-1 pb-1 pt-2 font-script text-lg leading-tight text-brand">Happy anniversary, my love</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="anniversary-gifts" className="mx-auto mt-16 max-w-7xl scroll-mt-28 px-5 sm:mt-24 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Gifts for two"
          title="Anniversary & romantic gifts"
          description="Thoughtful gifts for every milestone, from the first year to the fiftieth."
          action={{ label: 'View all', to: hasAnniversaryGifts ? '/catalog?occasion=Anniversary' : '/catalog' }}
        />

        {isLoading ? (
          <ul className={GRID}>
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index}>
                <ProductCardSkeleton />
              </li>
            ))}
          </ul>
        ) : gifts.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
            <p className="font-serif text-2xl text-ink">New romantic gifts are on their way</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              In the meantime, design a one-of-a-kind hamper for your favourite person.
            </p>
            <Link
              to="/builder"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-soft"
            >
              Build a hamper <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className={GRID}>
            {gifts.slice(0, 8).map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16 space-y-16 sm:mt-24 sm:space-y-24">
        <StudioPromoSection />
        <TestimonialsSection />
      </div>
    </div>
  );
};

export default AnniversaryPage;
