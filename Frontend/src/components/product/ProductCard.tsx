import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Minus, Plus, ShieldCheck, ShoppingCart, Trash2, Truck, Zap } from 'lucide-react';
import type { Product } from '../../types';
import { useCart, useFavorites, useUI } from '../../context';
import { formatPrice } from '../../utils/format';
import { getDiscountPercent, isLowStock, isSoldOut } from '../../utils/catalog';
import { getCardBadges } from '../../utils/badges';
import { SafeImage } from '../ui/SafeImage';
import '../../styles/animations.css';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className = '' }) => {
  const navigate = useNavigate();
  const { favorites, handleToggleFavorite } = useFavorites();
  const { cart, handleAddToCart, handleUpdateQuantity, handleRemoveCartItem } = useCart();
  const { showToast, setIsCartDrawerOpen } = useUI();
  const [heartBounce, setHeartBounce] = useState(false);

  const cartItemsForProduct = cart.filter((item) => item.productId === product.id);
  const qtyInCart = cartItemsForProduct.reduce((sum, item) => sum + item.quantity, 0);
  const primaryCartItem = cartItemsForProduct[0];

  const href = `/product/${product.id}`;
  const isFavorite = favorites.includes(product.id);
  const soldOut = isSoldOut(product);
  const lowStock = isLowStock(product);
  const discount = getDiscountPercent(product);
  const hoverImage = product.gallery?.find((image) => image && image !== product.image);

  // Pricing calculations
  const mrpVal = product.mrp && product.mrp > product.price ? product.mrp : Math.round(product.price * 1.25);
  const discountPercent = discount > 0 ? discount : Math.round(((mrpVal - product.price) / mrpVal) * 100);

  // Card Badges: max 2 badges based on priority (new > bestseller > trending > top_rated > eco > budget)
  const cardBadges = soldOut
    ? [{ key: 'sold_out', label: 'Sold out', emoji: '', color: 'bg-slate-700 text-white' }]
    : getCardBadges(product);

  // Delivery & Packaging perk labels (Support custom rename by Superadmin)
  const deliveryPerk = product.delivery_label?.trim() || (product.express_delivery_available ? '⚡ 1-Hr Express' : '🚚 Same-day');
  const packagingPerk = product.packaging_label?.trim() || (product.has_gift_wrap ? '🎁 Gift Wrap' : '✍️ Free Note');

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (qtyInCart >= 5) {
      showToast({
        title: 'Limit reached',
        description: 'You can add up to 5 units of this item to your basket.',
      });
      return;
    }
    const success = handleAddToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
    if (success) {
      showToast({
        title: 'Added to cart',
        description: `${product.name} (${qtyInCart + 1} in basket)`,
        image: product.image,
        action: { label: 'View cart', onClick: () => setIsCartDrawerOpen(true) },
      });
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (qtyInCart >= 5) {
      showToast({
        title: 'Limit reached',
        description: 'You already have 5 units in your basket.',
      });
      navigate('/checkout');
      return;
    }
    handleAddToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
    });
    navigate('/checkout');
  };

  const handleQuickIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (qtyInCart >= 5) {
      showToast({
        title: 'Limit reached',
        description: 'Maximum 5 units of this item allowed in basket.',
      });
      return;
    }
    if (primaryCartItem) {
      handleUpdateQuantity(primaryCartItem.id, 1);
    } else {
      handleAddToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      });
    }
  };

  const handleQuickDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (primaryCartItem) {
      if (primaryCartItem.quantity <= 1 && cartItemsForProduct.length === 1) {
        handleRemoveCartItem(primaryCartItem.id);
      } else {
        handleUpdateQuantity(primaryCartItem.id, -1);
      }
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleToggleFavorite(product.id);
    if (!isFavorite) {
      showToast({ title: 'Saved to wishlist', description: product.name, image: product.image });
      setHeartBounce(true);
      setTimeout(() => setHeartBounce(false), 600);
    }
  };

  return (
    <Link
      to={href}
      className="group relative block w-full no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-2xl"
    >
      <article
        className={`group relative flex h-full flex-col rounded-2xl bg-white p-2.5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-brand/40 transition-all duration-300 ${className}`}
      >
        {/* Product Image Area - Compact aspect-square with uniform contained image sizing */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-2">
          <SafeImage
            src={product.image}
            alt={product.name}
            className={`h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105 ${
              soldOut ? 'grayscale-[50%]' : ''
            }`}
          />
          {hoverImage && (
            <div className="absolute inset-0 hidden p-2 opacity-0 transition-opacity duration-500 group-hover:opacity-100 lg:flex items-center justify-center">
              <SafeImage src={hoverImage} alt="" className="h-full w-full object-contain" />
            </div>
          )}

          {/* Top-Left Status Badges (Max 2 priority badges) */}
          {cardBadges.length > 0 && (
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
              {cardBadges.map((b) => (
                <span
                  key={b.key}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs ${b.color}`}
                >
                  {b.emoji ? <span>{b.emoji}</span> : null}
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Top-Right Wishlist Button */}
          <button
            type="button"
            onClick={handleFavorite}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className={`absolute right-2 top-2 z-20 grid h-7.5 w-7.5 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:scale-110 hover:bg-white active:scale-95 ${
              heartBounce ? 'animate-bounce-heart' : ''
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                isFavorite ? 'fill-brand text-brand' : 'text-slate-600 hover:text-brand'
              }`}
              strokeWidth={1.75}
            />
          </button>

          {/* Bottom-Left Image Overlay Badge: Star Rating if present */}
          {product.rating > 0 && (
            <div className="pointer-events-none absolute bottom-2 left-2 z-10">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs shadow-xs">
                ⭐ {product.rating.toFixed(1)}
              </span>
            </div>
          )}

        </div>

        {/* Product Details Area (Lower Side of Card) */}
        <div className="flex flex-1 flex-col justify-between pt-2">
          <div>
            {/* 1. Title - Bold & Crisp */}
            <h3 className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug line-clamp-1 transition-colors group-hover:text-brand">
              {product.name}
            </h3>

            {/* 2. Tagline (Fills the previous empty gap) */}
            <p className="mt-0.5 text-[11px] text-slate-500 font-normal line-clamp-1 leading-tight">
              {product.tagline || (product.is_customizable ? 'Personalisation available · Handcrafted' : 'Hand-curated with care & love')}
            </p>

            {/* 3. Rating & Social Proof Line */}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-0.5 font-bold text-slate-800">
                <span className="text-amber-500 text-xs">★</span>
                <span>{(product.rating || 4.8).toFixed(1)}</span>
              </div>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-[10.5px]">
                {product.reviewCount ? `${product.reviewCount} reviews` : '12 reviews'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700">
                In Stock
              </span>
            </div>

            {/* 4. Normal Clean Price Row (Out of the inner card box) */}
            <div className="mt-2.5 flex items-baseline justify-between gap-1.5">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {formatPrice(product.price)}
                </span>
                {mrpVal > product.price && (
                  <span className="relative inline-block text-xs font-semibold text-slate-400">
                    {formatPrice(mrpVal)}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-[-1.5px] top-1/2 h-[1px] -translate-y-1/2 -rotate-12 bg-rose-400/90"
                    />
                  </span>
                )}
              </div>
              {discountPercent > 0 && (
                <span className="shrink-0 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 leading-none">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* 5. Normal Clean Delivery & Packaging Perks Row (Directly on card) */}
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1 font-semibold text-brand truncate">
                {deliveryPerk}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500 shrink-0">
                {packagingPerk}
                {product.is_eco_friendly && <span className="hidden sm:inline">· 🌱 Eco</span>}
              </span>
            </div>
          </div>

          {/* Action Buttons: Left: "⚡ Buy Now" (Theme Blue) + Right: "🛒 Add to Cart" (Theme Soft Blue) */}
          <div className="mt-2.5 flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
            {/* Left Button: Buy Now (Theme Brand Blue) */}
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={soldOut}
              aria-label={`Buy ${product.name} now`}
              className="flex-1 h-8.5 rounded-lg bg-brand hover:bg-brand-dark active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-3.5 w-3.5 fill-white" />
              <span>Buy Now</span>
            </button>

            {/* Right Button: Add to Cart / Cart Stepper */}
            {!soldOut && qtyInCart > 0 ? (
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="flex-1 h-8.5 rounded-lg bg-brand-soft border border-brand/30 px-1.5 flex items-center justify-between text-brand text-xs font-bold shadow-xs"
              >
                <button
                  type="button"
                  onClick={handleQuickDecrease}
                  aria-label="Decrease quantity"
                  className="h-6 w-6 rounded bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                >
                  {qtyInCart === 1 ? <Trash2 className="h-3 w-3 text-slate-500" /> : <Minus className="h-3 w-3 stroke-[2.5]" />}
                </button>
                <span className="text-xs font-bold text-ink tabular-nums px-0.5">
                  {qtyInCart} in cart
                </span>
                <button
                  type="button"
                  onClick={handleQuickIncrease}
                  disabled={qtyInCart >= 5}
                  aria-label="Increase quantity"
                  className="h-6 w-6 rounded bg-brand text-white shadow-xs flex items-center justify-center hover:bg-brand-dark active:scale-95 transition disabled:opacity-50"
                >
                  <Plus className="h-3 w-3 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={soldOut}
                aria-label={`Add ${product.name} to cart`}
                className="flex-1 h-8.5 rounded-lg bg-white hover:bg-blue-50/70 active:scale-95 text-brand border border-brand/25 font-semibold text-xs flex items-center justify-center gap-1 transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Add to Cart</span>
              </button>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

export const ProductCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-2xl border border-slate-100 bg-white p-2.5 ${className}`}>
    <div className="aspect-square w-full rounded-xl bg-slate-100" />
    <div className="mt-2 h-2.5 w-1/4 rounded-full bg-slate-100" />
    <div className="mt-1 h-3.5 w-3/4 rounded-full bg-slate-100" />
    <div className="mt-1 h-2.5 w-1/2 rounded-full bg-slate-100" />
    <div className="mt-2 h-12 w-full rounded-xl bg-slate-100" />
    <div className="mt-2.5 flex gap-1.5">
      <div className="h-8.5 flex-1 rounded-lg bg-slate-100" />
      <div className="h-8.5 flex-1 rounded-lg bg-slate-100" />
    </div>
  </div>
);

export default ProductCard;
