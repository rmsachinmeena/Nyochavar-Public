import React, { useEffect, useState, useMemo } from 'react';
import {
  LayoutGrid,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  ImageIcon,
  List,
  Search,
  Eye,
  EyeOff,
  PackageOpen,
  Link2,
  Sparkles
} from 'lucide-react';
import { CategoryItem, Product } from '../../../types/product';
import { productService } from '../../../services/productService';
import { exploreSettingsService, ExploreSettings } from '../../../services/exploreSettingsService';
import { api } from '../../../services/api';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
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
  StatCard,
  Switch,
  SwitchField,
  Toast,
  cx,
  useRowSelection
} from '../../components/ui';
import type { DataColumn } from '../../components/ui';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=300';
// Divides evenly into the 2 / 3 / 4-column grid
const PAGE_SIZE = 12;
const VIEW_STORAGE_KEY = 'petal_pen_admin_categories_view';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'live' | 'hidden';

const readStoredView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type CategoryForm = {
  name: string;
  slug: string;
  occasion_type: string;
  image_url: string;
  is_active: boolean;
};

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [exploreSettings, setExploreSettings] = useState<ExploreSettings>(exploreSettingsService.getSettings());

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<CategoryForm>({
    name: '',
    slug: '',
    occasion_type: '',
    image_url: '',
    is_active: true
  });
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [pendingDelete, setPendingDelete] = useState<CategoryItem | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

    const unsubCats = productService.subscribeToCategories((cats) => setCategories(cats));
    const unsubProds = productService.subscribeToProducts((prods) => setProducts(prods));

    return () => {
      unsubCats();
      unsubProds();
    };
  }, []);

  useEffect(() => {
    const unsub = exploreSettingsService.subscribe(setExploreSettings);
    return () => unsub();
  }, []);

  const handleToggleCollection = (key: 'trending' | 'new' | 'budget') => {
    const current = exploreSettings.collections[key].enabled;
    const updated = exploreSettingsService.updateSettings({
      collections: {
        ...exploreSettings.collections,
        [key]: { ...exploreSettings.collections[key], enabled: !current },
      },
    });
    setExploreSettings(updated);
    showToast(`${exploreSettings.collections[key].label} collection ${!current ? 'enabled' : 'disabled'} on Explore`);
  };

  const handleUpdateBudgetPrice = (price: number) => {
    const updated = exploreSettingsService.updateSettings({ budgetMaxPrice: price });
    setExploreSettings(updated);
    showToast(`Budget limit updated to ₹${price}`);
  };

  const productCountFor = (category: CategoryItem) =>
    products.filter((p) => p.category.toLowerCase() === category.name.toLowerCase()).length;

  const handleOpenCreate = () => {
    setEditingCategoryId(null);
    setFormError(null);
    setFormData({
      name: '',
      slug: '',
      occasion_type: '',
      image_url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=800',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategoryId(cat.id);
    setFormError(null);
    setFormData({
      name: cat.name,
      slug: cat.slug || toSlug(cat.name),
      occasion_type: cat.occasion_type || '',
      image_url: cat.image_url || '',
      is_active: cat.is_active !== false
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Please enter a category name.');
      return;
    }
    setFormError(null);
    setIsSaving(true);

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug || toSlug(formData.name),
      occasion_type: formData.occasion_type,
      image_url: formData.image_url,
      is_active: formData.is_active
    };

    try {
      if (editingCategoryId) {
        await productService.updateCategory(editingCategoryId, payload);
        showToast('Category updated');
      } else {
        await productService.createCategory(payload);
        showToast('Category created');
      }
      setIsModalOpen(false);
      loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    await productService.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    showToast(`“${name}” deleted`);
  };

  const confirmDeleteSelected = async () => {
    const ids = [...selection.selected];
    setConfirmBulkDelete(false);
    setBulkDeleting(true);
    try {
      const deleted = await productService.deleteCategories(ids);
      const removed = new Set(ids);
      setCategories((prev) => prev.filter((c) => !removed.has(c.id)));
      selection.clear();
      showToast(`${deleted} ${deleted === 1 ? 'category' : 'categories'} deleted`);
    } catch (err: any) {
      showToast(err.message || 'Could not delete the selected categories', 'danger');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingImage(true);
    try {
      const res = await api.uploadImage(file, formData.name || 'category');
      if (res.secure_url) {
        setFormData((prev) => ({ ...prev, image_url: res.secure_url }));
        showToast('Image uploaded');
      }
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      showToast('Image upload failed: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* view preference is a convenience only */
    }
  };

  const handleToggleLive = async (cat: CategoryItem, live: boolean) => {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: live } : c)));
    await productService.updateCategory(cat.id, { is_active: live });
    showToast(live ? `“${cat.name}” is live on the storefront` : `“${cat.name}” hidden from the storefront`);
  };

  const stats = useMemo(() => {
    const live = categories.filter((c) => c.is_active !== false).length;
    const empty = categories.filter(
      (c) => !products.some((p) => p.category.toLowerCase() === c.name.toLowerCase())
    ).length;
    return { total: categories.length, live, hidden: categories.length - live, empty };
  }, [categories, products]);

  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return categories.filter((c) => {
      const live = c.is_active !== false;
      if (statusFilter === 'live' && !live) return false;
      if (statusFilter === 'hidden' && live) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q) ||
        (c.occasion_type || '').toLowerCase().includes(q)
      );
    });
  }, [categories, statusFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const displayedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [filteredCategories, currentPage]);

  // Multi-select works on the categories currently shown (this page, this filter)
  const selection = useRowSelection(displayedCategories.map((c) => c.id));
  const allShownSelected = displayedCategories.length > 0 && displayedCategories.every((c) => selection.selected.has(c.id));
  const toggleCategorySelected = (id: string, checked: boolean) =>
    selection.setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const pendingDeleteCount = pendingDelete ? productCountFor(pendingDelete) : 0;
  const selectedProductCount = categories
    .filter((c) => selection.selected.has(c.id))
    .reduce((sum, c) => sum + productCountFor(c), 0);

  const columns: DataColumn<CategoryItem>[] = [
    {
      key: 'category',
      header: 'Category',
      mobile: 'title',
      cell: (cat) => (
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={cat.image_url || FALLBACK_IMAGE}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
            className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{cat.name}</p>
            <p className={cx('mt-0.5 truncate text-xs font-normal', cat.occasion_type ? 'text-slate-500' : 'text-slate-400')}>
              {cat.occasion_type || 'No subtitle yet'}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'count-mobile',
      header: 'Products',
      mobile: 'aside',
      only: 'card',
      cell: (cat) => {
        const count = productCountFor(cat);
        return (
          <span className="text-xs font-medium text-slate-500">
            <span className="text-[15px] font-bold tabular-nums text-slate-900">{count}</span>{' '}
            {count === 1 ? 'product' : 'products'}
          </span>
        );
      }
    },
    {
      key: 'slug',
      header: 'URL slug',
      cell: (cat) => (
        <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
          /{cat.slug || toSlug(cat.name)}
        </code>
      )
    },
    {
      key: 'count',
      header: 'Products',
      align: 'center',
      only: 'table',
      cell: (cat) => <span className="font-semibold tabular-nums text-slate-900">{productCountFor(cat)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      mobile: 'footer',
      mobileClassName: 'flex-1',
      cell: (cat) => {
        const live = cat.is_active !== false;
        return (
          <Badge tone={live ? 'success' : 'neutral'}>
            <span className={cx('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-slate-400')} />
            {live ? 'Live' : 'Hidden'}
          </Badge>
        );
      }
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobile: 'footer',
      cell: (cat) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={`Edit ${cat.name}`} onClick={() => handleOpenEdit(cat)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Delete ${cat.name}`} tone="danger" onClick={() => setPendingDelete(cat)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <Toast message={toastMessage} tone={toastTone} />

      <PageHeader
        icon={<LayoutGrid className="h-5 w-5" />}
        title="Categories"
        description="Group products for the catalog and storefront filters."
        actions={
          <>
            <IconButton label="Refresh categories" onClick={loadData} className="border-slate-200 bg-white">
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
              Add category
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Categories" value={stats.total} icon={<LayoutGrid className="h-3.5 w-3.5" />} hint="In your catalog" />
        <StatCard label="Live" value={stats.live} tone="success" icon={<Eye className="h-3.5 w-3.5" />} hint="Shown on storefront" />
        <StatCard label="Hidden" value={stats.hidden} tone="neutral" icon={<EyeOff className="h-3.5 w-3.5" />} hint="Not visible to buyers" />
        <StatCard label="Empty" value={stats.empty} tone="warning" icon={<PackageOpen className="h-3.5 w-3.5" />} hint="No products yet" />
      </div>

      {/* Explore Curated Collections Settings Card */}
      <Card className="p-4 sm:p-5 border-blue-200/80 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Explore Curated Collections</h3>
              <Badge tone="blue" className="text-[10px]">Storefront Controls</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Control the smart category tabs shown in the top category bar of the Explore &amp; Catalog page.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Budget Cap:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                min={1}
                value={exploreSettings.budgetMaxPrice}
                onChange={(e) => handleUpdateBudgetPrice(Math.max(1, Number(e.target.value) || 0))}
                className="w-20 h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
          {/* 1. Trending */}
          <div className={cx(
            "rounded-xl border p-3 transition-all",
            exploreSettings.collections.trending.enabled
              ? "border-blue-200 bg-white shadow-xs"
              : "border-slate-200 bg-slate-50/70 opacity-60"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>🔥</span> Trending
              </span>
              <Switch
                checked={exploreSettings.collections.trending.enabled}
                onChange={() => handleToggleCollection('trending')}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Filters products marked with 🔥 Trending badge.
            </p>
          </div>

          {/* 2. New Arrivals */}
          <div className={cx(
            "rounded-xl border p-3 transition-all",
            exploreSettings.collections.new.enabled
              ? "border-blue-200 bg-white shadow-xs"
              : "border-slate-200 bg-slate-50/70 opacity-60"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>✨</span> New Arrivals
              </span>
              <Switch
                checked={exploreSettings.collections.new.enabled}
                onChange={() => handleToggleCollection('new')}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Filters products marked as ✨ New Arrival.
            </p>
          </div>

          {/* 3. Budget Friendly */}
          <div className={cx(
            "rounded-xl border p-3 transition-all",
            exploreSettings.collections.budget.enabled
              ? "border-blue-200 bg-white shadow-xs"
              : "border-slate-200 bg-slate-50/70 opacity-60"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>🏷️</span> Budget Friendly
              </span>
              <Switch
                checked={exploreSettings.collections.budget.enabled}
                onChange={() => handleToggleCollection('budget')}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Filters gifts ≤ ₹{exploreSettings.budgetMaxPrice} or marked budget-friendly.
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {/* Toolbar: search, status filter and grid / list switch */}
        <div className="space-y-3 border-b border-slate-100 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <SearchInput
              className="min-w-0 flex-1"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search name, slug or subtitle..."
              icon={<Search className="h-4 w-4" />}
            />
            <div role="group" aria-label="View" className="flex shrink-0 rounded-xl bg-slate-100 p-1">
              {(
                [
                  { mode: 'grid', label: 'Grid view', icon: <LayoutGrid className="h-4 w-4" /> },
                  { mode: 'list', label: 'List view', icon: <List className="h-4 w-4" /> }
                ] as const
              ).map((v) => (
                <button
                  key={v.mode}
                  type="button"
                  onClick={() => changeView(v.mode)}
                  aria-label={v.label}
                  aria-pressed={viewMode === v.mode}
                  className={cx(
                    'grid h-8 w-8 place-items-center rounded-lg transition-colors sm:h-7 sm:w-7',
                    viewMode === v.mode ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {v.icon}
                </button>
              ))}
            </div>
          </div>
          <FilterTabs
            value={statusFilter}
            onChange={(id) => setStatusFilter(id as StatusFilter)}
            items={[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'live', label: 'Live', count: stats.live },
              { id: 'hidden', label: 'Hidden', count: stats.hidden }
            ]}
          />
        </div>

        {loading && categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Loading categories…</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          categories.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="h-6 w-6" />}
              title="No categories yet"
              description="Categories group your products in the catalog and in storefront filters."
              action={
                <Button variant="primary" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
                  Add category
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No matching categories"
              description="Try a different search or status filter."
              action={
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : viewMode === 'grid' ? (
          <>
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-5">
            <Checkbox
              checked={allShownSelected}
              indeterminate={selection.selected.size > 0}
              onChange={(checked) => selection.setSelected(checked ? new Set(displayedCategories.map((c) => c.id)) : new Set())}
              label={allShownSelected ? 'Clear selection' : 'Select all'}
            />
            <span className="text-xs font-medium text-slate-500">
              {selection.selected.size > 0
                ? `${selection.selected.size} of ${displayedCategories.length} selected`
                : `Select all (${displayedCategories.length})`}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 xl:grid-cols-4">
            {displayedCategories.map((cat) => {
              const live = cat.is_active !== false;
              const count = productCountFor(cat);
              const selected = selection.selected.has(cat.id);
              return (
                <li
                  key={cat.id}
                  className={cx(
                    'group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md hover:shadow-slate-900/5',
                    selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200'
                  )}
                >
                  {/* Cover */}
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                    <img
                      src={cat.image_url || FALLBACK_IMAGE}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                      className={cx(
                        'h-full w-full object-cover transition-transform duration-500 group-hover:scale-105',
                        !live && 'grayscale opacity-60'
                      )}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-900/75 via-slate-900/10 to-transparent" />
                    <span
                      className={cx(
                        'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm',
                        live ? 'bg-white/90 text-emerald-700' : 'bg-slate-900/60 text-white'
                      )}
                    >
                      <span className={cx('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-500' : 'bg-slate-300')} />
                      {live ? 'Live' : 'Hidden'}
                    </span>
                    <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-white/90 shadow-sm backdrop-blur-sm">
                      <Checkbox
                        checked={selected}
                        onChange={(checked) => toggleCategorySelected(cat.id, checked)}
                        label={`Select ${cat.name}`}
                      />
                    </span>
                    <div className="absolute inset-x-2.5 bottom-2 text-white">
                      <p className="truncate text-[13px] font-semibold leading-tight sm:text-sm">{cat.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-white/80">
                        <span className="font-bold tabular-nums text-white">{count}</span> {count === 1 ? 'product' : 'products'}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
                    <p className={cx('truncate text-[11px]', cat.occasion_type ? 'text-slate-600' : 'italic text-slate-400')}>
                      {cat.occasion_type || 'No subtitle yet'}
                    </p>
                    <p className="flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                      <Link2 className="h-3 w-3 shrink-0" />
                      <code className="truncate font-mono text-slate-500">/{cat.slug || toSlug(cat.name)}</code>
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
                      <Switch
                        checked={live}
                        onChange={(checked) => handleToggleLive(cat, checked)}
                        label={`Show ${cat.name} on storefront`}
                      />
                      <div className="flex items-center">
                        <IconButton label={`Edit ${cat.name}`} onClick={() => handleOpenEdit(cat)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label={`Delete ${cat.name}`} tone="danger" onClick={() => setPendingDelete(cat)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}

            {/* Add tile closes the grid */}
            <li className="min-w-0">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-600"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold">New category</span>
              </button>
            </li>
          </ul>
          </>
        ) : (
          <DataTable
            columns={columns}
            rows={displayedCategories}
            rowKey={(c) => c.id}
            selectedKeys={selection.selected}
            onSelectionChange={selection.setSelected}
            selectLabel={(c) => c.name}
          />
        )}

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={filteredCategories.length}
          pageSize={PAGE_SIZE}
          onChange={setCurrentPage}
        />
      </Card>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategoryId ? 'Edit category' : 'Add a category'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="category-form"
              disabled={isSaving || isUploadingImage}
              icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {editingCategoryId ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex items-start gap-4">
            <label
              className={cx(
                'group relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
                isUploadingImage
                  ? 'cursor-not-allowed border-blue-200 bg-blue-50'
                  : 'cursor-pointer border-slate-200 hover:border-blue-400'
              )}
            >
              {formData.image_url ? (
                <img src={formData.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-slate-300" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/70 py-1 text-[10px] font-semibold text-white">
                {isUploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {isUploadingImage ? 'Uploading' : 'Change'}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingImage}
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name,
                      slug: !editingCategoryId ? toSlug(name) : prev.slug
                    }));
                  }}
                  placeholder="e.g. Flowers, Hampers…"
                />
              </div>
              <div>
                <Label htmlFor="category-slug">URL slug</Label>
                <Input
                  id="category-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="artisanal-chocolates"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="category-subtitle">Subtitle</Label>
            <Input
              id="category-subtitle"
              value={formData.occasion_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, occasion_type: e.target.value }))}
              placeholder="e.g. Hand-tied bouquets & fresh blooms"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">Shown under the category name on the storefront.</p>
          </div>

          <div>
            <Label htmlFor="category-image">Image URL</Label>
            <Input
              id="category-image"
              value={formData.image_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://res.cloudinary.com/…"
              className="text-xs"
            />
          </div>

          <SwitchField
            label="Published"
            description="Show this category on the storefront"
            checked={formData.is_active}
            onChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this category?"
        message={
          <>
            <span className="font-semibold text-slate-900">“{pendingDelete?.name}”</span> will be removed.
            {pendingDeleteCount > 0 && (
              <>
                {' '}
                {pendingDeleteCount} {pendingDeleteCount === 1 ? 'product is' : 'products are'} still filed under it
                and will need a new category.
              </>
            )}
          </>
        }
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selection.selected.size} ${selection.selected.size === 1 ? 'category' : 'categories'}?`}
        message={
          <>
            The selected categories will be removed. This can't be undone.
            {selectedProductCount > 0 && (
              <>
                {' '}
                {selectedProductCount} {selectedProductCount === 1 ? 'product is' : 'products are'} still filed under
                them and will need a new category.
              </>
            )}
          </>
        }
        confirmLabel="Delete selected"
        onConfirm={confirmDeleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <BulkActionBar
        count={selection.selected.size}
        busy={bulkDeleting}
        onClear={selection.clear}
        onDelete={() => setConfirmBulkDelete(true)}
      />
    </div>
  );
};

export default AdminCategoriesPage;
