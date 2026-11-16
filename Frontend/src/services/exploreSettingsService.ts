export interface ExploreCollectionConfig {
  id: 'trending' | 'new' | 'budget';
  label: string;
  emoji: string;
  enabled: boolean;
  description: string;
}

export interface ExploreSettings {
  collections: {
    trending: ExploreCollectionConfig;
    new: ExploreCollectionConfig;
    budget: ExploreCollectionConfig;
  };
  budgetMaxPrice: number;
}

const STORAGE_KEY = 'petal_pen_explore_settings';
const EVENT_NAME = 'petal_pen_explore_settings_updated';

export const DEFAULT_EXPLORE_SETTINGS: ExploreSettings = {
  collections: {
    trending: {
      id: 'trending',
      label: 'Trending',
      emoji: '🔥',
      enabled: true,
      description: 'Highlight hottest gifts based on demand and popularity',
    },
    new: {
      id: 'new',
      label: 'New Arrivals',
      emoji: '✨',
      enabled: true,
      description: 'Showcase newly added artisanal gifts and hampers',
    },
    budget: {
      id: 'budget',
      label: 'Budget Friendly',
      emoji: '🏷️',
      enabled: true,
      description: 'Thoughtful gifts under an affordable price limit',
    },
  },
  budgetMaxPrice: 999,
};

export const exploreSettingsService = {
  getSettings: (): ExploreSettings => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_EXPLORE_SETTINGS,
          ...parsed,
          collections: {
            trending: { ...DEFAULT_EXPLORE_SETTINGS.collections.trending, ...(parsed.collections?.trending || {}) },
            new: { ...DEFAULT_EXPLORE_SETTINGS.collections.new, ...(parsed.collections?.new || {}) },
            budget: { ...DEFAULT_EXPLORE_SETTINGS.collections.budget, ...(parsed.collections?.budget || {}) },
          },
          budgetMaxPrice: Number(parsed.budgetMaxPrice) || DEFAULT_EXPLORE_SETTINGS.budgetMaxPrice,
        };
      }
    } catch (e) {
      console.warn('Error reading explore settings from storage:', e);
    }
    return DEFAULT_EXPLORE_SETTINGS;
  },

  updateSettings: (patch: Partial<ExploreSettings>): ExploreSettings => {
    const current = exploreSettingsService.getSettings();
    const updated: ExploreSettings = {
      ...current,
      ...patch,
      collections: {
        ...current.collections,
        ...(patch.collections || {}),
      },
      budgetMaxPrice: patch.budgetMaxPrice !== undefined ? Number(patch.budgetMaxPrice) : current.budgetMaxPrice,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving explore settings:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
    }
    return updated;
  },

  subscribe: (callback: (settings: ExploreSettings) => void): (() => void) => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ExploreSettings>;
      if (custom.detail) callback(custom.detail);
      else callback(exploreSettingsService.getSettings());
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  },
};
