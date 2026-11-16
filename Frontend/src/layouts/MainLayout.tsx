import React, { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Navbar } from '../components/layout/Navbar';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Footer } from '../components/layout/Footer';
import { BottomNav, shouldShowBottomNav } from '../components/layout/BottomNav';
import { CartDrawer } from '../components/overlays/CartDrawer';
import { WishlistDrawer } from '../components/overlays/WishlistDrawer';
import { SearchModal } from '../components/overlays/SearchModal';
import { useAuth, useCart, useFavorites, useUI } from '../context';
import { useProducts } from '../hooks/useCatalog';

export const MainLayout: React.FC = () => {
  const { pathname } = useLocation();
  const { cartTotalCount } = useCart();
  const { favorites } = useFavorites();
  const { loggedInUser, handleLogout } = useAuth();
  const { products } = useProducts();
  const {
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    isFavoritesModalOpen,
    setIsFavoritesModalOpen,
  } = useUI();

  useEffect(() => {
    window.scrollTo(0, 0);
    setIsCartDrawerOpen(false);
    setIsSearchModalOpen(false);
    setIsFavoritesModalOpen(false);
  }, [pathname, setIsCartDrawerOpen, setIsSearchModalOpen, setIsFavoritesModalOpen]);

  const wishlistCount = useMemo(
    () => favorites.filter((id) => products.some((product) => product.id === id)).length,
    [favorites, products]
  );

  const showBottomNav = shouldShowBottomNav(pathname);
  const isCheckout = pathname.startsWith('/checkout');

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`storefront flex min-h-screen flex-col bg-white font-body text-ink antialiased ${
          showBottomNav ? 'pb-[calc(6.2rem+env(safe-area-inset-bottom))] md:pb-0' : ''
        }`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        {/* Checkout: no site navigation, just the logo at the top left */}
        {isCheckout ? (
          <header className="border-b border-slate-200/70 bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-6 lg:px-8">
              <Link to="/" aria-label="Nyochavar home">
                <BrandLogo />
              </Link>
            </div>
          </header>
        ) : (
        <Navbar
          cartCount={cartTotalCount}
          wishlistCount={wishlistCount}
          onOpenCart={() => setIsCartDrawerOpen(true)}
          onOpenWishlist={() => setIsFavoritesModalOpen(true)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          loggedInUser={loggedInUser}
          onLogout={handleLogout}
        />
        )}

        <main id="main-content" className="flex-1">
          <Outlet />
        </main>

        {!pathname.startsWith('/product/') && <Footer />}

        {showBottomNav && <BottomNav wishlistCount={wishlistCount} />}

        <CartDrawer isOpen={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)} />
        <WishlistDrawer isOpen={isFavoritesModalOpen} onClose={() => setIsFavoritesModalOpen(false)} />
        <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
      </div>
    </MotionConfig>
  );
};

export default MainLayout;
