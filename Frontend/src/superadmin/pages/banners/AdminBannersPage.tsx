import React, { useEffect, useState, useMemo } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  FolderPlus,
  Loader2,
  Layers,
  Monitor,
  Smartphone
} from 'lucide-react';
import { bannerService, ExtendedHeroBanner } from '../../../services/bannerService';
import { api } from '../../../services/api';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Switch,
  SwitchField,
  Toast,
  cx,
  useRowSelection
} from '../../components/ui';

export interface OccasionItem {
  id: string;
  name: string;
  emoji: string;
}

const OCCASIONS_STORAGE_KEY = 'petal_pen_hero_occasions';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=1200';
const EMOJI_CHOICES = ['💖', '🎂', '🎉', '💍', '✨', '🪔', '🎁', '🌸', '🎄', '🌟'];

const DEFAULT_OCCASIONS: OccasionItem[] = [
  { id: 'Valentines', name: "Valentine's", emoji: '💖' },
  { id: 'Birthday', name: 'Birthday', emoji: '🎂' },
  { id: 'New Year', name: 'New Year', emoji: '🎉' },
  { id: 'Anniversary', name: 'Anniversary', emoji: '💍' },
  { id: 'Casual', name: 'Casual & Trending', emoji: '✨' }
];

type PendingDelete = { kind: 'banner'; banner: ExtendedHeroBanner } | { kind: 'folder'; folder: OccasionItem };

type BannerImageKind = 'pc' | 'mobile';

const BANNER_IMAGE_FIELD = { pc: 'image_url', mobile: 'mobile_image_url' } as const;

const BANNER_IMAGE_SPEC: Record<BannerImageKind, { label: string; ratio: number; recommended: string }> = {
  pc: { label: 'PC banner', ratio: 12 / 5, recommended: '2400×1000 (12:5)' },
  mobile: { label: 'Phone banner', ratio: 1, recommended: '1080×1080 (1:1)' }
};

/** Natural size of a picked file, so the page can warn when it is far from the recommended shape. */
const readImageSize = (file: File): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });

export const AdminBannersPage: React.FC = () => {
  const [banners, setBanners] = useState<ExtendedHeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [occasions, setOccasions] = useState<OccasionItem[]>(() => {
    try {
      const stored = localStorage.getItem(OCCASIONS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load custom occasions:', e);
    }
    return DEFAULT_OCCASIONS;
  });

  const [isOccasionModalOpen, setIsOccasionModalOpen] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<OccasionItem | null>(null);
  const [occasionForm, setOccasionForm] = useState<{ name: string; emoji: string }>({ name: '', emoji: '🎁' });
  const [occasionError, setOccasionError] = useState<string | null>(null);

  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bannerFormData, setBannerFormData] = useState<Partial<ExtendedHeroBanner>>({
    title: '',
    subtitle: '',
    image_url: '',
    mobile_image_url: '',
    link_url: '/catalog',
    cta_text: 'Shop Collection',
    badge: 'CUSTOMIZED GIFTS',
    is_active: true,
    display_order: 1,
    occasion: 'Casual',
    show_overlay: false
  });
  const [isUploadingBanner, setIsUploadingBanner] = useState<boolean>(false);
  const [uploadingKind, setUploadingKind] = useState<BannerImageKind | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const showToast = (msg: string, tone: 'success' | 'danger' = 'success') => {
    setToastMessage(msg);
    setToastTone(tone);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveOccasions = (newOccasions: OccasionItem[]) => {
    setOccasions(newOccasions);
    try {
      localStorage.setItem(OCCASIONS_STORAGE_KEY, JSON.stringify(newOccasions));
    } catch (e) {
      console.warn('Failed to save occasions:', e);
    }
  };

  const loadBanners = async () => {
    setLoading(true);
    const data = await bannerService.getAllBanners();
    setBanners(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const activeBanners = useMemo(
    () => banners.filter((b) => b.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    [banners]
  );

  const filteredBanners = useMemo(() => {
    const list =
      selectedFolder === 'all'
        ? banners
        : banners.filter((b) => (b.occasion || 'Casual').toLowerCase() === selectedFolder.toLowerCase());
    return [...list].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [banners, selectedFolder]);

  // Multi-select works on the banners currently shown (this folder)
  const selection = useRowSelection(filteredBanners.map((b) => b.id));
  const allShownSelected = filteredBanners.length > 0 && filteredBanners.every((b) => selection.selected.has(b.id));
  const toggleBannerSelected = (id: string, checked: boolean) =>
    selection.setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  useEffect(() => {
    if (carouselIndex >= activeBanners.length) setCarouselIndex(0);
  }, [activeBanners.length, carouselIndex]);

  const folderFor = (banner: ExtendedHeroBanner) =>
    occasions.find((o) => o.id.toLowerCase() === (banner.occasion || 'Casual').toLowerCase());

  const stepCarousel = (delta: number) => {
    if (activeBanners.length === 0) return;
    setCarouselIndex((prev) => (prev + delta + activeBanners.length) % activeBanners.length);
  };

  const handleMoveOrder = async (bannerId: string, direction: 'up' | 'down') => {
    const currentList = [...filteredBanners];
    const index = currentList.findIndex((b) => b.id === bannerId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= currentList.length) return;

    [currentList[index], currentList[target]] = [currentList[target], currentList[index]];
    const updated = await bannerService.reorderBanners(currentList.map((b) => b.id));
    setBanners(updated);
    showToast('Banner order updated');
  };

  const handleToggleActive = async (id: string) => {
    const newStatus = await bannerService.toggleBannerStatus(id);
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: newStatus } : b)));
    showToast(newStatus ? 'Banner is live on the homepage' : 'Banner hidden from the homepage');
  };

  const handleOpenCreateBanner = () => {
    setEditingBannerId(null);
    setBannerError(null);
    setBannerFormData({
      title: '',
      subtitle: '',
      image_url: FALLBACK_IMAGE,
      mobile_image_url: '',
      link_url: '/catalog',
      cta_text: 'Shop Collection',
      badge: 'CUSTOMIZED GIFTS',
      is_active: true,
      display_order: banners.length + 1,
      occasion: selectedFolder !== 'all' ? selectedFolder : occasions[0]?.id || 'Casual',
      show_overlay: false
    });
    setIsBannerModalOpen(true);
  };

  const handleOpenEditBanner = (banner: ExtendedHeroBanner) => {
    setEditingBannerId(banner.id);
    setBannerError(null);
    setBannerFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url,
      mobile_image_url: banner.mobile_image_url || '',
      link_url: banner.link_url || '/catalog',
      cta_text: banner.cta_text || 'Shop Now',
      badge: banner.badge || 'CUSTOMIZED GIFTS',
      is_active: banner.is_active,
      display_order: banner.display_order || 1,
      occasion: banner.occasion || 'Casual',
      show_overlay: banner.show_overlay ?? false
    });
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerFormData.title?.trim()) {
      setBannerError('Please enter a banner title.');
      return;
    }
    if (!bannerFormData.image_url?.trim()) {
      setBannerError('Please upload or link a banner image.');
      return;
    }
    setBannerError(null);
    setIsSaving(true);

    try {
      if (editingBannerId) {
        const updated = await bannerService.updateBanner(editingBannerId, bannerFormData);
        setBanners((prev) => prev.map((b) => (b.id === editingBannerId ? updated : b)));
        showToast('Banner updated');
      } else {
        const created = await bannerService.createBanner(bannerFormData);
        setBanners((prev) => [created, ...prev]);
        showToast('Banner added');
      }
      setIsBannerModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: BannerImageKind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingBanner(true);
    setUploadingKind(kind);
    try {
      const size = await readImageSize(file);
      const res = await api.uploadImage(file, `${bannerFormData.title || 'hero_banner'}_${kind}`);
      if (res.secure_url) {
        setBannerFormData((prev) => ({ ...prev, [BANNER_IMAGE_FIELD[kind]]: res.secure_url }));
        const spec = BANNER_IMAGE_SPEC[kind];
        const offRatio = size && Math.abs(size.width / size.height - spec.ratio) / spec.ratio > 0.08;
        showToast(
          offRatio
            ? `Uploaded, but it is ${size.width}×${size.height}. ${spec.label} images look best at ${spec.recommended}.`
            : `${spec.label} image uploaded`
        );
      }
    } catch (err: any) {
      console.error('Banner upload error:', err);
      showToast('Upload failed: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingBanner(false);
      setUploadingKind(null);
    }
  };

  const renderBannerUpload = (kind: BannerImageKind) => {
    const field = BANNER_IMAGE_FIELD[kind];
    const spec = BANNER_IMAGE_SPEC[kind];
    const url = bannerFormData[field] || '';
    const busy = uploadingKind === kind;
    const Icon = kind === 'mobile' ? Smartphone : Monitor;
    return (
      <div className={kind === 'pc' ? 'col-span-2' : 'col-span-1'}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
            <Icon className="h-3.5 w-3.5" /> {spec.label}
          </span>
          <span className="text-[11px] text-slate-400">{spec.recommended}</span>
        </div>
        <label
          className={cx(
            'group relative block w-full overflow-hidden rounded-xl border-2 border-dashed bg-slate-50',
            kind === 'pc' ? 'aspect-[12/5]' : 'aspect-square',
            isUploadingBanner ? 'cursor-not-allowed border-blue-200' : 'cursor-pointer border-slate-200 hover:border-blue-400'
          )}
        >
          {url ? (
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-slate-300">
              <ImageIcon className="h-7 w-7" />
            </span>
          )}
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={isUploadingBanner}
            onChange={(e) => handleFileUpload(e, kind)}
            className="hidden"
          />
        </label>
        <Input
          aria-label={`${spec.label} image URL`}
          value={url}
          onChange={(e) => setBannerFormData((prev) => ({ ...prev, [field]: e.target.value }))}
          placeholder={kind === 'mobile' ? 'Optional: https://res.cloudinary.com/…' : '…or image URL'}
          className="mt-2 text-xs"
        />
        {kind === 'mobile' && url && (
          <button
            type="button"
            onClick={() => setBannerFormData((prev) => ({ ...prev, mobile_image_url: '' }))}
            className="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
          >
            Remove phone image
          </button>
        )}
      </div>
    );
  };

  const handleOpenAddOccasion = () => {
    setEditingOccasion(null);
    setOccasionError(null);
    setOccasionForm({ name: '', emoji: '🎁' });
    setIsOccasionModalOpen(true);
  };

  const handleOpenEditOccasion = (occ: OccasionItem) => {
    setEditingOccasion(occ);
    setOccasionError(null);
    setOccasionForm({ name: occ.name, emoji: occ.emoji });
    setIsOccasionModalOpen(true);
  };

  const handleSaveOccasion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!occasionForm.name.trim()) {
      setOccasionError('Please enter a folder name.');
      return;
    }

    if (editingOccasion) {
      saveOccasions(
        occasions.map((o) =>
          o.id === editingOccasion.id ? { ...o, name: occasionForm.name.trim(), emoji: occasionForm.emoji } : o
        )
      );
      showToast(`“${occasionForm.name.trim()}” updated`);
    } else {
      const newOccasion: OccasionItem = {
        id: occasionForm.name.trim().replace(/[^a-zA-Z0-9]/g, '_'),
        name: occasionForm.name.trim(),
        emoji: occasionForm.emoji || '🎁'
      };
      saveOccasions([...occasions, newOccasion]);
      showToast(`Folder “${newOccasion.name}” created`);
    }
    setIsOccasionModalOpen(false);
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    if (target.kind === 'banner') {
      await bannerService.deleteBanner(target.banner.id);
      setBanners((prev) => prev.filter((b) => b.id !== target.banner.id));
      showToast('Banner deleted');
    } else {
      saveOccasions(occasions.filter((o) => o.id !== target.folder.id));
      if (selectedFolder === target.folder.id) setSelectedFolder('all');
      setIsOccasionModalOpen(false);
      showToast('Folder deleted');
    }
  };

  const confirmDeleteSelected = async () => {
    const ids = [...selection.selected];
    setConfirmBulkDelete(false);
    setBulkDeleting(true);
    try {
      const deleted = await bannerService.deleteBanners(ids);
      const removed = new Set(ids);
      setBanners((prev) => prev.filter((b) => !removed.has(b.id)));
      selection.clear();
      showToast(`${deleted || ids.length} ${ids.length === 1 ? 'banner' : 'banners'} deleted`);
    } catch (err: any) {
      showToast(err.message || 'Could not delete the selected banners', 'danger');
    } finally {
      setBulkDeleting(false);
    }
  };

  const currentLiveBanner = activeBanners[carouselIndex] || activeBanners[0];
  const selectedFolderItem = occasions.find((o) => o.id === selectedFolder);

  const folderPill = (
    id: string,
    label: React.ReactNode,
    count: number,
    onEdit?: () => void
  ) => {
    const active = selectedFolder.toLowerCase() === id.toLowerCase();
    return (
      <div
        key={id}
        className={cx(
          'group inline-flex h-9 shrink-0 items-center rounded-xl text-xs font-semibold transition-colors sm:h-8',
          active ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
      >
        <button
          type="button"
          onClick={() => setSelectedFolder(id)}
          aria-pressed={active}
          className="inline-flex h-full items-center gap-1.5 whitespace-nowrap pl-3 pr-2 cursor-pointer"
        >
          {label}
          <span
            className={cx(
              'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
              active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            )}
          >
            {count}
          </span>
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit folder ${typeof label === 'string' ? label : ''}`}
            className={cx(
              'mr-1 grid h-6 w-6 place-items-center rounded-lg transition-opacity cursor-pointer',
              active ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700',
              active ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
            )}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {!onEdit && <span className="w-1" />}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Toast message={toastMessage} tone={toastTone} />

      <PageHeader
        icon={<ImageIcon className="h-5 w-5" />}
        title="Hero banners"
        description={`${banners.length} banners · ${activeBanners.length} live on the homepage carousel`}
        actions={
          <>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:h-9"
            >
              View homepage <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <IconButton label="Refresh banners" onClick={loadBanners} className="border-slate-200 bg-white">
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" onClick={handleOpenCreateBanner} icon={<Plus className="h-4 w-4" />}>
              Add banner
            </Button>
          </>
        }
      />

      {/* Live preview */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Homepage preview
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeBanners.length > 0
                ? `Slide ${carouselIndex + 1} of ${activeBanners.length}, in the order shoppers see them`
                : 'No live banners'}
            </p>
          </div>
          {activeBanners.length > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <IconButton label="Previous slide" onClick={() => stepCarousel(-1)} className="border-slate-200">
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton label="Next slide" onClick={() => stepCarousel(1)} className="border-slate-200">
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>

        <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-900 sm:aspect-[21/8]">
          {currentLiveBanner ? (
            <>
              <img
                src={currentLiveBanner.image_url}
                alt={currentLiveBanner.title}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {activeBanners.length > 1 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/50 px-2 py-1.5 backdrop-blur">
                  {activeBanners.map((banner, idx) => (
                    <button
                      key={banner.id}
                      type="button"
                      onClick={() => setCarouselIndex(idx)}
                      aria-label={`Show slide ${idx + 1}`}
                      className={cx(
                        'h-1.5 rounded-full transition-all cursor-pointer',
                        idx === carouselIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      )}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <Layers className="mx-auto h-6 w-6 text-slate-500" />
                <p className="mt-2 text-sm font-medium text-slate-300">Nothing is live on the homepage</p>
                <p className="mt-1 text-xs text-slate-500">Turn on “Live” for a banner below to show it here.</p>
              </div>
            </div>
          )}
        </div>

        {currentLiveBanner && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="min-w-0 truncate text-[13px] font-semibold text-slate-900">{currentLiveBanner.title}</p>
            <p className="text-xs text-slate-500">
              Button <span className="font-medium text-slate-700">“{currentLiveBanner.cta_text || 'Shop'}”</span> links
              to <code className="rounded bg-slate-100 px-1 font-mono text-[11px] text-slate-600">{currentLiveBanner.link_url || '/'}</code>
            </p>
          </div>
        )}
      </Card>

      {/* Library */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {folderPill('all', 'All banners', banners.length)}
            {occasions.map((occ) =>
              folderPill(
                occ.id,
                <>
                  <span aria-hidden="true">{occ.emoji}</span>
                  {occ.name}
                </>,
                banners.filter((b) => (b.occasion || 'Casual').toLowerCase() === occ.id.toLowerCase()).length,
                () => handleOpenEditOccasion(occ)
              )
            )}
          </div>
          <Button size="sm" onClick={handleOpenAddOccasion} icon={<FolderPlus className="h-3.5 w-3.5" />} className="shrink-0 self-start sm:self-auto">
            New folder
          </Button>
        </div>

        {loading && banners.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Loading banners…</span>
          </div>
        ) : filteredBanners.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title={selectedFolder === 'all' ? 'No banners yet' : `No banners in ${selectedFolderItem?.name ?? 'this folder'}`}
            description="Banners rotate in the hero carousel at the top of the homepage."
            action={
              <Button variant="primary" onClick={handleOpenCreateBanner} icon={<Plus className="h-4 w-4" />}>
                Add banner
              </Button>
            }
          />
        ) : (
          <>
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-5">
            <Checkbox
              checked={allShownSelected}
              indeterminate={selection.selected.size > 0}
              onChange={(checked) => selection.setSelected(checked ? new Set(filteredBanners.map((b) => b.id)) : new Set())}
              label={allShownSelected ? 'Clear selection' : 'Select all'}
            />
            <span className="text-xs font-medium text-slate-500">
              {selection.selected.size > 0
                ? `${selection.selected.size} of ${filteredBanners.length} selected`
                : `Select all (${filteredBanners.length})`}
            </span>
          </div>
          <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredBanners.map((banner, index) => {
              const folder = folderFor(banner);
              const isFirst = index === 0;
              const isLast = index === filteredBanners.length - 1;
              const selected = selection.selected.has(banner.id);
              return (
                <li
                  key={banner.id}
                  className={cx(
                    'flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md',
                    selected
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : banner.is_active
                        ? 'border-slate-200'
                        : 'border-dashed border-slate-300'
                  )}
                >
                  <div className="relative aspect-[16/9] bg-slate-100">
                    <img
                      src={banner.image_url}
                      alt=""
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                      className={cx(
                        'absolute inset-0 h-full w-full object-cover',
                        !banner.is_active && 'opacity-50 grayscale'
                      )}
                    />
                    <span className="absolute left-2.5 top-2.5 grid h-7 min-w-7 place-items-center rounded-lg bg-slate-900/80 px-1.5 text-xs font-bold tabular-nums text-white backdrop-blur">
                      {index + 1}
                    </span>
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                      {!banner.is_active && <Badge tone="neutral">Hidden</Badge>}
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 shadow-sm backdrop-blur-sm">
                        <Checkbox
                          checked={selected}
                          onChange={(checked) => toggleBannerSelected(banner.id, checked)}
                          label={`Select ${banner.title}`}
                        />
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-3.5">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{banner.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{banner.subtitle || banner.link_url || '—'}</p>
                    <div className="mt-2.5">
                      <Badge tone="info">
                        <span aria-hidden="true">{folder?.emoji || '🏷️'}</span>
                        {folder?.name || banner.occasion || 'Casual'}
                      </Badge>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <Switch
                        checked={Boolean(banner.is_active)}
                        onChange={() => handleToggleActive(banner.id)}
                        label="Live"
                        showLabel
                      />
                      <div className="flex items-center gap-0.5">
                        <IconButton
                          label="Move earlier"
                          disabled={isFirst}
                          onClick={() => handleMoveOrder(banner.id, 'up')}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Move later"
                          disabled={isLast}
                          onClick={() => handleMoveOrder(banner.id, 'down')}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </IconButton>
                        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
                        <IconButton label={`Edit ${banner.title}`} onClick={() => handleOpenEditBanner(banner)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`Delete ${banner.title}`}
                          tone="danger"
                          onClick={() => setPendingDelete({ kind: 'banner', banner })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </Card>

      {/* Banner form */}
      <Modal
        open={isBannerModalOpen}
        onClose={() => setIsBannerModalOpen(false)}
        title={editingBannerId ? 'Edit banner' : 'Add a banner'}
        subtitle="PC image 2400×1000 (12:5), phone image 1080×1080 (1:1). Both are uploaded to Cloudinary."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsBannerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="banner-form"
              disabled={isSaving || isUploadingBanner}
              icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {editingBannerId ? 'Save changes' : 'Add banner'}
            </Button>
          </div>
        }
      >
        <form id="banner-form" onSubmit={handleSaveBanner} className="space-y-4">
          {bannerError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {bannerError}
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {renderBannerUpload('pc')}
            {renderBannerUpload('mobile')}
          </div>
          <p className="-mt-1 text-[11px] leading-relaxed text-slate-500">
            Phones show the phone image, computers show the PC image. If you skip the phone image, phones use the PC image.
          </p>

          <div>
            <Label htmlFor="banner-title">Title</Label>
            <Input
              id="banner-title"
              required
              value={bannerFormData.title}
              onChange={(e) => setBannerFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Valentine’s love & eternal memories"
            />
          </div>

          <div>
            <Label htmlFor="banner-subtitle">Subtitle</Label>
            <Input
              id="banner-subtitle"
              value={bannerFormData.subtitle}
              onChange={(e) => setBannerFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="e.g. Handcrafted gifts with a personal note"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="banner-cta">Button text</Label>
              <Input
                id="banner-cta"
                value={bannerFormData.cta_text}
                onChange={(e) => setBannerFormData((prev) => ({ ...prev, cta_text: e.target.value }))}
                placeholder="Shop now"
              />
            </div>
            <div>
              <Label htmlFor="banner-link">Button link</Label>
              <Input
                id="banner-link"
                value={bannerFormData.link_url}
                onChange={(e) => setBannerFormData((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="/catalog"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="banner-badge">Badge (small label)</Label>
            <Input
              id="banner-badge"
              value={bannerFormData.badge}
              onChange={(e) => setBannerFormData((prev) => ({ ...prev, badge: e.target.value }))}
              placeholder="e.g. SAME-DAY DELIVERY"
            />
          </div>

          <SwitchField
            label="Show title, subtitle and button on the banner"
            description="Turn this off when the text is already part of the image"
            checked={Boolean(bannerFormData.show_overlay)}
            onChange={(checked) => setBannerFormData((prev) => ({ ...prev, show_overlay: checked }))}
          />

          <div>
            <Label htmlFor="banner-folder">Folder</Label>
            <Select
              id="banner-folder"
              value={bannerFormData.occasion}
              onChange={(e) => setBannerFormData((prev) => ({ ...prev, occasion: e.target.value }))}
            >
              {occasions.map((occ) => (
                <option key={occ.id} value={occ.id}>
                  {occ.emoji} {occ.name}
                </option>
              ))}
            </Select>
          </div>

          <SwitchField
            label="Live on the homepage"
            description="Show this banner in the hero carousel"
            checked={Boolean(bannerFormData.is_active)}
            onChange={(checked) => setBannerFormData((prev) => ({ ...prev, is_active: checked }))}
          />
        </form>
      </Modal>

      {/* Folder form */}
      <Modal
        open={isOccasionModalOpen}
        onClose={() => setIsOccasionModalOpen(false)}
        title={editingOccasion ? 'Edit folder' : 'New folder'}
        subtitle="Folders keep seasonal banners organised."
        footer={
          <div className="flex items-center justify-between gap-2">
            {editingOccasion ? (
              <Button
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setPendingDelete({ kind: 'folder', folder: editingOccasion })}
              >
                Delete folder
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsOccasionModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="occasion-form">
                {editingOccasion ? 'Save' : 'Create folder'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="occasion-form" onSubmit={handleSaveOccasion} className="space-y-4">
          {occasionError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
              {occasionError}
            </p>
          )}
          <div>
            <Label htmlFor="occasion-name">Name</Label>
            <Input
              id="occasion-name"
              required
              value={occasionForm.name}
              onChange={(e) => setOccasionForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Diwali specials, Mother's Day"
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-slate-700">Icon</legend>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {EMOJI_CHOICES.map((em) => (
                <button
                  key={em}
                  type="button"
                  aria-pressed={occasionForm.emoji === em}
                  onClick={() => setOccasionForm((prev) => ({ ...prev, emoji: em }))}
                  className={cx(
                    'grid aspect-square place-items-center rounded-xl border text-lg transition-colors cursor-pointer',
                    occasionForm.emoji === em
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800">
            Folders are saved in this browser only for now, so other admins won't see them yet.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'folder' ? 'Delete this folder?' : 'Delete this banner?'}
        message={
          pendingDelete?.kind === 'folder' ? (
            <>
              The <span className="font-semibold text-slate-900">{pendingDelete.folder.name}</span> folder will be
              removed. Its banners stay in your library.
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-900">“{pendingDelete?.banner.title}”</span> will be permanently
              removed{pendingDelete?.banner.is_active ? ' from the homepage carousel' : ''}.
            </>
          )
        }
        confirmLabel={pendingDelete?.kind === 'folder' ? 'Delete folder' : 'Delete banner'}
        onConfirm={confirmPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${selection.selected.size} ${selection.selected.size === 1 ? 'banner' : 'banners'}?`}
        message="The selected banners will be permanently removed, including from the homepage carousel. This can't be undone."
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

export default AdminBannersPage;
