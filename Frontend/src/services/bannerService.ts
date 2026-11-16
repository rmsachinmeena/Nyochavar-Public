import { adminFetch } from './apiClient';
import { api } from './api';
import { HeroBanner } from '../types';
import { API_BASE_URL } from './apiConfig';

const STORAGE_KEY = 'petal_pen_hero_banners';
const DELETED_KEY = 'petal_pen_deleted_banner_ids';
const BANNER_EVENT_NAME = 'petal_pen_hero_banners_updated';

export interface ExtendedHeroBanner extends HeroBanner {
  /** Phone picture (square, 1:1). Optional: phones fall back to image_url when it is empty. */
  mobile_image_url?: string;
  subtitle?: string;
  cta_text?: string;
  badge?: string;
  features?: string[];
  show_overlay?: boolean;
  occasion?: string; // 'Valentines' | 'Birthday' | 'New Year' | 'Anniversary' | 'Casual'
}

export const PRESET_HERO_BANNERS: ExtendedHeroBanner[] = [
  {
    id: 'banner_hero_001',
    title: 'Made Just for You',
    subtitle: 'Turn your special moments into unforgettable memories with our customized gifts.',
    image_url: '/banners/hero-banner-1.png',
    link_url: '/catalog',
    cta_text: 'Shop Custom Gifts',
    badge: 'CUSTOMIZED GIFTS • YOUR IDEAS | OUR CREATION',
    is_active: true,
    display_order: 1,
    show_overlay: false,
    occasion: 'Casual',
    features: ['Unique & Personalized', 'Perfect for Every Occasion', 'Premium Quality', 'Fast & Safe Delivery']
  },
  {
    id: 'banner_hero_002',
    title: 'Personalized Gifts for Every Special Moment',
    subtitle: 'From heartfelt cards to beautiful hampers, create a gift as unique as your emotions.',
    image_url: '/banners/hero-banner-2.png',
    link_url: '/builder',
    cta_text: 'Explore Our Collection',
    badge: 'CUSTOMIZED GIFTS • LASTING MEMORIES',
    is_active: true,
    display_order: 2,
    show_overlay: false,
    occasion: 'Birthday',
    features: ['Custom Hampers', 'Fresh Flowers', 'Jhumkas & Jewellery', 'Toys & Cuddles', 'Personalized Cards']
  },
  {
    id: 'banner_hero_003',
    title: 'Valentine’s Romance & Eternal Roses',
    subtitle: 'Express pure heartfelt love with handcrafted velvet hampers and personalized tokens.',
    image_url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=1200',
    link_url: '/catalog',
    cta_text: 'Valentine Specials',
    badge: 'VALENTINE COLLECTION',
    is_active: true,
    display_order: 3,
    show_overlay: true,
    occasion: 'Valentines',
    features: ['Fresh Preserved Roses', 'Engraved Memories', 'Sweet Chocolates']
  },
  {
    id: 'banner_hero_004',
    title: 'Happy New Year & Festive Hampers',
    subtitle: 'Welcome prosperity, joy, and festive cheer with luxurious celebration boxes.',
    image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=1200',
    link_url: '/catalog',
    cta_text: 'Festive Boxes',
    badge: 'NEW YEAR CELEBRATION',
    is_active: false,
    display_order: 4,
    show_overlay: true,
    occasion: 'New Year',
    features: ['Festive Sweets', 'Golden Accents', 'Custom Greeting Card']
  },
  {
    id: 'banner_hero_005',
    title: 'Anniversary Milestones & Golden Memories',
    subtitle: 'Celebrate your journey of love with personalized wooden frames and perfumes.',
    image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200',
    link_url: '/anniversary',
    cta_text: 'Shop Anniversary',
    badge: 'ANNIVERSARY LUXURY',
    is_active: false,
    display_order: 5,
    show_overlay: true,
    occasion: 'Anniversary',
    features: ['Custom Engraving', 'Couple Keepsakes', 'Silk Packaging']
  }
];

function getDeletedBannerIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.warn('Error reading deleted banner IDs:', e);
  }
  return new Set();
}

function addDeletedBannerId(id: string): void {
  const set = getDeletedBannerIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Error saving deleted banner IDs:', e);
  }
}

// Initialize local cache if not present
function getLocalBanners(): ExtendedHeroBanner[] {
  const deleted = getDeletedBannerIds();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(b => b && b.id && !deleted.has(b.id));
      }
    }
  } catch (e) {
    console.warn('Error reading banners from localStorage:', e);
  }
  // Store default presets (excluding any previously deleted)
  const initial = PRESET_HERO_BANNERS.filter(b => !deleted.has(b.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveLocalBanners(banners: ExtendedHeroBanner[]) {
  const deleted = getDeletedBannerIds();
  const clean = banners.filter(b => b && b.id && !deleted.has(b.id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent(BANNER_EVENT_NAME, { detail: clean }));
  } catch (e) {
    console.warn('Error saving banners to localStorage:', e);
  }
}

export const bannerService = {
  // Fetch banners (API with localStorage fallback and enrichment). The storefront asks for active ones only, which
  // the server lets browsers reuse for a minute; the admin list is always fresh.
  getAllBanners: async (activeOnly = false): Promise<ExtendedHeroBanner[]> => {
    const deleted = getDeletedBannerIds();
    const local = getLocalBanners();
    try {
      const res = await adminFetch(`${API_BASE_URL}/banners${activeOnly ? '?active=true' : ''}`, {
        cacheTtlMs: activeOnly ? 60_000 : 0
      });
      if (res.ok) {
        const data = await res.json();
        if (data.banners && Array.isArray(data.banners)) {
          // Filter out deleted banners
          const validServerBanners = data.banners.filter((b: any) => b && b.id && !deleted.has(b.id));

          if (validServerBanners.length > 0) {
            // Merge server data with local presets (preserving rich metadata like cta_text, subtitle)
            const merged: ExtendedHeroBanner[] = validServerBanners.map((b: any) => {
              const matchLocal = local.find(l => l.id === b.id || l.image_url === b.image_url);
              return {
                id: b.id,
                title: b.title || matchLocal?.title || 'Customized Gifts',
                subtitle: b.subtitle || matchLocal?.subtitle || 'Personalized gifts handcrafted for your special moments.',
                image_url: b.image_url,
                mobile_image_url: b.mobile_image_url || matchLocal?.mobile_image_url || undefined,
                link_url: b.link_url || matchLocal?.link_url || '/catalog',
                cta_text: b.cta_text || matchLocal?.cta_text || 'Shop Custom Gifts',
                badge: b.badge || matchLocal?.badge || 'CUSTOMIZED GIFTS',
                is_active: b.is_active !== undefined ? Boolean(b.is_active) : true,
                display_order: b.display_order !== undefined ? Number(b.display_order) : 0,
                occasion: b.occasion || matchLocal?.occasion || 'Casual',
                show_overlay: b.show_overlay !== undefined ? Boolean(b.show_overlay) : (matchLocal?.show_overlay ?? false),
                features: matchLocal?.features || ['Unique & Personalized', 'Premium Quality', 'Fast Delivery']
              };
            });

            // The admin console also keeps local-only custom banners that are not on the server yet. Shoppers only ever
            // see what the server says is live, so the superadmin's list is the single source of truth.
            if (!activeOnly) {
              for (const loc of local) {
                if (!deleted.has(loc.id) && !merged.some(m => m.id === loc.id || m.image_url === loc.image_url)) {
                  merged.push(loc);
                }
              }
              saveLocalBanners(merged);
            }
            return merged;
          }
        }
      }
    } catch (err) {
      console.warn('Backend banners API unavailable, using local cache:', err);
    }
    return local;
  },

  // Get active banners only
  getActiveBanners: async (): Promise<ExtendedHeroBanner[]> => {
    const all = await bannerService.getAllBanners(true);
    const active = all.filter(b => b.is_active).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    return active.length > 0 ? active : PRESET_HERO_BANNERS.filter(b => !getDeletedBannerIds().has(b.id));
  },

  // Add a new banner
  createBanner: async (bannerData: Partial<ExtendedHeroBanner>): Promise<ExtendedHeroBanner> => {
    const id = `banner_${Date.now()}`;
    let newBanner: ExtendedHeroBanner = {
      id,
      title: bannerData.title?.trim() || 'New Customized Banner',
      subtitle: bannerData.subtitle?.trim() || 'Personalized gifts for every memorable moment.',
      image_url: bannerData.image_url || '/banners/hero-banner-1.png',
      mobile_image_url: bannerData.mobile_image_url?.trim() || undefined,
      link_url: bannerData.link_url || '/catalog',
      cta_text: bannerData.cta_text || 'Explore Collection',
      badge: bannerData.badge || 'CUSTOMIZED GIFTS',
      is_active: bannerData.is_active !== undefined ? Boolean(bannerData.is_active) : true,
      display_order: bannerData.display_order || 1,
      occasion: bannerData.occasion || 'Casual',
      show_overlay: bannerData.show_overlay ?? false,
      features: bannerData.features || ['Unique & Personalized', 'Premium Handcrafted', 'Express Delivery']
    };

    // Try backend
    try {
      const res = await adminFetch(`${API_BASE_URL}/banners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBanner)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.banner) {
          newBanner = { ...newBanner, ...json.banner, id: json.banner.id || newBanner.id };
        }
      }
    } catch (e) {
      console.warn('Could not post banner to backend, saved locally:', e);
    }

    const current = getLocalBanners();
    const updated = [newBanner, ...current.filter(b => b.id !== newBanner.id)];
    saveLocalBanners(updated);
    return newBanner;
  },

  // Reorder banners
  reorderBanners: async (orderedIds: string[]): Promise<ExtendedHeroBanner[]> => {
    const current = getLocalBanners();
    const updated = current.map(b => {
      const idx = orderedIds.indexOf(b.id);
      return idx !== -1 ? { ...b, display_order: idx + 1 } : b;
    }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    saveLocalBanners(updated);

    // Sync to backend
    for (let i = 0; i < orderedIds.length; i++) {
      const bId = orderedIds[i];
      adminFetch(`${API_BASE_URL}/banners/${bId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: i + 1 })
      }).catch(() => undefined);
    }

    return updated;
  },

  // Update a banner
  updateBanner: async (id: string, updates: Partial<ExtendedHeroBanner>): Promise<ExtendedHeroBanner> => {
    // Try backend
    try {
      await adminFetch(`${API_BASE_URL}/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.warn('Could not update banner in backend, saved locally:', e);
    }

    const current = getLocalBanners();
    const updated = current.map(b => (b.id === id ? { ...b, ...updates } : b));
    saveLocalBanners(updated);
    return updated.find(b => b.id === id)!;
  },

  // Toggle active status
  toggleBannerStatus: async (id: string): Promise<boolean> => {
    const current = getLocalBanners();
    const target = current.find(b => b.id === id);
    if (!target) return false;

    const newStatus = !target.is_active;

    try {
      await adminFetch(`${API_BASE_URL}/banners/${id}/toggle`, { method: 'PATCH' });
    } catch (e) {
      console.warn('Could not toggle in backend, saved locally:', e);
    }

    const updated = current.map(b => (b.id === id ? { ...b, is_active: newStatus } : b));
    saveLocalBanners(updated);
    return newStatus;
  },

  // Delete banner
  deleteBanner: async (id: string): Promise<boolean> => {
    // 1. Permanently blacklist this banner ID so presets or cached API responses never resurrect it
    addDeletedBannerId(id);

    // 2. Remove from local store immediately and notify listeners
    const current = getLocalBanners();
    const updated = current.filter(b => b.id !== id);
    saveLocalBanners(updated);

    // 3. Call backend API to remove from database
    try {
      await adminFetch(`${API_BASE_URL}/banners/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not delete in backend, saved locally:', e);
    }

    return true;
  },

  // Delete one or many banners in one request. Throws (and changes nothing locally) if the server refuses.
  deleteBanners: async (ids: string[]): Promise<number> => {
    const result = await api.bulkDelete('banners', ids);

    ids.forEach(addDeletedBannerId);
    const removed = new Set(ids);
    saveLocalBanners(getLocalBanners().filter(b => !removed.has(b.id)));
    return result.deleted;
  },

  // Quick Activate: Make a specific banner the primary active banner
  setAsPrimaryActive: async (id: string): Promise<void> => {
    const current = getLocalBanners();
    const updated = current.map(b => {
      if (b.id === id) {
        return { ...b, is_active: true, display_order: 0 };
      }
      return b;
    });
    saveLocalBanners(updated);

    try {
      await adminFetch(`${API_BASE_URL}/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true, display_order: 0 })
      });
    } catch (e) {}
  },

  // Reset to default presets
  resetToPresets: async (): Promise<ExtendedHeroBanner[]> => {
    localStorage.removeItem(DELETED_KEY);
    saveLocalBanners(PRESET_HERO_BANNERS);
    return PRESET_HERO_BANNERS;
  },

  // Subscribe to live banner changes across tabs & components
  subscribeToChanges: (callback: (banners: ExtendedHeroBanner[]) => void): (() => void) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        callback(customEvent.detail);
      }
    };
    window.addEventListener(BANNER_EVENT_NAME, handler);
    return () => window.removeEventListener(BANNER_EVENT_NAME, handler);
  }
};

export default bannerService;
