import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Upload,
  Eye,
  ExternalLink,
  Minus,
  Loader2,
  Truck,
  Tag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Coins,
  Info,
  CheckCircle2,
  X,
  Image
} from 'lucide-react';
import { Product, CategoryItem, Occasion, ProductVariant, DeliveryOption, TrustBadgeOption, ServiceOption, UiLabels, DEFAULT_TRUST_BADGES, DEFAULT_SERVICE_OPTIONS, DEFAULT_UI_LABELS } from '../../../types/product';
import { productService } from '../../../services/productService';
import { api } from '../../../services/api';
import { OCCASION_META } from '../../../utils/occasionUtils';
import { TRUST_BADGE_ICON_OPTIONS, TrustBadgeIcon } from '../../../utils/trustBadgeIcons';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterTabs,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SwitchField,
  Textarea,
  Toast,
  cx,
  useRowSelection
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';
import { BADGE_DEFINITIONS, ProductBadgeKey } from '../../../utils/badges';

const OCCASIONS_LIST: Occasion[] = OCCASION_META.map((occasion) => occasion.name);
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=300';
const PAGE_SIZE = 10;
const LOW_STOCK = 10;

export const DEFAULT_FORM_DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: '1', name: 'Super Fast Delivery', price: '₹49', enabled: false },
  { id: '2', name: 'Standard Delivery', price: 'Free', enabled: true },
  { id: '3', name: 'Same-Day Rush', price: '₹99', enabled: false }
];

type ProductForm = {
  name: string;
  tagline: string;
  description: string;
  price: number;
  mrp: number | '';
  category: string;
  category_id?: string;
  stock: number;
  images: string[];
  occasions: Occasion[];
  badges: ProductBadgeKey[];
  is_new: boolean;
  is_bestseller: boolean;
  is_customizable: boolean;
  is_trending: boolean;
  has_gift_wrap: boolean;
  express_delivery_available: boolean;
  review_snippet: string;
  is_eco_friendly: boolean;
  is_top_rated_this_week: boolean;
  is_personalization_available: boolean;
  loyalty_points_value: number;
  is_budget_friendly: boolean;
  delivery_charge: number | '';
  is_free_delivery: boolean;
  delivery_time_text: string;
  delivery_options: DeliveryOption[];
  trust_badges: TrustBadgeOption[];
  services: ServiceOption[];
  ui_labels: UiLabels;
  coupon_code: string;
  min_order_amount: number | '';
  max_discount: number | '';
  is_active: boolean;
  rating: number;
  review_count: number;
  variants: ProductVariant[];
};

const Thumb: React.FC<{ src?: string; size?: 'sm' | 'md' }> = ({ src, size = 'md' }) => (
  <img
    src={src || FALLBACK_IMAGE}
    alt=""
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
    }}
    className={cx(
      'shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover',
      size === 'md' ? 'h-11 w-11' : 'h-9 w-9'
    )}
  />
);

const FormAccordionSection: React.FC<{
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, icon, title, subtitle, badge, isOpen, onToggle, children }) => (
  <div id={id} className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-200">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={cx(
        'group/accordion w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors cursor-pointer select-none',
        isOpen ? 'bg-slate-50/90 border-b border-slate-200/80' : 'bg-white hover:bg-slate-50/70'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            {badge && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 truncate max-w-[200px]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center justify-center shrink-0 ml-2 h-8 w-8 rounded-full transition-colors group-hover/accordion:bg-slate-200/50">
        <ChevronDown 
          className={cx(
            'h-5 w-5 transition-transform duration-300', 
            isOpen ? '-rotate-180 text-blue-600' : 'text-slate-400 group-hover/accordion:text-slate-600'
          )} 
        />
      </div>
    </button>
    <div
      className={cx(
        'grid transition-all duration-300 ease-in-out',
        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="overflow-hidden">
        <div className="p-4 sm:p-5 space-y-4 bg-white">
          {children}
        </div>
      </div>
    </div>
  </div>
);

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingVariantImage, setIsUploadingVariantImage] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '',
    tagline: '',
    description: '',
    price: 999,
    mrp: '',
    category: 'Personalized Gifts',
    stock: 25,
    images: ['/banners/hero-banner-1.png'],
    occasions: ['Birthday', 'Anniversary'],
    badges: [],
    is_new: false,
    is_bestseller: false,
    is_customizable: true,
    is_trending: false,
    has_gift_wrap: false,
    express_delivery_available: false,
    review_snippet: '',
    is_eco_friendly: false,
    is_top_rated_this_week: false,
    is_personalization_available: false,
    loyalty_points_value: 0,
    is_budget_friendly: false,
    delivery_charge: '',
    is_free_delivery: false,
    delivery_time_text: '2-3 Business Days',
    delivery_options: DEFAULT_FORM_DELIVERY_OPTIONS,
    trust_badges: DEFAULT_TRUST_BADGES,
    services: DEFAULT_SERVICE_OPTIONS,
    ui_labels: {},
    coupon_code: '',
    min_order_amount: '',
    max_discount: '',
    is_active: true,
    rating: 4.8,
    review_count: 12,
    variants: []
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    pricing: true,
    delivery: true,
    coupons: true,
    variants: false,
    photos: true,
    badges: false,
    uicustom: false
  });
  const [showImageSizeGuide, setShowImageSizeGuide] = useState<boolean>(true);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllSections = () => {
    setOpenSections({
      basic: true,
      pricing: true,
      delivery: true,
      coupons: true,
      variants: true,
      photos: true,
      badges: true,
      uicustom: true
    });
  };

  const collapseAllSections = () => {
    setOpenSections({
      basic: false,
      pricing: false,
      delivery: false,
      coupons: false,
      variants: false,
      photos: false,
      badges: false,
      uicustom: false
    });
  };
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Reviews Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewingProduct, setReviewingProduct] = useState<Product | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', buyer_id: '' });
  const [isSavingReview, setIsSavingReview] = useState(false);

  const showToast = (msg: string, tone: 'success' | 'danger' = 'success') => {
    setToastMessage(msg);
    setToastTone(tone);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    const [fetchedCategories, fetchedProducts] = await Promise.all([
      productService.getAllCategories(),
      productService.getAllProducts()
    ]);
    setCategories(fetchedCategories);
    setProducts(fetchedProducts);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const unsubProds = productService.subscribeToProducts((updated) => setProducts(updated));
    const unsubCats = productService.subscribeToCategories((updated) => setCategories(updated));

    return () => {
      unsubProds();
      unsubCats();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategoryFilter === 'All' || p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const displayedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  // Multi-select works on the rows currently shown (this page, this filter)
  const selection = useRowSelection(displayedProducts.map((p) => p.id));

  const stats = useMemo(
    () => ({
      active: products.filter((p) => p.is_active !== false).length,
      lowStock: products.filter((p) => (p.stock ?? 0) < LOW_STOCK).length
    }),
    [products]
  );

  const handleOpenCreate = () => {
    setEditingProductId(null);
    setImageUrlInput('');
    setFormError(null);
    setProductForm({
      name: '',
      tagline: '',
      description: '',
      price: 1299,
      mrp: '',
      category: categories[0]?.name || 'Personalized Gifts',
      category_id: categories[0]?.id,
      stock: 20,
      images: ['/banners/hero-banner-1.png'],
      occasions: ['Birthday', 'Anniversary'],
      badges: [],
      is_new: false,
      is_bestseller: false,
      is_customizable: true,
      is_trending: false,
      has_gift_wrap: false,
      express_delivery_available: false,
      review_snippet: '',
      is_eco_friendly: false,
      is_top_rated_this_week: false,
      is_personalization_available: false,
      loyalty_points_value: 0,
      is_budget_friendly: false,
      delivery_charge: '',
      is_free_delivery: false,
      delivery_time_text: '2-3 Business Days',
      delivery_options: DEFAULT_FORM_DELIVERY_OPTIONS,
      trust_badges: DEFAULT_TRUST_BADGES,
      services: DEFAULT_SERVICE_OPTIONS,
      ui_labels: {},
      coupon_code: '',
      min_order_amount: '',
      max_discount: '',
      is_active: true,
      rating: 4.8,
      review_count: 12,
      variants: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProductId(p.id);
    setImageUrlInput('');
    setFormError(null);
    const existingImages = [...new Set([p.image, ...(p.gallery ?? [])].filter(Boolean))];

    const initialBadges: ProductBadgeKey[] = Array.isArray(p.badges) && p.badges.length > 0
      ? (p.badges as ProductBadgeKey[])
      : [
          ...(p.isNew ? ['new' as const] : []),
          ...(p.isBestSeller ? ['bestseller' as const] : []),
          ...(p.is_trending ? ['trending' as const] : []),
          ...(p.is_top_rated_this_week ? ['top_rated' as const] : []),
          ...(p.is_eco_friendly ? ['eco' as const] : []),
          ...(p.is_budget_friendly ? ['budget' as const] : [])
        ];

    setProductForm({
      name: p.name,
      tagline: p.tagline || '',
      description: p.description || '',
      price: p.price,
      mrp: p.mrp || '',
      category: p.category,
      category_id: p.category_id,
      stock: p.stock ?? 25,
      images: existingImages.length > 0 ? existingImages : ['/banners/hero-banner-1.png'],
      occasions: p.occasions || ['Birthday'],
      badges: initialBadges,
      is_new: initialBadges.includes('new') || Boolean(p.isNew),
      is_bestseller: initialBadges.includes('bestseller') || Boolean(p.isBestSeller),
      is_customizable: Boolean(p.is_customizable),
      is_trending: initialBadges.includes('trending') || Boolean(p.is_trending),
      has_gift_wrap: Boolean(p.has_gift_wrap),
      express_delivery_available: Boolean(p.express_delivery_available),
      review_snippet: p.review_snippet || '',
      is_eco_friendly: initialBadges.includes('eco') || Boolean(p.is_eco_friendly),
      is_top_rated_this_week: initialBadges.includes('top_rated') || Boolean(p.is_top_rated_this_week),
      is_personalization_available: Boolean(p.is_personalization_available),
      loyalty_points_value: Number(p.loyalty_points_value) || 0,
      is_budget_friendly: initialBadges.includes('budget') || Boolean(p.is_budget_friendly),
      delivery_charge: p.delivery_charge !== undefined && p.delivery_charge !== null ? p.delivery_charge : '',
      is_free_delivery: Boolean(p.is_free_delivery),
      delivery_time_text: p.delivery_time_text || '',
      delivery_options: Array.isArray(p.delivery_options) && p.delivery_options.length > 0
        ? p.delivery_options
        : DEFAULT_FORM_DELIVERY_OPTIONS,
      trust_badges: Array.isArray(p.trust_badges) && p.trust_badges.length > 0
        ? p.trust_badges
        : DEFAULT_TRUST_BADGES,
      services: Array.isArray(p.services) && p.services.length > 0
        ? p.services
        : DEFAULT_SERVICE_OPTIONS,
      ui_labels: p.ui_labels || {},
      coupon_code: p.coupon_code || '',
      min_order_amount: p.min_order_amount !== undefined && p.min_order_amount !== null ? p.min_order_amount : '',
      max_discount: p.max_discount !== undefined && p.max_discount !== null ? p.max_discount : '',
      is_active: p.is_active !== false,
      rating: p.rating || 0,
      review_count: p.reviewCount || 0,
      variants: p.variants || []
    });
    setIsModalOpen(true);
  };

  // Uploads to Cloudinary (folder: GIFT_APPLICATION) and appends to the gallery
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingImage(true);
    try {
      const res = await api.uploadImage(file, productForm.name || 'product');
      if (res.secure_url) {
        setProductForm((prev) => ({ ...prev, images: [...prev.images, res.secure_url] }));
        showToast('Photo uploaded');
      }
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      showToast('Image upload failed: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleVariantImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingVariantImage(index);
    try {
      const res = await api.uploadImage(file, productForm.name || 'variant');
      if (res.secure_url) {
        setProductForm((prev) => {
          const newVariants = [...prev.variants];
          const currentVariant = newVariants[index];
          const variantImages = currentVariant.images ? [...currentVariant.images] : (currentVariant.image ? [currentVariant.image] : []);
          variantImages.push(res.secure_url);
          newVariants[index] = { ...currentVariant, image: variantImages[0], images: variantImages };
          return { ...prev, variants: newVariants };
        });
        showToast('Variant photo uploaded');
      }
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      showToast('Variant image upload failed: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingVariantImage(null);
    }
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setProductForm((prev) => ({ ...prev, images: [...prev.images, url] }));
    setImageUrlInput('');
  };

  const handleRemoveImage = (index: number) => {
    setProductForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleMakeCoverImage = (index: number) => {
    setProductForm((prev) => {
      const images = [...prev.images];
      const [chosen] = images.splice(index, 1);
      images.unshift(chosen);
      return { ...prev, images };
    });
  };

  const toggleBadge = (key: ProductBadgeKey) => {
    setProductForm((prev) => {
      const exists = prev.badges.includes(key);
      const nextBadges = exists
        ? prev.badges.filter((b) => b !== key)
        : [...prev.badges, key];
      return {
        ...prev,
        badges: nextBadges,
        is_new: nextBadges.includes('new'),
        is_bestseller: nextBadges.includes('bestseller'),
        is_trending: nextBadges.includes('trending'),
        is_top_rated_this_week: nextBadges.includes('top_rated'),
        is_eco_friendly: nextBadges.includes('eco'),
        is_budget_friendly: nextBadges.includes('budget')
      };
    });
  };

  const toggleOccasion = (occasion: Occasion) => {
    setProductForm((prev) => ({
      ...prev,
      occasions: prev.occasions.includes(occasion)
        ? prev.occasions.filter((o) => o !== occasion)
        : [...prev.occasions, occasion]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setFormError('Please enter a product name.');
      return;
    }
    if (productForm.images.length === 0) {
      setFormError('Please add at least one product photo.');
      return;
    }
    setFormError(null);
    setIsSaving(true);

    const [coverImage, ...restImages] = productForm.images;
    const payload = {
      name: productForm.name.trim(),
      tagline: productForm.tagline.trim(),
      description: productForm.description,
      price: Number(productForm.price),
      mrp: productForm.mrp !== '' && Number(productForm.mrp) > 0 ? Number(productForm.mrp) : undefined,
      category: productForm.category,
      category_id: productForm.category_id,
      stock: Number(productForm.stock),
      image: coverImage,
      gallery: [coverImage, ...restImages],
      occasions: productForm.occasions,
      badges: productForm.badges,
      isNew: productForm.is_new,
      isBestSeller: productForm.is_bestseller,
      is_customizable: productForm.is_customizable,
      is_trending: productForm.is_trending,
      has_gift_wrap: productForm.has_gift_wrap,
      express_delivery_available: productForm.express_delivery_available,
      review_snippet: productForm.review_snippet.trim(),
      is_eco_friendly: productForm.is_eco_friendly,
      is_top_rated_this_week: productForm.is_top_rated_this_week,
      is_personalization_available: productForm.is_personalization_available,
      loyalty_points_value: Number(productForm.loyalty_points_value) || 0,
      is_budget_friendly: productForm.is_budget_friendly,
      delivery_charge: productForm.delivery_charge !== '' ? Number(productForm.delivery_charge) : null,
      is_free_delivery: Boolean(productForm.is_free_delivery),
      delivery_time_text: productForm.delivery_time_text?.trim() || undefined,
      delivery_options: productForm.delivery_options,
      trust_badges: productForm.trust_badges,
      services: productForm.services.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() })),
      ui_labels: Object.fromEntries(
        Object.entries(productForm.ui_labels).filter(([, value]) => typeof value === 'string' && value.trim())
          .map(([key, value]) => [key, (value as string).trim()])
      ) as UiLabels,
      coupon_code: productForm.coupon_code?.trim() ? productForm.coupon_code.trim().toUpperCase() : undefined,
      min_order_amount: productForm.min_order_amount !== '' ? Number(productForm.min_order_amount) : null,
      max_discount: productForm.max_discount !== '' ? Number(productForm.max_discount) : null,
      is_active: productForm.is_active,
      rating: Number(productForm.rating) || 0,
      reviewCount: Number(productForm.review_count) || 0,
      variants: productForm.variants
    };

    try {
      if (editingProductId) {
        await productService.updateProduct(editingProductId, payload);
        showToast('Product updated', 'success');
      } else {
        await productService.createProduct(payload);
        showToast('Product added to the catalog', 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save product error:', err);
      const msg = err.message || 'Failed to save product';
      setFormError(msg);
      showToast(msg, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    await productService.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast(`“${name}” deleted`);
  };

  const confirmDeleteSelected = async () => {
    const ids = [...selection.selected];
    setConfirmBulkDelete(false);
    setBulkDeleting(true);
    try {
      const deleted = await productService.deleteProducts(ids);
      const removed = new Set(ids);
      setProducts((prev) => prev.filter((p) => !removed.has(p.id)));
      selection.clear();
      showToast(`${deleted} ${deleted === 1 ? 'product' : 'products'} deleted`);
    } catch (err: any) {
      showToast(err.message || 'Could not delete the selected products', 'danger');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    const newStatus = await productService.toggleProductStatus(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: newStatus } : p)));
    showToast(newStatus ? 'Product is now live' : 'Product hidden from the store');
  };

  const handleAdjustStock = async (id: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta);
    await productService.updateProductStock(id, newStock);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: newStock } : p)));
  };

  const stockStepper = (product: Product) => {
    const stock = product.stock ?? 20;
    const low = stock < LOW_STOCK;
    return (
      <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          aria-label={`Decrease stock of ${product.name}`}
          onClick={() => handleAdjustStock(product.id, stock, -1)}
          className="grid h-9 w-9 place-items-center rounded-l-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer sm:h-8 sm:w-8"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span
          className={cx(
            'min-w-[2.5rem] px-1 text-center text-[13px] font-semibold tabular-nums',
            low ? 'text-amber-600' : 'text-slate-800'
          )}
        >
          {stock}
        </span>
        <button
          type="button"
          aria-label={`Increase stock of ${product.name}`}
          onClick={() => handleAdjustStock(product.id, stock, 1)}
          className="grid h-9 w-9 place-items-center rounded-r-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer sm:h-8 sm:w-8"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const statusToggle = (product: Product) => {
    const live = product.is_active !== false;
    return (
      <button
        type="button"
        onClick={() => handleToggleStatus(product.id)}
        title={live ? 'Click to hide from the store' : 'Click to publish'}
        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <Badge tone={live ? 'success' : 'neutral'}>
          <span className={cx('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-slate-400')} />
          {live ? 'Live' : 'Hidden'}
        </Badge>
      </button>
    );
  };

  const handleOpenAddReview = (p: Product) => {
    setReviewingProduct(p);
    setReviewForm({ rating: 5, comment: '', buyer_id: '' });
    setIsReviewModalOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingProduct) return;
    setIsSavingReview(true);
    try {
      await api.createReviewAsAdmin({
        product_id: reviewingProduct.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        buyer_id: reviewForm.buyer_id || null, // allow null for guest reviews
      });
      showToast('Review added successfully', 'success');
      setIsReviewModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to add review', 'danger');
    } finally {
      setIsSavingReview(false);
    }
  };

  const rowActions = (product: Product) => (
    <div className="flex items-center justify-end gap-0.5">
      <a
        href={`/product/${product.id}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Preview ${product.name}`}
        title="Preview on store"
        className="grid h-9 w-9 place-items-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-900 sm:h-8 sm:w-8"
      >
        <Eye className="h-4 w-4" />
      </a>
      <IconButton label={`Add Review to ${product.name}`} onClick={() => handleOpenAddReview(product)}>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </IconButton>
      <IconButton label={`Edit ${product.name}`} onClick={() => handleOpenEdit(product)}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton label={`Delete ${product.name}`} tone="danger" onClick={() => setPendingDelete(product)}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );

  const columns: DataColumn<Product>[] = [
    {
      key: 'product',
      header: 'Product',
      mobile: 'title',
      cell: (product, layout) => (
        <div className="flex min-w-0 items-center gap-3">
          <Thumb src={product.image} />
          <div className={cx('min-w-0', layout === 'table' && 'max-w-[260px]')}>
            <div className="flex min-w-0 items-center gap-1 flex-wrap">
              <p className="truncate text-[13px] font-semibold text-slate-900">{product.name}</p>
              {product.is_trending && (
                <Badge tone="amber" className="shrink-0 px-1 text-[9px]">
                  🔥 Trending
                </Badge>
              )}
              {product.is_top_rated_this_week && (
                <Badge tone="blue" className="shrink-0 px-1 text-[9px]">
                  ⭐ Top
                </Badge>
              )}
              {product.is_eco_friendly && (
                <Badge tone="emerald" className="shrink-0 px-1 text-[9px]">
                  🌱 Eco
                </Badge>
              )}
              {product.express_delivery_available && (
                <Badge tone="indigo" className="shrink-0 px-1 text-[9px]">
                  ⚡ Rush
                </Badge>
              )}
              {product.has_gift_wrap && (
                <Badge tone="rose" className="shrink-0 px-1 text-[9px]">
                  🎁 Gift Wrap
                </Badge>
              )}
              {Boolean(product.is_personalization_available || product.is_customizable) && (
                <Badge tone="violet" className="shrink-0 px-1 text-[9px]">
                  Personalisable
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs font-normal text-slate-500">
              {product.tagline || product.description || product.category}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'price-mobile',
      header: 'Price',
      mobile: 'aside',
      only: 'card',
      cell: (product) => (
        <span className="text-[15px] font-bold tabular-nums text-slate-900">
          ₹{product.price.toLocaleString('en-IN')}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Category',
      className: 'whitespace-nowrap',
      cell: (product) => <span className="text-slate-700">{product.category}</span>
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      only: 'table',
      className: 'whitespace-nowrap',
      cell: (product) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold tabular-nums text-slate-900">₹{product.price.toLocaleString('en-IN')}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-[11px] text-slate-400 line-through tabular-nums">
              ₹{product.mrp.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'delivery',
      header: 'Delivery',
      align: 'center',
      className: 'whitespace-nowrap',
      cell: (product) => (
        <span className="inline-flex items-center gap-1 text-xs">
          {product.is_free_delivery ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold text-[11px]">
              Free
            </span>
          ) : product.delivery_charge !== undefined && product.delivery_charge !== null ? (
            <span className="text-slate-700 font-semibold tabular-nums">
              ₹{product.delivery_charge}
            </span>
          ) : (
            <span className="text-slate-400 text-[11px]">Default</span>
          )}
        </span>
      )
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'center',
      cell: stockStepper
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      mobile: 'footer',
      mobileClassName: 'flex-1',
      cell: statusToggle
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobile: 'footer',
      cell: rowActions
    }
  ];

  return (
    <div className="space-y-4">
      <Toast message={toastMessage} tone={toastTone} />

      <PageHeader
        icon={<Package className="h-5 w-5" />}
        title="Products & inventory"
        description={`${products.length} products · ${stats.active} live${
          stats.lowStock > 0 ? ` · ${stats.lowStock} low on stock` : ''
        }`}
        actions={
          <>
            <a
              href="/catalog"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:h-9"
            >
              View store <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <IconButton label="Refresh products" onClick={loadData} className="border-slate-200 bg-white">
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
              Add product
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <FilterTabs
            value={selectedCategoryFilter}
            onChange={(id) => {
              setSelectedCategoryFilter(id);
              setCurrentPage(1);
            }}
            items={[
              { id: 'All', label: 'All', count: products.length },
              ...categories.map((c) => ({
                id: c.name,
                label: c.name,
                count: products.filter((p) => p.category.toLowerCase() === c.name.toLowerCase()).length
              }))
            ]}
          />
          <SearchInput
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            placeholder="Search products…"
            icon={<Search className="h-3.5 w-3.5" />}
            className="sm:max-w-sm"
          />
        </div>

        <DataTable
          columns={columns}
          rows={displayedProducts}
          rowKey={(p) => p.id}
          selectedKeys={selection.selected}
          onSelectionChange={selection.setSelected}
          selectLabel={(p) => p.name}
          loading={loading && products.length === 0}
          loadingLabel="Loading products…"
          empty={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={searchQuery || selectedCategoryFilter !== 'All' ? 'No matching products' : 'No products yet'}
              description={
                searchQuery || selectedCategoryFilter !== 'All'
                  ? 'Try a different search or category.'
                  : 'Add your first product to start selling.'
              }
              action={
                !searchQuery && selectedCategoryFilter === 'All' ? (
                  <Button variant="primary" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
                    Add product
                  </Button>
                ) : undefined
              }
            />
          }
        />

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={filteredProducts.length}
          pageSize={PAGE_SIZE}
          onChange={setCurrentPage}
        />
      </Card>

      {/* Add / edit product */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="lg"
        title={editingProductId ? 'Edit product' : 'Add a new product'}
        subtitle={
          editingProductId ? 'Changes go live on the storefront as soon as you save.' : 'It appears in the catalog once published.'
        }
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex-shrink-0 mr-4">
              <SwitchField
                label="👁️ Published (Live)"
                description="Visible to shoppers"
                checked={productForm.is_active}
                onChange={(checked) => setProductForm((prev) => ({ ...prev, is_active: checked }))}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="product-form"
                disabled={isSaving || isUploadingImage}
                icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                {editingProductId ? 'Save changes' : 'Add product'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {formError}
            </p>
          )}

          {/* Expand / Collapse All Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2.5">
            <span className="text-xs text-slate-600 font-medium">
              Product details organized into 6 sections. Click <span className="font-semibold text-slate-800">[+ Expand]</span> or <span className="font-semibold text-slate-800">[− Collapse]</span> on any section:
            </span>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 text-xs">
              <button
                type="button"
                onClick={expandAllSections}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAllSections}
                className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Minus className="h-3 w-3" />
                Collapse all
              </button>
            </div>
          </div>
          
          {/* Quick Shift Navigation */}
          <div className="flex overflow-x-auto no-scrollbar py-2 mb-2 gap-2 border-b border-slate-100">
            {[
              { id: 'basic', label: 'Basic Info', icon: <Package className="h-3.5 w-3.5" /> },
              { id: 'pricing', label: 'Pricing', icon: <Coins className="h-3.5 w-3.5" /> },
              { id: 'delivery', label: 'Delivery', icon: <Truck className="h-3.5 w-3.5" /> },
              { id: 'coupons', label: 'Coupons', icon: <Tag className="h-3.5 w-3.5" /> },
              { id: 'variants', label: 'Variants', icon: <Package className="h-3.5 w-3.5" /> },
              { id: 'photos', label: 'Photos', icon: <Image className="h-3.5 w-3.5" /> },
              { id: 'badges', label: 'Badges', icon: <Sparkles className="h-3.5 w-3.5" /> },
              { id: 'uicustom', label: 'UI Custom', icon: <Pencil className="h-3.5 w-3.5" /> }
            ].map(sec => (
              <button
                key={sec.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenSections({
                    basic: false,
                    pricing: false,
                    delivery: false,
                    coupons: false,
                    variants: false,
                    photos: false,
                    badges: false,
                    uicustom: false,
                    [sec.id]: true
                  });
                  setTimeout(() => {
                    const el = document.getElementById(`section-${sec.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 50);
                }}
                className={`flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border cursor-pointer ${
                  openSections[sec.id] 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sec.icon}
                {sec.label}
              </button>
            ))}
          </div>

          {/* Section 1: Basic Information */}
          <FormAccordionSection
            id="section-basic"
            icon={<Package className="h-4 w-4" />}
            title="1. Basic Information & Occasions"
            subtitle="Product title, subtitle tagline, category & occasions"
            badge={productForm.name ? productForm.name : undefined}
            isOpen={Boolean(openSections.basic)}
            onToggle={() => toggleSection('basic')}
          >
            <div>
              <Label htmlFor="product-name">Product name</Label>
              <Input
                id="product-name"
                required
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Royal Kashmiri Saffron & Honey Hamper"
              />
            </div>

            <div>
              <Label htmlFor="product-tagline">Card Tagline / Subtitle</Label>
              <Input
                id="product-tagline"
                value={productForm.tagline}
                onChange={(e) => setProductForm((prev) => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g. Handcrafted chocolates & fresh hand-tied blooms"
              />
              <p className="mt-1 text-[11px] text-slate-400">Short highlight displayed under the title on the storefront product card.</p>
            </div>

            <div>
              <Label htmlFor="product-category">Category</Label>
              <Select
                id="product-category"
                value={productForm.category}
                onChange={(e) => {
                  const selected = categories.find((c) => c.name === e.target.value);
                  setProductForm((prev) => ({ ...prev, category: e.target.value, category_id: selected?.id }));
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                rows={3}
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What's inside, what makes it special…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product-rating">Display Rating (e.g. 4.8)</Label>
                <Input
                  id="product-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={productForm.rating}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                  placeholder="e.g. 4.8"
                />
              </div>
              <div>
                <Label htmlFor="product-review-count">Total Reviews Count</Label>
                <Input
                  id="product-review-count"
                  type="number"
                  min="0"
                  value={productForm.review_count}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, review_count: Number(e.target.value) }))}
                  placeholder="e.g. 15"
                />
              </div>
            </div>


            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold text-slate-700">Occasions</legend>
              <p className="mb-2 text-[11px] text-slate-500">
                The product appears under these occasions in the storefront menu.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {OCCASIONS_LIST.map((occasion) => {
                  const active = productForm.occasions.includes(occasion);
                  return (
                    <button
                      key={occasion}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleOccasion(occasion)}
                      className={cx(
                        'h-8 rounded-full border px-3 text-xs font-medium transition-colors cursor-pointer',
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      )}
                    >
                      {occasion}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Gifting options */}
            <div className="pt-4 border-t border-slate-200">
              <div className="mb-2.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>🎁</span> Gifting options
                </h5>
                <p className="text-[11px] text-slate-500">
                  Select gift wrap and custom personalization features for this item.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <SwitchField
                  label="🎁 Gift Wrap"
                  description="Allow buyers to select premium gift wrap"
                  checked={productForm.has_gift_wrap}
                  onChange={(checked) => setProductForm((prev) => ({ ...prev, has_gift_wrap: checked }))}
                />
                <SwitchField
                  label="✍️ Personalization Available"
                  description="Custom engraving, monogram, or name printing"
                  checked={productForm.is_personalization_available}
                  onChange={(checked) => setProductForm((prev) => ({ ...prev, is_personalization_available: checked }))}
                />
                <SwitchField
                  label="🎨 Personalisable Note/Card"
                  description="Shoppers can add a custom note or photo"
                  checked={productForm.is_customizable}
                  onChange={(checked) => setProductForm((prev) => ({ ...prev, is_customizable: checked }))}
                />
              </div>
            </div>
          </FormAccordionSection>

          {/* Section 2: Pricing, Stock & Ratings */}
          <FormAccordionSection
            id="section-pricing"
            icon={<Coins className="h-4 w-4" />}
            title="2. Pricing, Inventory & Ratings"
            subtitle="Selling price, MRP, discount badge, stock & customer ratings"
            badge={`₹${productForm.price || 0} • Stock: ${productForm.stock ?? 0}`}
            isOpen={Boolean(openSections.pricing)}
            onToggle={() => toggleSection('pricing')}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="product-price">Selling Price (₹)</Label>
                <Input
                  id="product-price"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  className="tabular-nums font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="product-mrp">Old Price / MRP (₹)</Label>
                <Input
                  id="product-mrp"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={productForm.mrp}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, mrp: e.target.value === '' ? '' : Number(e.target.value) }))}
                  placeholder="e.g. 1624"
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="product-stock">Stock Units</Label>
                <Input
                  id="product-stock"
                  type="number"
                  inputMode="numeric"
                  required
                  min={0}
                  value={productForm.stock}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="product-delivery-charge-main">
                  Delivery Amount (₹)
                </Label>
                <Input
                  id="product-delivery-charge-main"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={productForm.delivery_charge}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setProductForm((prev) => ({
                      ...prev,
                      delivery_charge: val,
                      is_free_delivery: val === 0
                    }));
                  }}
                  placeholder="0 = Free, or 49, 99"
                  className="tabular-nums font-semibold text-emerald-700 bg-emerald-50/40 border-emerald-300"
                />
                <span className="text-[10px] text-slate-500 mt-1 block truncate">
                  {productForm.delivery_charge === 0 || productForm.is_free_delivery
                    ? '🎉 Free Delivery'
                    : productForm.delivery_charge !== ''
                    ? `₹${productForm.delivery_charge} fee for this item`
                    : 'Default store shipping'}
                </span>
              </div>
            </div>

            {/* Live Discount Calculator Preview */}
            {Number(productForm.mrp) > Number(productForm.price) ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                  🎉 Live Card Preview:
                  <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                    {Math.round(((Number(productForm.mrp) - Number(productForm.price)) / Number(productForm.mrp)) * 100)}% OFF
                  </span>
                </span>
                <span className="text-emerald-700 font-medium">
                  Old price ₹{productForm.mrp} will show with diagonal red slash
                </span>
              </div>
            ) : Number(productForm.mrp) > 0 ? (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
                ⚠️ Old Price (MRP) should be higher than Selling Price to display a discount on the card.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label htmlFor="product-rating">Rating (0.0 to 5.0 ⭐)</Label>
                <Input
                  id="product-rating"
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  value={productForm.rating}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                  placeholder="e.g. 4.8"
                  className="tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-400">Shown in the corner overlay badge on the product image.</p>
              </div>
              <div>
                <Label htmlFor="product-review-count">Review Count</Label>
                <Input
                  id="product-review-count"
                  type="number"
                  min={0}
                  value={productForm.review_count}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, review_count: Math.max(0, parseInt(e.target.value) || 0) }))}
                  placeholder="e.g. 120"
                  className="tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-400">Total customer reviews count displayed to buyers.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-100">
              <div>
                <Label htmlFor="product-loyalty-points">Loyalty Points Value</Label>
                <Input
                  id="product-loyalty-points"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={productForm.loyalty_points_value}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, loyalty_points_value: Math.max(0, parseInt(e.target.value) || 0) }))}
                  placeholder="e.g. 50"
                  className="tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-400">Bonus loyalty reward points earned by customer upon purchase.</p>
              </div>
              <div>
                <Label htmlFor="product-review-snippet">Review Snippet (Social Proof)</Label>
                <Input
                  id="product-review-snippet"
                  value={productForm.review_snippet}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, review_snippet: e.target.value }))}
                  placeholder="e.g. “Absolutely stunning gift!” — Ananya"
                />
                <p className="mt-1 text-[11px] text-slate-400">Curated customer quote displayed on the product page.</p>
              </div>
            </div>
          </FormAccordionSection>

          {/* Section 3: Delivery Charges & Shipping Options */}
          <FormAccordionSection
            id="section-delivery"
            icon={<Truck className="h-4 w-4" />}
            title="3. Delivery Charges & Shipping Options"
            subtitle="Free delivery rule, express dispatch & custom delivery badges"
            badge={
              productForm.is_free_delivery
                ? '✓ Free Delivery'
                : `${(productForm.delivery_options || []).filter((o) => o.enabled).length} Badges Active`
            }
            isOpen={Boolean(openSections.delivery)}
            onToggle={() => toggleSection('delivery')}
          >
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                    Free Delivery for this Product
                  </h5>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Enable to waive shipping charges whenever this product is purchased.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={productForm.is_free_delivery}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        is_free_delivery: e.target.checked
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              {productForm.is_free_delivery && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-white/80 border border-emerald-300/80 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Storefront product card will proudly display: "🚚 Free Delivery"
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <SwitchField
                label="⚡ Express Delivery Available"
                description="Eligible for rapid same-day or rush 1-hour dispatch"
                checked={productForm.express_delivery_available}
                onChange={(checked) => setProductForm((prev) => ({ ...prev, express_delivery_available: checked }))}
              />
            </div>

            {/* 3 Editable Delivery Option Badges */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-blue-600" />
                  Custom Delivery Option Badges (3 Options)
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Edit the badge name, price label, and toggle whether each appears on the product page.
                </p>
              </div>

              <div className="space-y-3">
                {(productForm.delivery_options || DEFAULT_FORM_DELIVERY_OPTIONS).map((opt, idx) => (
                  <div
                    key={opt.id || idx}
                    className={cx(
                      'rounded-xl border p-3.5 transition-all duration-200',
                      opt.enabled
                        ? 'border-blue-200 bg-blue-50/30 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          Delivery Option {idx + 1}
                        </span>
                        {opt.enabled ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ Active on UI
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            Hidden from UI
                          </span>
                        )}
                      </div>

                      {/* Toggle button */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 gap-2">
                        <span className="text-xs font-medium text-slate-600 select-none">
                          {opt.enabled ? 'Showing on UI' : 'Hidden'}
                        </span>
                        <input
                          type="checkbox"
                          checked={opt.enabled}
                          onChange={(e) => {
                            const newOptions = [...(productForm.delivery_options || DEFAULT_FORM_DELIVERY_OPTIONS)];
                            newOptions[idx] = { ...opt, enabled: e.target.checked };
                            setProductForm((prev) => ({ ...prev, delivery_options: newOptions }));
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`delivery-opt-name-${idx}`} className="text-[11px] font-medium text-slate-700">
                          Option Name
                        </Label>
                        <Input
                          id={`delivery-opt-name-${idx}`}
                          value={opt.name}
                          onChange={(e) => {
                            const newOptions = [...(productForm.delivery_options || DEFAULT_FORM_DELIVERY_OPTIONS)];
                            newOptions[idx] = { ...opt, name: e.target.value };
                            setProductForm((prev) => ({ ...prev, delivery_options: newOptions }));
                          }}
                          placeholder={idx === 0 ? 'e.g. Super Fast Delivery' : idx === 1 ? 'e.g. Standard Delivery' : 'e.g. Same-Day Rush'}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`delivery-opt-price-${idx}`} className="text-[11px] font-medium text-slate-700">
                          Price Label
                        </Label>
                        <Input
                          id={`delivery-opt-price-${idx}`}
                          value={opt.price}
                          onChange={(e) => {
                            const newOptions = [...(productForm.delivery_options || DEFAULT_FORM_DELIVERY_OPTIONS)];
                            newOptions[idx] = { ...opt, price: e.target.value };
                            setProductForm((prev) => ({ ...prev, delivery_options: newOptions }));
                          }}
                          placeholder={idx === 0 ? 'e.g. ₹49' : idx === 1 ? 'e.g. Free' : 'e.g. ₹99'}
                          className="h-9 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Live Preview Chip */}
                    {opt.name && (
                      <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-medium">Storefront Preview:</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900 border border-sky-200">
                          <Truck className="h-3 w-3 text-sky-600 shrink-0" />
                          <span>{opt.name}</span>
                          {opt.price && (
                            <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold text-sky-800 border border-sky-200">
                              {opt.price}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Services & Things Available (dynamic list) */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Services &amp; Things Available
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Add anything this gift offers, like "Upload Your Photo", "Print Your Name" or "Add Your Signature". Enabled ones show as equal-size cards on the product page.
                </p>
              </div>

              <div className="space-y-2.5">
                {productForm.services.map((service, idx) => (
                  <div
                    key={service.id || idx}
                    className={cx(
                      'rounded-xl border p-3 transition-all duration-200',
                      service.enabled ? 'border-blue-200 bg-blue-50/30 shadow-2xs' : 'border-slate-200 bg-slate-50/60 opacity-80'
                    )}
                  >
                    <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_6rem]">
                      <div>
                        <Label htmlFor={`service-name-${idx}`} className="text-[11px] font-medium text-slate-700">
                          Service Name
                        </Label>
                        <Input
                          id={`service-name-${idx}`}
                          value={service.name}
                          onChange={(e) => {
                            const services = [...productForm.services];
                            services[idx] = { ...service, name: e.target.value };
                            setProductForm((prev) => ({ ...prev, services }));
                          }}
                          placeholder="e.g. Upload Your Photo"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`service-icon-${idx}`} className="text-[11px] font-medium text-slate-700">
                          Icon
                        </Label>
                        <select
                          id={`service-icon-${idx}`}
                          value={service.icon || 'shield'}
                          onChange={(e) => {
                            const services = [...productForm.services];
                            services[idx] = { ...service, icon: e.target.value };
                            setProductForm((prev) => ({ ...prev, services }));
                          }}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden cursor-pointer"
                        >
                          {TRUST_BADGE_ICON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.emoji} {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor={`service-price-${idx}`} className="text-[11px] font-medium text-slate-700">
                          Tag
                        </Label>
                        <Input
                          id={`service-price-${idx}`}
                          value={service.price || ''}
                          onChange={(e) => {
                            const services = [...productForm.services];
                            services[idx] = { ...service, price: e.target.value };
                            setProductForm((prev) => ({ ...prev, services }));
                          }}
                          placeholder="Free / ₹49"
                          className="h-9 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-slate-200/60 pt-2.5">
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 gap-2">
                        <input
                          type="checkbox"
                          checked={service.enabled}
                          onChange={(e) => {
                            const services = [...productForm.services];
                            services[idx] = { ...service, enabled: e.target.checked };
                            setProductForm((prev) => ({ ...prev, services }));
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="text-xs font-medium text-slate-600 select-none">
                          {service.enabled ? 'Showing on UI' : 'Hidden'}
                        </span>
                      </label>
                      <IconButton
                        label="Remove service"
                        tone="danger"
                        onClick={() => {
                          const services = productForm.services.filter((_, i) => i !== idx);
                          setProductForm((prev) => ({ ...prev, services }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setProductForm((prev) => ({
                    ...prev,
                    services: [...prev.services, { id: `s_${Date.now()}`, name: '', icon: 'gift', price: '', enabled: true }]
                  }));
                }}
                icon={<Plus className="h-4 w-4" />}
              >
                Add Service
              </Button>
            </div>
          </FormAccordionSection>

          {/* Section 4: Coupons & Product Discounts */}
          <FormAccordionSection
            id="section-coupons"
            icon={<Tag className="h-4 w-4" />}
            title="4. Coupons & Discount Rules"
            subtitle="Promo code, minimum order requirement & maximum discount cap"
            badge={productForm.coupon_code ? `Code: ${productForm.coupon_code}` : 'No Promo'}
            isOpen={Boolean(openSections.coupons)}
            onToggle={() => toggleSection('coupons')}
          >
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                <span className="font-semibold">Product-specific coupon rules:</span> You can specify a promo code that applies to this product. For site-wide coupons, navigate to <span className="font-semibold text-blue-700">Coupons</span> in the admin sidebar.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="product-coupon-code">Applicable Coupon Code</Label>
                <Input
                  id="product-coupon-code"
                  value={productForm.coupon_code}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      coupon_code: e.target.value.toUpperCase().replace(/\s+/g, '')
                    }))
                  }
                  placeholder="e.g. WELCOME10, FESTIVE50"
                  className="font-mono uppercase font-bold tracking-wider"
                />
                <p className="mt-1 text-[11px] text-slate-400">Coupon code buyers can enter during checkout.</p>
              </div>

              <div>
                <Label htmlFor="product-min-order">Minimum Order Amount (₹)</Label>
                <Input
                  id="product-min-order"
                  type="number"
                  min={0}
                  value={productForm.min_order_amount}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      min_order_amount: e.target.value === '' ? '' : Number(e.target.value)
                    }))
                  }
                  placeholder="e.g. 499"
                  className="tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-400">Cart value required before this discount applies.</p>
              </div>

              <div>
                <Label htmlFor="product-max-discount">Maximum Discount Cap (₹)</Label>
                <Input
                  id="product-max-discount"
                  type="number"
                  min={0}
                  value={productForm.max_discount}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      max_discount: e.target.value === '' ? '' : Number(e.target.value)
                    }))
                  }
                  placeholder="e.g. 250"
                  className="tabular-nums"
                />
                <p className="mt-1 text-[11px] text-slate-400">Max savings limit allowed with this promo code.</p>
              </div>
            </div>

            {productForm.coupon_code ? (
              <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-blue-700 tracking-wider">
                        {productForm.coupon_code}
                      </span>
                      <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Storefront Preview
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {productForm.min_order_amount !== '' && Number(productForm.min_order_amount) > 0
                        ? `Min order ₹${productForm.min_order_amount}`
                        : 'No minimum order required'}
                      {productForm.max_discount !== '' && Number(productForm.max_discount) > 0
                        ? ` • Up to ₹${productForm.max_discount} max discount`
                        : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-100/70 border border-blue-200 px-3 py-1 rounded-lg self-start sm:self-auto">
                  🏷️ Promo badge will display on product card
                </span>
              </div>
            ) : null}
          </FormAccordionSection>

          {/* Section 4.5: Variants / Size Selector */}
          <FormAccordionSection
            id="section-variants"
            icon={<Package className="h-4 w-4" />}
            title="Variants (Sizes / Colors)"
            subtitle="Add size or color options with specific pricing"
            badge={`${productForm.variants.length} variant${productForm.variants.length === 1 ? '' : 's'}`}
            isOpen={Boolean(openSections.variants)}
            onToggle={() => toggleSection('variants')}
          >
            <div className="space-y-4">
              {productForm.variants.length > 0 && (
                <div>
                  <Label className="text-[10px]">Variant Heading (shown on product page)</Label>
                  <Input
                    value={productForm.variants[0]?.label || ''}
                    onChange={(e) => {
                      const label = e.target.value;
                      setProductForm(prev => ({
                        ...prev,
                        variants: prev.variants.map(v => ({ ...v, label }))
                      }));
                    }}
                    placeholder="Select Variant (e.g. Select Size, Choose Color)"
                  />
                </div>
              )}

              {productForm.variants.length > 0 ? (
                <div className="space-y-3">
                  {productForm.variants.map((variant, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50">
                      <div className="flex-1 w-full">
                        <Label className="text-[10px]">Variant Name (e.g. 500ml)</Label>
                        <Input
                          value={variant.name}
                          onChange={(e) => {
                            const newVariants = [...productForm.variants];
                            newVariants[index].name = e.target.value;
                            setProductForm(prev => ({ ...prev, variants: newVariants }));
                          }}
                          placeholder="Variant Name"
                        />
                      </div>
                      <div className="w-full sm:w-28 shrink-0">
                        <Label className="text-[10px]">Price (₹)</Label>
                        <Input
                          type="number"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...productForm.variants];
                            newVariants[index].price = Number(e.target.value);
                            setProductForm(prev => ({ ...prev, variants: newVariants }));
                          }}
                        />
                      </div>
                      <div className="w-full sm:w-28 shrink-0">
                        <Label className="text-[10px]">MRP (₹)</Label>
                        <Input
                          type="number"
                          value={variant.mrp || ''}
                          onChange={(e) => {
                            const newVariants = [...productForm.variants];
                            newVariants[index].mrp = e.target.value === '' ? undefined : Number(e.target.value);
                            setProductForm(prev => ({ ...prev, variants: newVariants }));
                          }}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="flex-none shrink-0 flex flex-wrap items-center gap-3">
                        {((variant.images && variant.images.length > 0) ? variant.images : (variant.image ? [variant.image] : [])).map((imgUrl, imgIndex) => (
                          <div key={imgIndex} className="relative group rounded-md border border-slate-200 overflow-hidden h-10 w-10">
                            <img src={imgUrl} alt={`${variant.name} ${imgIndex}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const newVariants = [...productForm.variants];
                                const currentVariant = newVariants[index];
                                const updatedImages = (currentVariant.images || [currentVariant.image!]).filter((_, i) => i !== imgIndex);
                                newVariants[index] = {
                                  ...currentVariant,
                                  images: updatedImages.length > 0 ? updatedImages : undefined,
                                  image: updatedImages.length > 0 ? updatedImages[0] : undefined
                                };
                                setProductForm(prev => ({ ...prev, variants: newVariants }));
                              }}
                              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove image"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        
                        <label className="h-10 w-10 shrink-0 border border-dashed border-slate-300 rounded-md bg-white flex items-center justify-center hover:bg-slate-50 cursor-pointer transition-colors relative" title="Upload variant image">
                          {isUploadingVariantImage === index ? (
                            <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-brand animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 text-slate-400" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleVariantImageUpload(index, e)}
                            disabled={isUploadingVariantImage === index}
                          />
                        </label>
                      </div>
                      <div className="sm:self-end sm:mt-0 mt-2 w-full sm:w-auto">
                        <IconButton
                          label="Remove variant"
                          tone="danger"
                          onClick={() => {
                            const newVariants = productForm.variants.filter((_, i) => i !== index);
                            setProductForm(prev => ({ ...prev, variants: newVariants }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No variants added. The product will only use the base price.</p>
              )}
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setProductForm(prev => ({
                    ...prev,
                    variants: [...prev.variants, { id: `v_${Date.now()}`, name: '', label: prev.variants[0]?.label, price: prev.price, mrp: Number(prev.mrp) || undefined }]
                  }));
                }}
                icon={<Plus className="h-4 w-4" />}
              >
                Add Variant Option
              </Button>
            </div>
          </FormAccordionSection>

          {/* Section 5: Photos & Gallery */}
          <FormAccordionSection
            id="section-photos"
            icon={<Upload className="h-4 w-4" />}
            title="5. Product Photos & Media"
            subtitle="Upload to Cloudinary, reorder cover image & add gallery links"
            badge={`${productForm.images.length} photo${productForm.images.length === 1 ? '' : 's'}`}
            isOpen={Boolean(openSections.photos)}
            onToggle={() => toggleSection('photos')}
          >
            <div className="space-y-3">
              {/* Screen Fit Image Dimensions Guide Card */}
              <div className="rounded-xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-lg bg-blue-600 text-white shadow-2xs">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        Image Size & Fit Guide (Screen Fit)
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          No Top Cut · Best Quality
                        </span>
                      </h5>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowImageSizeGuide((prev) => !prev)}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    {showImageSizeGuide ? 'Hide sizes' : 'Show sizes'}
                  </button>
                </div>

                {showImageSizeGuide && (
                  <div className="mt-2.5 space-y-1.5 pt-2 border-t border-blue-100/80 text-[11px]">
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      <div className="flex flex-col bg-white border border-blue-100/90 rounded-lg p-2 shadow-2xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          👕 Apparel & Models
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-blue-700 font-mono font-semibold">3:4</span>
                          <span className="text-slate-500 font-mono text-[10px]">(1200 × 1600 px)</span>
                        </div>
                        <span className="text-slate-400 text-[10px] mt-0.5">T-shirts, hoodies, model photography</span>
                      </div>

                      <div className="flex flex-col bg-white border border-blue-100/90 rounded-lg p-2 shadow-2xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          📱 Mobile Storefront
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-blue-700 font-mono font-semibold">4:5</span>
                          <span className="text-slate-500 font-mono text-[10px]">(1080 × 1350 px)</span>
                        </div>
                        <span className="text-slate-400 text-[10px] mt-0.5">Instagram standard portrait ratio</span>
                      </div>

                      <div className="flex flex-col bg-white border border-blue-100/90 rounded-lg p-2 shadow-2xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          🎁 Hampers & Gifts
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-blue-700 font-mono font-semibold">1:1</span>
                          <span className="text-slate-500 font-mono text-[10px]">(1200 × 1200 px)</span>
                        </div>
                        <span className="text-slate-400 text-[10px] mt-0.5">Mugs, watches, gift hampers, boxes</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed">
                      <span className="font-bold shrink-0 text-amber-600">⚠️ Cut Warning:</span>
                      <span>Subject ke sir/head aur top border ke beech thoda safe margin rakhein taaki mobile swipe gallery me top cut na ho. Format: JPG/WebP/PNG (under 5MB).</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Photos Gallery</span>
                {isUploadingImage && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading to Cloudinary…
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {productForm.images.map((src, index) => (
                  <div key={`${src}-${index}`} className="group relative aspect-square">
                    <img
                      src={src}
                      alt={`Photo ${index + 1}`}
                      className={cx(
                        'absolute inset-0 h-full w-full rounded-xl border bg-slate-100 object-cover',
                        index === 0 ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                      )}
                    />
                    {index === 0 ? (
                      <span className="absolute bottom-1 left-1 rounded-md bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMakeCoverImage(index)}
                        className="absolute inset-x-1 bottom-1 rounded-md bg-slate-900/75 py-0.5 text-[9px] font-semibold text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                      >
                        Set cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm transition-colors hover:bg-rose-600 cursor-pointer"
                    >
                      <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}

                <label
                  className={cx(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-slate-400 transition-colors',
                    isUploadingImage
                      ? 'cursor-not-allowed border-blue-200 bg-blue-50'
                      : 'cursor-pointer border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600'
                  )}
                >
                  {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="text-[10px] font-semibold">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingImage}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="mt-2 flex gap-2">
                <Input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                  placeholder="…or paste an image URL"
                  aria-label="Image URL"
                />
                <Button onClick={handleAddImageUrl} className="shrink-0">
                  Add
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                The cover photo is shown in the catalog. Shoppers can swipe through every photo on the product page.
              </p>
            </div>
          </div>
        </FormAccordionSection>

          {/* Section 6: Badges & Visibility */}
          <FormAccordionSection
            id="section-badges"
            icon={<Sparkles className="h-4 w-4" />}
            title="6. Badges & Visibility"
            subtitle="Storefront promotional badges & live published status"
            badge={
              productForm.badges.length > 0
                ? `${productForm.badges.length} Badges • ${productForm.is_active ? 'Live' : 'Hidden'}`
                : productForm.is_active
                ? 'Live'
                : 'Hidden'
            }
            isOpen={Boolean(openSections.badges)}
            onToggle={() => toggleSection('badges')}
          >
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-slate-700">
                  Storefront Badges (Multi-select)
                </legend>
                <div className="flex flex-wrap gap-2">
                  {BADGE_DEFINITIONS.map((badgeDef) => {
                    const active = productForm.badges.includes(badgeDef.key);
                    return (
                      <button
                        key={badgeDef.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleBadge(badgeDef.key)}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none',
                          active
                            ? badgeDef.activeClass
                            : badgeDef.idleClass
                        )}
                      >
                        <span>{badgeDef.emoji}</span>
                        <span>{badgeDef.label}</span>
                        {active && <span className="ml-1 text-[10px] opacity-80">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Card par max 2 badge dikhenge (priority ke mutabiq). Product detail page par saare active badges dikhenge.
                </p>
              </fieldset>

              {/* Trust & Assurance Badges (4 Cards - Flipkart Style with 4 Toggle Buttons) */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Trust & Assurance Cards (4 Options on Product Detail Page)
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Flipkart reference card style: 4 badges below Buy button. Customize labels and toggle whether each card shows on screen.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                    {(productForm.trust_badges || DEFAULT_TRUST_BADGES).filter((b) => b.enabled).length} of 4 Showing
                  </span>
                </div>

                {/* Live Preview Card */}
                <div className="rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                      📱 Storefront Live Preview:
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Shows under Buy Now button on Product Page
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                    {(productForm.trust_badges || DEFAULT_TRUST_BADGES).map((b, idx) => {
                      return (
                        <div
                          key={b.id || idx}
                          className={cx(
                            'flex flex-col items-center text-center gap-1.5 transition-all',
                            b.enabled ? 'opacity-100' : 'opacity-35'
                          )}
                        >
                          <div className="grid h-11 w-11 place-items-center rounded-full bg-sky-50 text-blue-600 border border-sky-100 shadow-2xs">
                            <TrustBadgeIcon icon={b.icon} className="h-5 w-5" />
                          </div>
                          <span className="w-full max-w-24 text-[11px] font-semibold text-slate-800 leading-tight line-clamp-2 wrap-break-word">
                            {b.name || 'Badge'}
                          </span>
                          {!b.enabled && (
                            <span className="text-[9px] text-rose-500 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                              Hidden
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4 Editable Cards with 4 Toggle Buttons */}
                <div className="space-y-3 pt-1">
                  {(productForm.trust_badges || DEFAULT_TRUST_BADGES).map((badge, idx) => (
                    <div
                      key={badge.id || idx}
                      className={cx(
                        'rounded-xl border p-3.5 transition-all duration-200',
                        badge.enabled
                          ? 'border-blue-200 bg-blue-50/30 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/60 opacity-80'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            Badge {idx + 1}: {badge.name}
                          </span>
                          {badge.enabled ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full">
                              ✓ Showing on UI
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              Hidden from UI
                            </span>
                          )}
                        </div>

                        {/* Toggle button */}
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 gap-2">
                          <span className="text-xs font-medium text-slate-600 select-none">
                            {badge.enabled ? 'Showing on UI' : 'Hidden'}
                          </span>
                          <input
                            type="checkbox"
                            checked={badge.enabled}
                            onChange={(e) => {
                              const newBadges = [...(productForm.trust_badges || DEFAULT_TRUST_BADGES)];
                              newBadges[idx] = { ...badge, enabled: e.target.checked };
                              setProductForm((prev) => ({ ...prev, trust_badges: newBadges }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`trust-badge-name-${idx}`} className="text-[11px] font-medium text-slate-700">
                            Card Label / Text
                          </Label>
                          <Input
                            id={`trust-badge-name-${idx}`}
                            value={badge.name}
                            onChange={(e) => {
                              const newBadges = [...(productForm.trust_badges || DEFAULT_TRUST_BADGES)];
                              newBadges[idx] = { ...badge, name: e.target.value };
                              setProductForm((prev) => ({ ...prev, trust_badges: newBadges }));
                            }}
                            placeholder={idx === 0 ? 'Cancellation upto 2 hrs' : idx === 1 ? '7-Day Return' : idx === 2 ? 'Cash on Delivery' : 'Nyochavar Assured'}
                            className="h-9 text-xs font-medium"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`trust-badge-icon-${idx}`} className="text-[11px] font-medium text-slate-700">
                            Icon Style
                          </Label>
                          <select
                            id={`trust-badge-icon-${idx}`}
                            value={badge.icon || 'shield'}
                            onChange={(e) => {
                              const newBadges = [...(productForm.trust_badges || DEFAULT_TRUST_BADGES)];
                              newBadges[idx] = { ...badge, icon: e.target.value };
                              setProductForm((prev) => ({ ...prev, trust_badges: newBadges }));
                            }}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-hidden cursor-pointer"
                          >
                            {TRUST_BADGE_ICON_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.emoji} {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FormAccordionSection>

          {/* Section 7: UI Custom (storefront labels the admin can rename) */}
          <FormAccordionSection
            id="section-uicustom"
            icon={<Pencil className="h-4 w-4" />}
            title="7. UI Custom"
            subtitle="Rename the labels shoppers see on this product page"
            badge={Object.values(productForm.ui_labels).some((v) => typeof v === 'string' && v.trim()) ? 'Customised' : 'Default'}
            isOpen={Boolean(openSections.uicustom)}
            onToggle={() => toggleSection('uicustom')}
          >
            <div className="space-y-4">
              <div>
                <h5 className="text-xs font-bold text-slate-900">Stock Status Label</h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The green card above the delivery options. Leave a field empty to use the default text.
                </p>
              </div>

              {([
                { key: 'in_stock', label: 'In stock text' },
                { key: 'low_stock', label: 'Low stock text (use {stock} for units left, shows when fewer than 10 are left)' },
                { key: 'sold_out', label: 'Sold out text' }
              ] as const).map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`ui-label-${field.key}`} className="text-[11px] font-medium text-slate-700">
                    {field.label}
                  </Label>
                  <Input
                    id={`ui-label-${field.key}`}
                    value={productForm.ui_labels[field.key] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProductForm((prev) => ({ ...prev, ui_labels: { ...prev.ui_labels, [field.key]: value } }));
                    }}
                    placeholder={DEFAULT_UI_LABELS[field.key]}
                    maxLength={80}
                    className="h-9 text-xs"
                  />
                </div>
              ))}

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Storefront Preview</span>
                <div className="mt-1 inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {productForm.ui_labels.in_stock?.trim() || DEFAULT_UI_LABELS.in_stock}
                </div>
              </div>
            </div>
          </FormAccordionSection>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this product?"
        message={
          <>
            <span className="font-semibold text-slate-900">“{pendingDelete?.name}”</span> will be removed from the
            catalog. This can't be undone.
          </>
        }
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selection.selected.size} ${selection.selected.size === 1 ? 'product' : 'products'}?`}
        message="The selected products will be removed from the catalog. This can't be undone."
        confirmLabel="Delete selected"
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <Modal
        open={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        size="md"
        title={`Add Review to ${reviewingProduct?.name}`}
        subtitle="This review will instantly appear on the product page."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveReview}
              disabled={isSavingReview}
              icon={isSavingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              Add Review
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Rating (1 to 5)</Label>
            <Input 
              type="number" 
              min="1" 
              max="5" 
              value={reviewForm.rating} 
              onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} 
            />
          </div>
          <div>
            <Label>Comment (max 20 words recommended)</Label>
            <Textarea 
              rows={3} 
              placeholder="Beautiful quality, elegant packaging..." 
              value={reviewForm.comment} 
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} 
            />
          </div>
          <div>
            <Label>Buyer ID (optional for Verified Buyer tag)</Label>
            <Input 
              type="text" 
              placeholder="Leave blank for Guest" 
              value={reviewForm.buyer_id} 
              onChange={(e) => setReviewForm({ ...reviewForm, buyer_id: e.target.value })} 
            />
          </div>
        </div>
      </Modal>

      <BulkActionBar
        count={selection.selected.size}
        busy={bulkDeleting}
        onClear={selection.clear}
        onDelete={() => setConfirmBulkDelete(true)}
      />
    </div>
  );
};

export default AdminProductsPage;
