import type { LucideIcon } from 'lucide-react';
import { Camera, ClipboardCheck, IndianRupee, Layers, Package, ShieldCheck } from 'lucide-react';
import type { ProductForm } from '../../../services/sellerApi';

/**
 * The "List a new product" form is a short series of steps. This file holds what the seller has typed so far (the draft),
 * the list of steps, and the checks each step makes before the seller may continue.
 * Steps are added here one at a time as each one is designed and approved.
 */

export type StepId = 'basics' | 'photos' | 'pricing' | 'variants' | 'details' | 'review';

export interface WizardStep {
  id: StepId;
  title: string;
  /** One line under the title, saying what the step is for */
  hint: string;
  icon: LucideIcon;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'basics', title: 'Basic details', hint: 'Name, category and description', icon: Package },
  { id: 'photos', title: 'Photos', hint: 'Upload pictures of your product', icon: Camera },
  { id: 'pricing', title: 'Price & stock', hint: 'Price, discount and units available', icon: IndianRupee },
  { id: 'variants', title: 'Variants', hint: 'Sizes, flavours or colours (optional)', icon: Layers },
  { id: 'details', title: 'Product details', hint: 'Gifting options and product information', icon: ShieldCheck },
  { id: 'review', title: 'Review & publish', hint: 'Check everything, then go live', icon: ClipboardCheck },
];

/** One option of a product (for example the 500 g size). The seller's main product from step 3 is the first option. */
export interface VariantDraft {
  id: string;
  name: string;
  price: string;
  mrp: string;
  stock: string;
  sku: string;
  /** The option's own pictures (links), the first is its cover. Empty means buyers see the product's pictures. */
  images: string[];
}

export type ProductType = 'ready' | 'made_to_order';
export type FoodType = 'veg' | 'non_veg' | '';
export type ReturnPolicy = 'damaged' | 'seven_days' | 'none';

export type VariantRowErrors = Partial<Record<'name' | 'price' | 'mrp' | 'stock' | 'sku', string>>;

export interface ProductDraft {
  // Step 1: basic details
  title: string;
  category: string;
  brand: string;
  tagline: string;
  description: string;
  /** What is inside the box, one short item each */
  inTheBox: string[];
  occasions: string[];
  // Step 2: photos (links of the uploaded pictures, the first one is the cover)
  images: string[];
  // Step 3: price and stock (kept as text while typing; turned into numbers when the product is published)
  price: string;
  mrp: string;
  stock: string;
  sku: string;
  weightGrams: string;
  // Step 4: options such as sizes or flavours (optional)
  hasVariants: boolean;
  /** The heading buyers see above the options, for example "Select Size" is built from "Size" */
  variantLabel: string;
  variants: VariantDraft[];
  // Step 5: how it is fulfilled, gifting options and product information
  productType: ProductType;
  /** Days between the order and the parcel being ready for the rider ("0" = the same day) */
  dispatchDays: string;
  allowCustomNote: boolean;
  personalisation: boolean;
  personalisationNote: string;
  giftWrap: boolean;
  isFood: boolean;
  foodType: FoodType;
  ingredients: string;
  allergens: string;
  shelfLifeValue: string;
  shelfLifeUnit: 'days' | 'months';
  fssai: string;
  storage: string;
  material: string;
  origin: string;
  gstRate: string;
  hsn: string;
  returnPolicy: ReturnPolicy;
}

export type DraftErrors = Partial<Record<keyof ProductDraft, string>>;

export const LIMITS = {
  title: { min: 5, max: 150 },
  brand: { max: 80 },
  tagline: { max: 80 },
  description: { min: 30, max: 2000 },
  inTheBox: { items: 12, itemLength: 60 },
};

export const PRICE_LIMITS = {
  maxPrice: 1_000_000,
  maxStock: 100_000,
  maxSku: 60,
  maxWeightGrams: 1_000_000,
};

export const DISPATCH_OPTIONS: Record<ProductType, Array<{ value: string; label: string }>> = {
  ready: [
    { value: '0', label: 'Same day' },
    { value: '1', label: 'Within 1 day' },
    { value: '2', label: 'Within 2 days' },
    { value: '3', label: 'Within 3 days' },
  ],
  made_to_order: [
    { value: '3', label: '3 days' },
    { value: '5', label: '5 days' },
    { value: '7', label: '7 days' },
    { value: '10', label: '10 days' },
    { value: '15', label: '15 days' },
  ],
};

export const GST_RATES = ['0', '5', '12', '18', '28'];

export const DETAIL_LIMITS = {
  personalisationNote: { min: 10, max: 300 },
  ingredients: { min: 10, max: 1000 },
  allergens: 300,
  storage: 200,
  material: 120,
  origin: 60,
  shelfLifeMax: 999,
};

export const VARIANT_LIMITS = {
  max: 10,
  /** Pictures one option can have */
  photos: 4,
  label: 30,
  name: 40,
};

export const PHOTO_LIMITS = {
  min: 1,
  max: 8,
  /** Below this the seller is nudged to add more (it is not required) */
  recommended: 3,
  /** The biggest picture accepted from the seller's phone or computer, before it is shrunk for upload */
  maxPickMb: 25,
};

export const emptyDraft = (storeName: string): ProductDraft => ({
  title: '',
  category: '',
  brand: storeName,
  tagline: '',
  description: '',
  inTheBox: [],
  occasions: [],
  images: [],
  price: '',
  mrp: '',
  stock: '',
  sku: '',
  weightGrams: '',
  hasVariants: false,
  variantLabel: '',
  variants: [],
  productType: 'ready',
  dispatchDays: '2',
  allowCustomNote: false,
  personalisation: false,
  personalisationNote: '',
  giftWrap: false,
  isFood: false,
  foodType: '',
  ingredients: '',
  allergens: '',
  shelfLifeValue: '',
  shelfLifeUnit: 'months',
  fssai: '',
  storage: '',
  material: '',
  origin: 'India',
  gstRate: '',
  hsn: '',
  returnPolicy: 'damaged',
});

export const newVariant = (price = ''): VariantDraft => ({
  id: `var_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  price,
  mrp: '',
  stock: '',
  sku: '',
  images: [],
});

/** Checks one option. `others` are the other options' names, to refuse two options with the same name. */
export const validateVariantRow = (variant: VariantDraft, others: string[]): VariantRowErrors => {
  const errors: VariantRowErrors = {};
  const name = variant.name.trim();
  if (!name) errors.name = 'Name this option';
  else if (name.length > VARIANT_LIMITS.name) errors.name = `At most ${VARIANT_LIMITS.name} characters`;
  else if (others.some((other) => other.trim().toLowerCase() === name.toLowerCase())) errors.name = 'Two options cannot have the same name';

  const price = toAmount(variant.price);
  if (!variant.price.trim() || price <= 0) errors.price = 'Enter the price';
  else if (price > PRICE_LIMITS.maxPrice) errors.price = 'Price is too high';

  if (variant.mrp.trim()) {
    const mrp = toAmount(variant.mrp);
    if (mrp <= 0 || mrp > PRICE_LIMITS.maxPrice) errors.mrp = 'Enter a valid MRP';
    else if (!errors.price && mrp < price) errors.mrp = 'MRP is below the price';
  }

  if (!variant.stock.trim()) errors.stock = 'Enter the stock';
  else if (toAmount(variant.stock) > PRICE_LIMITS.maxStock) errors.stock = 'Too many units';

  if (variant.sku.trim().length > PRICE_LIMITS.maxSku) errors.sku = 'Too long';
  return errors;
};

/** "199.50" -> 199.5, "" -> 0 */
export const toAmount = (text: string): number => {
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
};

/** Checks one step. Returns a readable message for every field that is not right (an empty object means the step is fine). */
export const validateStep = (step: StepId, draft: ProductDraft): DraftErrors => {
  const errors: DraftErrors = {};

  if (step === 'basics') {
    const title = draft.title.trim();
    if (!title) errors.title = 'Enter the product name';
    else if (title.length < LIMITS.title.min) errors.title = `The name needs at least ${LIMITS.title.min} characters`;
    else if (title.length > LIMITS.title.max) errors.title = `The name can have at most ${LIMITS.title.max} characters`;

    if (!draft.category) errors.category = 'Choose a category';

    if (draft.brand.trim().length > LIMITS.brand.max) errors.brand = `At most ${LIMITS.brand.max} characters`;
    if (draft.tagline.trim().length > LIMITS.tagline.max) errors.tagline = `At most ${LIMITS.tagline.max} characters`;

    const description = draft.description.trim();
    if (!description) errors.description = 'Describe your product so buyers know what they get';
    else if (description.length < LIMITS.description.min) {
      errors.description = `Write a little more: at least ${LIMITS.description.min} characters (you have ${description.length})`;
    } else if (description.length > LIMITS.description.max) errors.description = `At most ${LIMITS.description.max} characters`;
  }

  if (step === 'photos') {
    if (draft.images.length < PHOTO_LIMITS.min) errors.images = 'Add at least one picture of your product';
    else if (draft.images.length > PHOTO_LIMITS.max) errors.images = `You can have at most ${PHOTO_LIMITS.max} pictures`;
  }

  if (step === 'pricing') {
    const price = toAmount(draft.price);
    if (!draft.price.trim()) errors.price = 'Enter the selling price';
    else if (price <= 0) errors.price = 'The price must be more than 0';
    else if (price > PRICE_LIMITS.maxPrice) errors.price = `The price can be at most ₹${PRICE_LIMITS.maxPrice.toLocaleString('en-IN')}`;

    if (draft.mrp.trim()) {
      const mrp = toAmount(draft.mrp);
      if (mrp <= 0 || mrp > PRICE_LIMITS.maxPrice) errors.mrp = 'Enter a valid MRP';
      else if (!errors.price && mrp < price) errors.mrp = 'The MRP cannot be lower than the selling price';
    }

    if (!draft.stock.trim()) errors.stock = 'Enter how many units you have (0 if none right now)';
    else if (toAmount(draft.stock) > PRICE_LIMITS.maxStock) errors.stock = `At most ${PRICE_LIMITS.maxStock.toLocaleString('en-IN')} units`;

    if (draft.sku.trim().length > PRICE_LIMITS.maxSku) errors.sku = `At most ${PRICE_LIMITS.maxSku} characters`;
    if (draft.weightGrams.trim() && toAmount(draft.weightGrams) > PRICE_LIMITS.maxWeightGrams) errors.weightGrams = 'Enter a valid weight in grams';
  }

  if (step === 'variants' && draft.hasVariants) {
    const label = draft.variantLabel.trim();
    if (!label) errors.variantLabel = 'Say what the options are, for example Size or Flavour';
    else if (label.length > VARIANT_LIMITS.label) errors.variantLabel = `At most ${VARIANT_LIMITS.label} characters`;

    if (draft.variants.length === 0) errors.variants = 'Add at least one more option, or choose "No" above';
    else if (draft.variants.some((variant, index) => Object.keys(validateVariantRow(variant, draft.variants.filter((_, i) => i !== index).map((other) => other.name))).length > 0)) {
      errors.variants = 'Fix the options marked in red';
    }
  }

  if (step === 'details') {
    if (!DISPATCH_OPTIONS[draft.productType].some((option) => option.value === draft.dispatchDays)) {
      errors.dispatchDays = 'Choose how soon you can dispatch it';
    }

    if (draft.personalisation) {
      const note = draft.personalisationNote.trim();
      if (!note) errors.personalisationNote = 'Tell buyers what they can personalise (for example a name, up to 15 letters)';
      else if (note.length < DETAIL_LIMITS.personalisationNote.min) errors.personalisationNote = `Write a little more: at least ${DETAIL_LIMITS.personalisationNote.min} characters`;
    }

    if (draft.isFood) {
      if (!draft.foodType) errors.foodType = 'Choose Veg or Non-veg (it is shown to buyers)';
      const ingredients = draft.ingredients.trim();
      if (!ingredients) errors.ingredients = 'List the ingredients';
      else if (ingredients.length < DETAIL_LIMITS.ingredients.min) errors.ingredients = `Write a little more: at least ${DETAIL_LIMITS.ingredients.min} characters`;
      const shelf = toAmount(draft.shelfLifeValue);
      if (!draft.shelfLifeValue.trim() || shelf <= 0) errors.shelfLifeValue = 'Enter the shelf life';
      else if (shelf > DETAIL_LIMITS.shelfLifeMax) errors.shelfLifeValue = 'Enter a valid shelf life';
      if (!/^\d{14}$/.test(draft.fssai.trim())) errors.fssai = 'The FSSAI licence number has 14 digits';
    }

    if (!draft.origin.trim()) errors.origin = 'Enter the country where it is made';
    if (!GST_RATES.includes(draft.gstRate)) errors.gstRate = 'Choose the GST rate that applies to this product';
    if (draft.hsn.trim() && !/^\d{4,8}$/.test(draft.hsn.trim())) errors.hsn = 'The HSN code has 4 to 8 digits';
  }

  return errors;
};

/** What the server is sent when the seller publishes: the draft's text fields become numbers, empty ones are left out. */
export const buildProductPayload = (draft: ProductDraft): ProductForm => {
  const optional = (text: string) => (text.trim() ? text.trim() : undefined);
  return {
    title: draft.title.trim(),
    category: draft.category,
    tagline: draft.tagline.trim(),
    description: draft.description.trim(),
    occasions: draft.occasions,
    images: draft.images,
    price: toAmount(draft.price),
    mrp: draft.mrp.trim() ? toAmount(draft.mrp) : undefined,
    stock: toAmount(draft.stock),
    sku: optional(draft.sku),
    weightGrams: draft.weightGrams.trim() ? toAmount(draft.weightGrams) : undefined,
    allowCustomNote: draft.allowCustomNote,
    giftWrap: draft.giftWrap,
    personalisation: draft.personalisation,
    variants:
      draft.hasVariants && draft.variants.length > 0
        ? {
            label: draft.variantLabel.trim(),
            items: draft.variants.map((variant) => ({
              id: variant.id,
              name: variant.name.trim(),
              price: toAmount(variant.price),
              mrp: variant.mrp.trim() ? toAmount(variant.mrp) : undefined,
              stock: toAmount(variant.stock),
              sku: optional(variant.sku),
              images: variant.images.length > 0 ? variant.images : undefined,
            })),
          }
        : null,
    details: {
      brand: optional(draft.brand),
      inTheBox: draft.inTheBox.length > 0 ? draft.inTheBox : undefined,
      productType: draft.productType,
      dispatchDays: toAmount(draft.dispatchDays),
      personalisationNote: draft.personalisation ? optional(draft.personalisationNote) : undefined,
      isFood: draft.isFood,
      ...(draft.isFood
        ? {
            foodType: draft.foodType === '' ? undefined : draft.foodType,
            ingredients: optional(draft.ingredients),
            allergens: optional(draft.allergens),
            shelfLife: { value: toAmount(draft.shelfLifeValue), unit: draft.shelfLifeUnit },
            fssai: optional(draft.fssai),
            storage: optional(draft.storage),
          }
        : {}),
      material: optional(draft.material),
      origin: optional(draft.origin),
      gstRate: toAmount(draft.gstRate),
      hsn: optional(draft.hsn),
      returnPolicy: draft.returnPolicy,
    },
  };
};

// ---- the draft is kept on this device, so a refresh does not lose what the seller typed ----
const DRAFT_KEY = 'nyochavar_seller_product_draft_v1';

export const loadDraft = (storeName: string): ProductDraft => {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const draft = { ...emptyDraft(storeName), ...saved } as ProductDraft;
      // A draft saved before options had their own pictures kept one picture link in "image"
      draft.variants = (draft.variants ?? []).map((variant) => {
        const old = variant as VariantDraft & { image?: string };
        return { ...variant, images: Array.isArray(variant.images) ? variant.images : old.image ? [old.image] : [] };
      });
      return draft;
    }
  } catch {
    /* no saved draft */
  }
  return emptyDraft(storeName);
};

export const saveDraft = (draft: ProductDraft): void => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable: the draft just is not kept */
  }
};

export const clearDraft = (): void => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
};
