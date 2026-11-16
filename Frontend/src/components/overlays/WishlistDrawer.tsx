import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, X } from 'lucide-react';
import type { Product } from '../../types';
import { useCart, useFavorites, useUI } from '../../context';
import { useProducts } from '../../hooks/useCatalog';
import { isSoldOut } from '../../utils/catalog';
import { formatPrice } from '../../utils/format';
import { Sheet } from '../ui/Sheet';
import { SafeImage } from '../ui/SafeImage';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { favorites, handleToggleFavorite } = useFavorites();
  const { handleAddToCart } = useCart();
  const { showToast, setIsCartDrawerOpen } = useUI();
  const { products } = useProducts();

  const saved = useMemo(
    () =>
      favorites
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [favorites, products]
  );

  const addToCart = (product: Product) => {
    handleAddToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
    showToast({
      title: 'Added to cart',
      description: product.name,
      image: product.image,
      action: {
        label: 'View cart',
        onClick: () => {
          onClose();
          setIsCartDrawerOpen(true);
        },
      },
    });
  };

  const title = (
    <span className="flex items-baseline gap-2">
      Wishlist
      {saved.length > 0 && <span className="font-body text-sm font-medium text-slate-400">{saved.length} saved</span>}
    </span>
  );

  return (
    <Sheet open={isOpen} onClose={onClose} side="right" title={title}>
      {saved.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
            <Heart className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <h3 className="mt-5 font-serif text-2xl text-ink">No saved gifts yet</h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
            Tap the heart on any gift to keep it here for later.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/catalog');
            }}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-soft"
          >
            Discover gifts <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-5">
          {saved.map((product) => {
            const productPath = `/product/${product.id}`;
            return (
              <li key={product.id} className="flex gap-4 py-5">
                <Link
                  to={productPath}
                  onClick={onClose}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100"
                >
                  <SafeImage src={product.image} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-serif text-[15px] leading-snug text-ink">
                      <Link to={productPath} onClick={onClose} className="transition-colors hover:text-brand">
                        {product.name}
                      </Link>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(product.id)}
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="-mr-2 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">{formatPrice(product.price)}</p>
                  <div className="mt-auto pt-3">
                    {isSoldOut(product) ? (
                      <span className="text-xs font-medium text-slate-500">Currently sold out</span>
                    ) : product.is_customizable ? (
                      <Link
                        to={productPath}
                        onClick={onClose}
                        className="inline-flex h-9 items-center rounded-full border border-slate-200 px-4 text-xs font-semibold text-ink transition hover:border-ink"
                      >
                        Personalize
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-xs font-semibold text-white transition hover:bg-ink-soft"
                      >
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
};
