import { useSeo } from '../../hooks/useSeo';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ChevronLeft, ChevronRight, Heart, HeartHandshake, PenLine, Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from 'lucide-react';
import type { Product, ProductVariant } from '../../types';
import { DEFAULT_TRUST_BADGES, DEFAULT_UI_LABELS } from '../../types/product';
import { productService } from '../../services/productService';
import { useCart, useFavorites, useUI } from '../../context';
import { useProducts } from '../../hooks/useCatalog';
import { useInView } from '../../hooks/useInView';
import { occasionHref } from '../../utils/occasionUtils';
import { formatCount, formatPrice } from '../../utils/format';
import { getDiscountPercent, isLowStock, isSoldOut, pickMostLoved, pickRelated } from '../../utils/catalog';
import { getProductBadges } from '../../utils/badges';
import { TrustBadgeIcon } from '../../utils/trustBadgeIcons';
import { SafeImage } from '../../components/ui/SafeImage';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { ProductRail } from '../../components/product/ProductRail';
import { ProductShareModal } from '../../components/product/ProductShareModal';
import { ProductInformation } from '../../components/product/ProductInformation';
import { eventTracker } from '../../services/eventTracker';

const MESSAGE_LIMIT = 160;
const NOTE_LINES = 'repeating-linear-gradient(transparent, transparent 31px, rgba(30, 64, 175, 0.08) 32px)';

const ASSURANCES = [
  {
    icon: ShieldCheck,
    title: 'Safe & Secure Delivery',
    shortTitle: 'Safe & Secure',
    text: 'Damage-proof packaging & tracked dispatch',
  },
  {
    icon: PenLine,
    title: 'Free Handwritten Note',
    shortTitle: 'Handwritten Note',
    text: 'Penned on archival card & wax-sealed',
  },
  {
    icon: HeartHandshake,
    title: '100% Delight Guarantee',
    shortTitle: '100% Delight',
    text: 'Photo proof sent to you upon delivery',
  },
];

const GOOD_TO_KNOW = [
  'Hand-finished by our gifting team within 2 hours of dispatch',
  'Includes archival cardstock, a custom wax seal and ribbon binding',
  'Packed in a climate-protected box so it arrives fresh',
  'Photo proof sent to your WhatsApp or SMS on delivery',
];

const ROUND_ACTION =
  'grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:scale-105 active:scale-95';

const StarRating: React.FC<{ value: number }> = ({ value }) => (
  <span className="flex items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${index < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
      />
    ))}
  </span>
);

const ProductDetailSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="Loading gift" className="mx-auto max-w-7xl animate-pulse px-5 pb-24 pt-4 sm:px-6 lg:px-8">
    <div className="h-3 w-48 rounded-full bg-slate-100" />
    <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="-mx-5 aspect-square bg-slate-100 sm:mx-0 sm:rounded-3xl lg:col-span-7" />
      <div className="space-y-4 lg:col-span-5">
        <div className="h-3 w-24 rounded-full bg-slate-100" />
        <div className="h-9 w-4/5 rounded-full bg-slate-100" />
        <div className="h-4 w-3/5 rounded-full bg-slate-100" />
        <div className="h-8 w-32 rounded-full bg-slate-100" />
        <div className="h-28 w-full rounded-2xl bg-slate-100" />
        <div className="h-14 w-full rounded-full bg-slate-100" />
      </div>
    </div>
  </div>
);

const ProductUnavailable: React.FC<{ suggestions: Product[] }> = ({ suggestions }) => (
  <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-6 sm:pt-16 lg:px-8">
    <div className="mx-auto max-w-lg text-center">
      <h1 className="font-serif text-3xl text-ink sm:text-4xl">This gift isn’t available</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
        It may have sold out or left our collection. Here are a few favourites you might love instead.
      </p>
      <Link
        to="/catalog"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Browse all gifts <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
    {suggestions.length > 0 && (
      <div className="mt-16">
        <ProductRail products={suggestions} />
      </div>
    )}
  </div>
);

const ProductReviews: React.FC<{ productId?: string; reviews?: any[]; loading?: boolean }> = ({ productId, reviews: initialReviews, loading: initialLoading }) => {
  const [reviews, setReviews] = useState<any[]>(initialReviews || []);
  const [loading, setLoading] = useState(initialLoading !== undefined ? initialLoading : !initialReviews);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialReviews !== undefined) {
      setReviews(initialReviews);
      setLoading(false);
      return;
    }
    if (!productId) return;
    let active = true;
    import('../../services/api').then(({ api }) => {
      api.getProductReviews(productId)
        .then(data => {
          if (active) {
            setReviews(data || []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    });
    return () => { active = false; };
  }, [productId, initialReviews]);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: clientWidth >= 640 ? 344 : clientWidth * 0.8, behavior: 'smooth' });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [reviews]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -344, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 344, behavior: 'smooth' });
    }
  };

  if (loading) return null;
  if (reviews.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-20 border-t border-slate-100 pt-16 relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-2xl text-ink sm:text-3xl">Customer reviews</h2>
        {reviews.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={scrollLeft}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              aria-label="Previous reviews"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              aria-label="Next reviews"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-6 pt-1 px-4 sm:px-6 -mx-4 sm:-mx-6 snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-6 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {reviews.map(review => {
          // Extract first name only - do not show email
          let firstName = 'Customer';
          if (review.users?.name) {
            firstName = review.users.name.trim().split(' ')[0];
          } else if (review.user_name || review.name) {
            firstName = String(review.user_name || review.name).trim().split(' ')[0];
          } else if (typeof review.buyer_id === 'string' && review.buyer_id.trim()) {
            const raw = review.buyer_id.includes('@') ? review.buyer_id.split('@')[0] : review.buyer_id;
            const cleaned = raw.replace(/[._\-]/g, ' ').replace(/\d+$/, '').trim();
            const token = (cleaned || raw).split(' ')[0];
            if (token) {
              firstName = token.charAt(0).toUpperCase() + token.slice(1);
            }
          }

          return (
            <div
              key={review.id}
              className="shrink-0 w-[260px] sm:w-[280px] rounded-xl border border-slate-200 bg-white p-4.5 snap-start flex flex-col shadow-sm"
            >
              {/* Header: User details with date below name */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-slate-900 truncate">
                    {firstName}
                  </span>
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-medium text-emerald-600">
                    Verified Buyer
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              {/* Stars */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <StarRating value={review.rating} />
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-[13px] leading-relaxed text-slate-600 italic">
                  "{review.comment}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const ProductDetailView: React.FC<{ product: Product; products: Product[] }> = ({ product, products }) => {
  const navigate = useNavigate();
  const { cart, handleAddToCart } = useCart();
  const { favorites, handleToggleFavorite } = useFavorites();
  const { showToast, setIsCartDrawerOpen } = useUI();
  const galleryRef = useRef<HTMLDivElement>(null);
  const [ctaRef, ctaInView] = useInView<HTMLDivElement>(true);
  const [endRef, endInView] = useInView<HTMLDivElement>(false);


  const [activeImage, setActiveImage] = useState(0);
  const [selectedHue, setSelectedHue] = useState(product.hues?.[0] ?? '');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    import('../../services/api').then(({ api }) => {
      api.getProductReviews(product.id)
        .then(data => {
          if (active) {
            setReviews(data || []);
            setReviewsLoading(false);
          }
        })
        .catch(() => {
          if (active) setReviewsLoading(false);
        });
    });
    return () => { active = false; };
  }, [product.id]);

  const effectiveReviewCount = useMemo(() => {
    if (reviews && reviews.length > 0) return reviews.length;
    return Number(product.reviewCount ?? product.review_count ?? 0);
  }, [reviews, product.reviewCount, product.review_count]);

  const effectiveRating = useMemo(() => {
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      return Math.round((sum / reviews.length) * 10) / 10;
    }
    const base = Number(product.rating ?? 5.0);
    return isNaN(base) || base <= 0 ? 5.0 : base;
  }, [reviews, product.rating]);

  const descriptionText = useMemo(() => {
    const desc = product.description?.trim();
    const tag = product.tagline?.trim();
    if (desc && !desc.endsWith('...')) return desc;
    if (tag && !tag.endsWith('...')) return tag;
    return desc || tag || '';
  }, [product.description, product.tagline]);

  // Compute active gallery images.
  // When a variant with its own images is selected, ONLY show that variant's images.
  // Never bleed base product photos or title photo into a variant that has its own photo set!
  const images = useMemo(() => {
    if (selectedVariant) {
      const vImages = selectedVariant.images && selectedVariant.images.length > 0
        ? selectedVariant.images
        : (selectedVariant.image ? [selectedVariant.image] : []);
      const validVariantImages = vImages.filter(Boolean);
      if (validVariantImages.length > 0) {
        return [...new Set(validVariantImages)];
      }
    }
    const baseImages = [product.image, ...(product.gallery ?? [])].filter(Boolean);
    return [...new Set(baseImages)];
  }, [product.image, product.gallery, selectedVariant]);

  // When variant changes, reset gallery to first photo cleanly
  useEffect(() => {
    setActiveImage(0);
    const gallery = galleryRef.current;
    if (gallery) {
      gallery.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [selectedVariant]);

  useEffect(() => {
    if (product && product.id) {
      eventTracker.trackProductView({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
      });
    }
  }, [product.id]);

  useEffect(() => {
    // Preload variant images so they appear instantly when clicked
    if (product?.variants) {
      product.variants.forEach(variant => {
        const variantImagesToPreload = variant.images && variant.images.length > 0 
          ? variant.images 
          : (variant.image ? [variant.image] : []);
        variantImagesToPreload.forEach(src => {
          const img = new Image();
          img.src = src;
        });
      });
    }
  }, [product.variants]);

  const activeVariantImage = selectedVariant?.image || selectedVariant?.images?.[0];
  const isFavorite = favorites.includes(product.id);
  const soldOut = isSoldOut(product);

  // Its own browser title, share preview and search-engine data for this product
  useSeo({
    title: selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name,
    description: (product.description || product.tagline || `Order ${product.name} from Nyochavar`).replace(/\s+/g, ' ').trim().slice(0, 155),
    image: activeVariantImage || product.image || product.gallery?.[0],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.id,
      description: product.description || undefined,
      image: [product.image, ...(product.gallery || [])].filter(Boolean),
      brand: { '@type': 'Brand', name: 'Nyochavar' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: product.price,
        availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: typeof window !== 'undefined' ? `${window.location.origin}/product/${product.id}` : undefined,
      },
      ...(product.reviewCount && product.reviewCount > 0 && product.rating > 0
        ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount } }
        : {}),
    },
  });
  const lowStock = isLowStock(product);
  const activePrice = selectedVariant ? selectedVariant.price : product.price;
  const activeMrp = selectedVariant ? selectedVariant.mrp : product.mrp;
  
  const discount = activeMrp && activeMrp > activePrice
    ? Math.round(((activeMrp - activePrice) / activeMrp) * 100)
    : 0;

  const chosenAddons = (product.addons ?? []).filter((addon) => selectedAddons.includes(addon.id));
  const addonsTotal = chosenAddons.reduce((sum, addon) => sum + addon.price, 0);
  const unitPrice = activePrice + addonsTotal;
  const total = unitPrice * quantity;

  const currentInCart = cart.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const remainingAllowed = Math.max(0, 5 - currentInCart);
  const maxQuantity = Math.max(1, Math.min(5, remainingAllowed || 1, product.stock ?? 5));
  const related = useMemo(() => pickRelated(product, products, 8), [product, products]);
  const showStickyBar = !ctaInView && !endInView;

  const trending = Boolean(product.is_trending) && !soldOut;
  const topRated = Boolean(product.is_top_rated_this_week) && !soldOut;
  const badge =
    soldOut
      ? { label: 'Sold out', className: 'bg-white text-slate-700' }
      : trending
        ? { label: '🔥 Trending', className: 'bg-orange-500 text-white animate-pulse-glow' }
        : topRated
          ? { label: '⭐ Top Rated', className: 'bg-amber-500 text-white' }
          : product.isBestSeller
            ? { label: 'Bestseller', className: 'bg-ink text-white' }
            : null;

  const toggleAddon = (addonId: string) =>
    setSelectedAddons((prev) => (prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]));

  const buildCartItem = () => ({
    productId: product.id,
    name: product.name,
    price: unitPrice,
    image: activeVariantImage || product.image,
    quantity,
    selectedHue: selectedHue || undefined,
    message: message.trim() || undefined,
    addons: chosenAddons.length > 0 ? chosenAddons : undefined,
    variant: selectedVariant ? { id: selectedVariant.id, name: selectedVariant.name } : undefined,
  });

  const addToCart = () => {
    if (currentInCart >= 5) {
      showToast({
        title: 'Limit reached',
        description: 'You already have 5 units of this item in your basket (maximum allowed).',
      });
      return;
    }
    const success = handleAddToCart(buildCartItem());
    if (success) {
      showToast({
        title: 'Added to cart',
        description: quantity > 1 ? `${quantity} × ${product.name}` : product.name,
        image: activeVariantImage || product.image,
        action: { label: 'View cart', onClick: () => setIsCartDrawerOpen(true) },
      });
    } else {
      showToast({
        title: 'Limit reached',
        description: 'Maximum 5 units of this item allowed in basket.',
      });
    }
  };

  const buyNow = () => {
    if (currentInCart >= 5) {
      showToast({
        title: 'Limit reached',
        description: 'You already have 5 units of this item in your basket.',
      });
      navigate('/checkout');
      return;
    }
    handleAddToCart(buildCartItem());
    navigate('/checkout');
  };

  const toggleFavorite = () => {
    handleToggleFavorite(product.id);
    if (!isFavorite) showToast({ title: 'Saved to wishlist', description: product.name, image: product.image });
  };

  const share = () => {
    setIsShareModalOpen(true);
  };

  const syncActiveImage = () => {
    const gallery = galleryRef.current;
    if (gallery && gallery.clientWidth > 0) setActiveImage(Math.round(gallery.scrollLeft / gallery.clientWidth));
  };

  const showImage = (index: number) => {
    setActiveImage(index);
    const gallery = galleryRef.current;
    if (gallery) gallery.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' });
  };

  const showPrevImage = () => showImage((activeImage - 1 + images.length) % images.length);
  const showNextImage = () => showImage((activeImage + 1) % images.length);

  const stockTone = soldOut ? 'text-rose-600' : lowStock ? 'text-amber-700' : 'text-emerald-700';
  const stockDot = soldOut ? 'bg-rose-500' : lowStock ? 'bg-amber-500' : 'bg-emerald-500';
  const stockCard = soldOut
    ? 'border-rose-100 bg-rose-50/60'
    : lowStock
      ? 'border-amber-100 bg-amber-50/60'
      : 'border-emerald-100 bg-emerald-50/60';
  const customDeliveryOptions = (product.delivery_options ?? []).filter((opt) => opt.enabled && opt.name);
  const isFastLabel = (label: string) => /fast|express|rush/i.test(label);
  // Delivery options and admin-added services share one equal-size card grid.
  const infoChips: { key: string; icon: React.ReactNode; label: string; tag?: string }[] = [
    ...(customDeliveryOptions.length > 0
      ? customDeliveryOptions.map((opt) => ({
          key: `delivery-${opt.id}`,
          icon: isFastLabel(opt.name) ? (
            <TrustBadgeIcon icon="fast" className="h-4 w-4 text-amber-500" />
          ) : (
            <Truck className="h-4 w-4 text-blue-600" />
          ),
          label: opt.name,
          tag: opt.price,
        }))
      : [
          ...(product.express_delivery_available
            ? [{ key: 'express', icon: <TrustBadgeIcon icon="fast" className="h-4 w-4 text-amber-500" />, label: 'Express Rush Delivery' }]
            : []),
          ...(product.is_free_delivery
            ? [{ key: 'free-delivery', icon: <Truck className="h-4 w-4 text-emerald-600" />, label: 'Free Delivery' }]
            : []),
        ]),
    ...(product.services ?? [])
      .filter((service) => service.enabled && service.name)
      .map((service) => ({
        key: `service-${service.id}`,
        icon: <TrustBadgeIcon icon={service.icon} className="h-4 w-4 text-blue-600" />,
        label: service.name,
        tag: service.price,
      })),
  ];
  const uiLabels = product.ui_labels;
  const stockText = soldOut
    ? uiLabels?.sold_out?.trim() || DEFAULT_UI_LABELS.sold_out
    : lowStock
      ? (uiLabels?.low_stock?.trim() || DEFAULT_UI_LABELS.low_stock).replace(/\{stock\}/g, String(product.stock))
      : uiLabels?.in_stock?.trim() || DEFAULT_UI_LABELS.in_stock;

  return (
    <div className="pb-28 lg:pb-24">
      <div className="mx-auto max-w-7xl px-5 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <Link to="/" className="shrink-0 transition-colors hover:text-ink">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          <Link
            to={`/catalog?category=${encodeURIComponent(product.category)}`}
            className="shrink-0 transition-colors hover:text-ink"
          >
            {product.category}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          <span aria-current="page" className="truncate text-ink">
            {product.name}
          </span>
        </nav>

        <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-5 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          <div className="lg:col-span-6 xl:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div className="group/gallery relative -mx-5 sm:mx-0 overflow-hidden sm:rounded-3xl bg-slate-50 border border-slate-100/80">
                <div
                  ref={galleryRef}
                  onScroll={syncActiveImage}
                  className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
                >
                  {images.map((src, index) => (
                    <div
                      key={src}
                      className="relative aspect-square sm:aspect-[4/3] w-full shrink-0 snap-center flex items-center justify-center p-3 sm:p-6"
                    >
                      <SafeImage
                        src={src}
                        alt={index === 0 ? product.name : `${product.name}, view ${index + 1}`}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        className={`h-full w-full max-h-full max-w-full object-contain mx-auto transition-transform duration-300 ${soldOut ? 'grayscale-[40%]' : ''}`}
                      />
                    </div>
                  ))}
                </div>

                {badge && (
                  <span
                    className={`pointer-events-none absolute left-4 top-4 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-sm ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}

                <div className="absolute right-4 top-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? 'Remove from wishlist' : 'Save to wishlist'}
                    className={ROUND_ACTION}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? 'fill-brand text-brand' : ''}`} strokeWidth={1.75} />
                  </button>
                  <button type="button" onClick={share} aria-label="Share this gift" className={ROUND_ACTION}>
                    <Share2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Bottom-Left Image Overlay Badge: Star Rating */}
                {effectiveRating > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    aria-label={`Rated ${effectiveRating.toFixed(1)} stars from ${effectiveReviewCount} reviews. View reviews.`}
                    className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md backdrop-blur-md border border-slate-200/80 transition-all hover:scale-105 hover:bg-white active:scale-95 cursor-pointer"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>{effectiveRating.toFixed(1)}</span>
                    {effectiveReviewCount > 0 && (
                      <span className="text-[11px] font-medium text-slate-500">
                        ({formatCount(effectiveReviewCount)})
                      </span>
                    )}
                  </button>
                )}

                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-ink/25 px-2 py-1.5 backdrop-blur sm:hidden">
                    {images.map((src, index) => (
                      <span
                        key={src}
                        className={`block h-1.5 rounded-full transition-all ${index === activeImage ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                      />
                    ))}
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPrevImage}
                      aria-label="Previous photo"
                      className="absolute left-2.5 top-1/2 z-20 grid -translate-y-1/2 h-7.5 w-7.5 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm border border-slate-200/80 backdrop-blur transition hover:scale-105 hover:bg-white active:scale-95 sm:h-9 sm:w-9"
                    >
                      <ChevronLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={showNextImage}
                      aria-label="Next photo"
                      className="absolute right-2.5 top-1/2 z-20 grid -translate-y-1/2 h-7.5 w-7.5 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm border border-slate-200/80 backdrop-blur transition hover:scale-105 hover:bg-white active:scale-95 sm:h-9 sm:w-9"
                    >
                      <ChevronRight className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={2.2} />
                    </button>
                    <span className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur sm:block">
                      {activeImage + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-3 hidden gap-3 sm:flex">
                  {images.map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => showImage(index)}
                      aria-label={`Show image ${index + 1}`}
                      aria-current={index === activeImage}
                      className={`h-20 w-20 overflow-hidden rounded-2xl bg-slate-50 p-1 flex items-center justify-center border ring-2 ring-offset-2 transition ${
                        index === activeImage ? 'border-brand ring-brand' : 'border-slate-200 ring-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <SafeImage src={src} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {product.variants && product.variants.length > 0 && (
                <div className="mt-4 px-0.5">
                  <h3 className="text-sm font-semibold text-ink mb-3">{product.variants[0]?.label?.trim() || 'Select Variant'}</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {/* The base/original product option */}
                    <button
                      type="button"
                      onClick={() => setSelectedVariant(null)}
                      aria-pressed={selectedVariant === null}
                      className={`flex w-[76px] flex-col items-center gap-1.5 rounded-xl border p-1.5 text-center transition-all ${
                        selectedVariant === null
                          ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="block h-14 w-14 overflow-hidden rounded-lg bg-slate-50">
                        <SafeImage src={product.image || product.gallery?.[0]} alt={product.name} className="h-full w-full object-cover" />
                      </span>
                      <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight">
                        {product.ui_labels?.base_variant_label || (product.name.length > 15 ? 'Original' : product.name)}
                      </span>
                    </button>
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        aria-pressed={selectedVariant?.id === variant.id}
                        className={`flex w-[76px] flex-col items-center gap-1.5 rounded-xl border p-1.5 text-center transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="block h-14 w-14 overflow-hidden rounded-lg bg-slate-50">
                          <SafeImage
                            src={variant.image || variant.images?.[0] || product.image}
                            alt={variant.name}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight">{variant.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-7">
            <h1 className="font-serif text-[30px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-4xl">{product.name}</h1>

            {/* Promotional Badges & Highlights (All active badges shown on detail page) */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 empty:hidden">
              {getProductBadges(product).filter((badge) => badge.key !== 'new').map((badge) => (
                <span
                  key={badge.key}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs ${badge.color}`}
                >
                  {badge.emoji ? <span>{badge.emoji}</span> : null}
                  <span>{badge.label}</span>
                </span>
              ))}
              {product.has_gift_wrap && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                  🎁 Gift Wrap Included
                </span>
              )}
              {Boolean(product.is_personalization_available || product.is_customizable) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200">
                  ✍️ Custom Personalisation
                </span>
              )}
            </div>

            {product.review_snippet && (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2 text-xs italic text-slate-700">
                <span className="font-semibold not-italic text-ink">Verified Buyer:</span> “{product.review_snippet}”
              </div>
            )}

            <div className="mt-3">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                {discount > 0 && activeMrp && (
                  <>
                    <span className="inline-flex items-center text-lg font-bold text-emerald-600">
                      <ArrowDown className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                      {discount}%
                    </span>
                    <span className="text-base font-medium text-slate-400 line-through">{formatPrice(activeMrp + addonsTotal)}</span>
                  </>
                )}
                <span className="text-3xl font-semibold tracking-tight text-ink">{formatPrice(unitPrice)}</span>
              </div>
              {discount > 0 && activeMrp && (
                <p className="mt-1.5 text-sm font-medium text-emerald-600">
                  You save {formatPrice((activeMrp + addonsTotal) - unitPrice)}
                </p>
              )}
            </div>
            {addonsTotal > 0 && (
              <p className="mt-1 text-xs text-slate-500">Includes {formatPrice(addonsTotal)} in add-ons</p>
            )}

            {Number(product.loyalty_points_value) > 0 && (
              <p className="mt-2 text-xs font-medium text-amber-700 flex items-center gap-1">
                ⭐ Earn +{product.loyalty_points_value} Loyalty Points on this gift
              </p>
            )}

            <div className={`mt-3 rounded-2xl border px-3 py-2.5 ${stockCard}`}>
              <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${stockTone}`}>
                <span className="relative flex h-2 w-2">
                  {!soldOut && (
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${stockDot}`} />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${stockDot}`} />
                </span>
                {stockText}
              </span>

              {infoChips.length > 0 && (
                <div className="mt-2 grid auto-rows-fr grid-cols-2 gap-1.5 border-t border-black/5 pt-2">
                  {infoChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-black/5 bg-white/90 px-2.5 py-1.5 text-xs font-semibold leading-tight text-slate-800 shadow-2xs"
                    >
                      <span className="grid h-4 w-4 shrink-0 place-items-center">{chip.icon}</span>
                      <span className="min-w-0 flex-1 line-clamp-2 wrap-break-word">{chip.label}</span>
                      {chip.tag && (
                        <span className="shrink-0 rounded-full border border-blue-200/80 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                          {chip.tag}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {product.hues && product.hues.length > 0 && (
                <fieldset>
                  <legend className="text-sm font-semibold text-ink">
                    Finish <span className="font-normal text-slate-500">· {selectedHue}</span>
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.hues.map((hue) => (
                      <button
                        key={hue}
                        type="button"
                        aria-pressed={selectedHue === hue}
                        onClick={() => setSelectedHue(hue)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          selectedHue === hue
                            ? 'border-ink bg-ink text-white'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {hue}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {product.addons && product.addons.length > 0 && (
                <fieldset>
                  <legend className="text-sm font-semibold text-ink">Make it extra special</legend>
                  <div className="mt-3 space-y-2">
                    {product.addons.map((addon) => {
                      const checked = selectedAddons.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition ${
                            checked ? 'border-brand bg-brand-soft/60' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleAddon(addon.id)} className="peer sr-only" />
                          <span
                            aria-hidden="true"
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
                              checked ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                          <span className="flex-1 text-sm text-ink">{addon.name}</span>
                          <span className="text-sm font-medium text-slate-600">+{formatPrice(addon.price)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div ref={ctaRef} className="space-y-3">
                <div className="flex gap-3">
                  <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} />
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={soldOut}
                    className="inline-flex h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <ShoppingBag className="h-5 w-5" />
                    {soldOut ? 'Sold out' : 'Add to cart'}
                  </button>
                </div>
                {!soldOut && (
                  <button
                    type="button"
                    onClick={buyNow}
                    className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-full border border-ink px-6 text-[15px] font-semibold text-ink transition hover:bg-ink hover:text-white"
                  >
                    Buy now · {formatPrice(total)}
                  </button>
                )}
              </div>

              {/* Dynamic Flipkart-style Trust / Assurance Badges */}
              {(() => {
                const activeTrustBadges = (product.trust_badges && product.trust_badges.length > 0
                  ? product.trust_badges
                  : DEFAULT_TRUST_BADGES
                ).filter((b) => b.enabled !== false);

                if (activeTrustBadges.length === 0) return null;

                return (
                  <div
                    className="grid gap-2 pt-3.5 pb-2 border-t border-slate-100"
                    style={{ gridTemplateColumns: `repeat(${activeTrustBadges.length}, minmax(0, 1fr))` }}
                  >
                    {activeTrustBadges.map((badge, idx) => (
                      <div
                        key={badge.id || idx}
                        className="flex min-w-0 flex-col items-center text-center gap-1.5 group"
                      >
                        <div className="grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-sky-50/70 border border-sky-100/90 text-blue-600 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                          <TrustBadgeIcon icon={badge.icon} className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="w-full max-w-24 text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2 wrap-break-word">
                          {badge.name}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>



        {descriptionText && (
          <section aria-labelledby="product-description-heading" className="mt-8 sm:mt-10">
            <h2 id="product-description-heading" className="text-lg font-semibold text-ink">
              About this gift
            </h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{descriptionText}</p>
          </section>
        )}

        <ProductInformation details={product.details} />

        <div id="reviews-section" className="scroll-mt-24">
          <ProductReviews productId={product.id} reviews={reviews} loading={reviewsLoading} />
        </div>

        {/* The rest of the catalogue, one swipe away: a rail that scrolls left to right. It stays here even when the shop has
            no other product yet, so the page always ends the same way. */}
        <section className="mt-16 sm:mt-20">
          <SectionHeader
            eyebrow="You may also like"
            title="More gifts they’ll love"
            action={{ label: 'Shop all', to: '/catalog' }}
          />
          <div className="mt-8">
            {related.length > 0 ? (
              <ProductRail products={related} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center">
                <p className="text-3xl" aria-hidden="true">🎁</p>
                <p className="mt-2 font-serif text-lg text-ink">More gifts are on the way</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">New products will appear here. Until then, take a look at the full catalogue.</p>
                <Link to="/catalog" className="mt-4 inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                  Browse catalogue
                </Link>
              </div>
            )}
          </div>
        </section>
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 lg:hidden ${
          showStickyBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">{product.name}</p>
            <p className="text-lg font-semibold text-ink">{formatPrice(total)}</p>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={soldOut}
            tabIndex={showStickyBar ? 0 : -1}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-500"
          >
            <ShoppingBag className="h-4 w-4" />
            {soldOut ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>

      <ProductShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        product={product}
      />
    </div>
  );
};

export const ProductDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { products } = useProducts();
  const [lookup, setLookup] = useState<{ id: string; product: Product | null } | null>(null);

  useEffect(() => {
    let active = true;
    productService
      .getProductById(id)
      .then((found) => {
        if (active) setLookup({ id, product: found });
      })
      .catch(() => {
        if (active) setLookup({ id, product: null });
      });
    return () => {
      active = false;
    };
  }, [id]);

  const settled = lookup?.id === id;
  const product = (settled ? lookup?.product : null) ?? products.find((candidate) => candidate.id === id) ?? null;

  if (!product) {
    return settled ? <ProductUnavailable suggestions={pickMostLoved(products, 8)} /> : <ProductDetailSkeleton />;
  }

  return <ProductDetailView key={product.id} product={product} products={products} />;
};

export default ProductDetailPage;
