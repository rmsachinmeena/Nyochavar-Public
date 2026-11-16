export type Category = 'Flowers' | 'Hampers' | 'Personalized Gifts' | 'All' | (string & {});

export interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
  image_url?: string | null;
  occasion_type?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export type Occasion = 
  | 'Birthday' 
  | 'Anniversary' 
  | 'Valentine\'s' 
  | 'Congratulations' 
  | 'Get Well Soon' 
  | 'Festivals' 
  | 'Sympathy' 
  | 'Thank You' 
  | 'Just Because'
  | 'Diwali'
  | 'Raksha Bandhan'
  | 'Wedding'
  | 'Housewarming';

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface PaletteOption {
  id: string;
  name: string;
  tagline: string;
  colorSwatches: string[];
  previewImage: string;
}

export type ProductBadgeKey = 'new' | 'bestseller' | 'trending' | 'top_rated' | 'eco' | 'budget';

export interface ProductVariant {
  id: string;
  name: string;
  /** Heading shown above the variant options on the product page (e.g. "Select Size"). Same value on every variant of a product. */
  label?: string;
  price: number;
  mrp?: number;
  image?: string;
  images?: string[];
}

/** Product information a seller fills in (see Backend migration 029): shown in the "Product information" section of the product page. */
export interface ProductDetails {
  brand?: string;
  inTheBox?: string[];
  productType?: 'ready' | 'made_to_order';
  /** Days from the order until the parcel is ready for the rider (0 = the same day) */
  dispatchDays?: number;
  personalisationNote?: string;
  isFood?: boolean;
  foodType?: 'veg' | 'non_veg';
  ingredients?: string;
  allergens?: string;
  shelfLife?: { value: number; unit: 'days' | 'months' };
  fssai?: string;
  storage?: string;
  material?: string;
  origin?: string;
  gstRate?: number;
  hsn?: string;
  returnPolicy?: 'damaged' | 'seven_days' | 'none';
}

export interface Product {
  id: string;
  name: string;
  tagline?: string;
  category: Category;
  category_id?: string;
  occasions: Occasion[];
  price: number;
  mrp?: number;
  rating: number;
  reviewCount: number;
  review_count?: number;
  badges?: ProductBadgeKey[];
  isBestSeller?: boolean;
  isNew?: boolean;
  image: string;
  gallery: string[];
  description: string;
  hues?: string[];
  addons?: ProductAddon[];
  variants?: ProductVariant[];
  gender?: 'men' | 'women' | 'unisex';
  stock?: number;
  is_customizable?: boolean;
  is_trending?: boolean;
  has_gift_wrap?: boolean;
  express_delivery_available?: boolean;
  review_snippet?: string;
  is_eco_friendly?: boolean;
  is_top_rated_this_week?: boolean;
  is_personalization_available?: boolean;
  loyalty_points_value?: number;
  is_budget_friendly?: boolean;
  custom_badge?: string;
  delivery_label?: string;
  packaging_label?: string;
  delivery_charge?: number;
  is_free_delivery?: boolean;
  coupon_code?: string;
  min_order_amount?: number;
  max_discount?: number;
  delivery_time_text?: string;
  delivery_options?: DeliveryOption[];
  trust_badges?: TrustBadgeOption[];
  services?: ServiceOption[];
  ui_labels?: UiLabels;
  details?: ProductDetails;
  /** Set when a partner seller listed the product (empty for Nyochavar's own products) */
  seller_id?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface DeliveryOption {
  id: string;
  name: string;
  price: string;
  enabled: boolean;
}

export interface ServiceOption {
  id: string;
  name: string;
  icon?: string;
  /** Optional small tag shown on the card, e.g. "Free" or "₹49" */
  price?: string;
  enabled: boolean;
}

export const DEFAULT_SERVICE_OPTIONS: ServiceOption[] = [
  { id: 's1', name: 'Upload Your Photo', icon: 'photo', price: 'Free', enabled: false },
  { id: 's2', name: 'Print Your Name', icon: 'name', price: 'Free', enabled: false },
  { id: 's3', name: 'Add Your Signature', icon: 'signature', price: 'Free', enabled: false }
];

/** Admin-editable storefront texts. Empty / missing values fall back to DEFAULT_UI_LABELS. */
export interface UiLabels {
  /** Stock status text when the product is in stock */
  in_stock?: string;
  /** Stock status text when stock is low. `{stock}` is replaced with the units left */
  low_stock?: string;
  /** Stock status text when the product is sold out */
  sold_out?: string;
}

export const DEFAULT_UI_LABELS: Required<UiLabels> = {
  in_stock: 'In stock, ready for same-day dispatch',
  low_stock: 'Only {stock} left — order soon',
  sold_out: 'Currently sold out'
};

export interface TrustBadgeOption {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
}

export const DEFAULT_TRUST_BADGES: TrustBadgeOption[] = [
  { id: '1', name: 'Cancellation upto 2 hrs', icon: 'clock', enabled: true },
  { id: '2', name: '7-Day Return', icon: 'return', enabled: true },
  { id: '3', name: 'Cash on Delivery', icon: 'cod', enabled: true },
  { id: '4', name: 'Nyochavar Assured', icon: 'shield', enabled: true }
];
