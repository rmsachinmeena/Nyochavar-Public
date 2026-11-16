import { Occasion, ProductAddon, ProductVariant } from './product';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: Pick<ProductVariant, 'id' | 'name'>;
  selectedHue?: string;
  message?: string;
  addons?: ProductAddon[];
  deliveryDate?: string;
  deliverySlot?: string;
  customPhoto?: string;
  palette?: string;
}

export interface BuilderState {
  occasion: Occasion;
  customPhoto: string | null;
  sentimentNote: string;
  themePalette: 'blush' | 'ocean' | 'champagne';
  budget: number;
}
