import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HeroSection } from './HeroSection';
import { HeroFeatureCards } from './HeroFeatureCards';
import { OccasionsSection } from './OccasionsSection';
import { CategoriesSection } from './CategoriesSection';
import { BudgetSection } from './BudgetSection';
import { StudioPromoSection } from './StudioPromoSection';
import { TestimonialsSection } from './TestimonialsSection';
import { ProfileCompletionBanner } from './ProfileCompletionBanner';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { ProductRail } from '../../components/product/ProductRail';
import { useProducts } from '../../hooks/useCatalog';
import { pickDeals, pickMostLoved, pickNewArrivals } from '../../utils/catalog';
import { PaperCelebration } from '../../components/ui/PaperCelebration';
import { clearWelcomeCelebration, peekWelcomeCelebration } from '../../utils/welcomeCelebration';
import { DevelopmentNotice } from '../../components/system/DevelopmentNotice'; // TEMPORARY: remove with its file

const CONTAINER = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1360px]';

export const HomePage: React.FC = () => {
  const { products, isLoading } = useProducts();

  // First visit right after creating an account: play the paper celebration once (2 seconds)
  const [celebrating, setCelebrating] = useState(peekWelcomeCelebration);
  useEffect(() => {
    if (celebrating) clearWelcomeCelebration();
  }, [celebrating]);
  const endCelebration = useCallback(() => setCelebrating(false), []);

  const mostLoved = useMemo(() => pickMostLoved(products), [products]);
  const deals = useMemo(() => pickDeals(products), [products]);
  const newArrivals = useMemo(() => {
    const featured = new Set(mostLoved.slice(0, 4).map((product) => product.id));
    return pickNewArrivals(products).filter((product) => !featured.has(product.id));
  }, [products, mostLoved]);

  return (
    <div className="pb-16 sm:pb-24">
      <DevelopmentNotice /> {/* TEMPORARY: remove with its file */}
      {celebrating && <PaperCelebration onDone={endCelebration} />}
      <h1 className="sr-only">Nyochavar — personalized gifts, flowers and hampers delivered same-day</h1>

      <HeroSection />

      <div className="mt-8 space-y-4 sm:mt-12 sm:space-y-6">
        <HeroFeatureCards />
        <ProfileCompletionBanner />
      </div>

      <div className="mt-14 space-y-16 sm:mt-20 sm:space-y-24">
        <OccasionsSection />

        {deals.length >= 2 && (
          <section aria-label="Offers" className={CONTAINER}>
            <SectionHeader
              eyebrow="Limited-time offers"
              title="Deals worth celebrating"
              action={{ label: 'Shop all offers', to: '/catalog?tags=on-sale' }}
            />
            <div className="mt-8">
              <ProductRail products={deals} />
            </div>
          </section>
        )}

        <section aria-label="Most-loved gifts" className={CONTAINER}>
          <SectionHeader
            eyebrow="Trending now"
            title="Most-loved gifts"
            description="Bestsellers and top-rated favourites, hand-finished with care."
            action={{ label: 'Shop best sellers', to: '/catalog?sort=bestselling' }}
          />
          <div className="mt-8">
            <ProductRail products={mostLoved} isLoading={isLoading} />
          </div>
        </section>

        <CategoriesSection products={products} />
        <BudgetSection products={products} />
        <StudioPromoSection />

        {newArrivals.length >= 3 && (
          <section aria-label="New arrivals" className={CONTAINER}>
            <SectionHeader eyebrow="Just in" title="New arrivals" action={{ label: 'See what’s new', to: '/catalog?tags=new&sort=newest' }} />
            <div className="mt-8">
              <ProductRail products={newArrivals} />
            </div>
          </section>
        )}

        <TestimonialsSection />
      </div>
    </div>
  );
};

export default HomePage;
