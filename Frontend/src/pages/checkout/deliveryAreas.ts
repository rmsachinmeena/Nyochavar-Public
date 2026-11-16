// Areas we deliver to for now (a fixed list, not stored in the database). Checkout only lets a customer pick one of these.
export const DELIVERY_AREAS = [
  'Near MDSU University',
  'Near Ajmer Railway Junction',
  'Near Ajmer Bus Stand',
  'Near Adarsh Nagar',
  'Near GCA College',
  'Near Vaishali',
  'Near Mittal Mall',
  'Near CSM Mall',
  'Near Gyaan Vihaar Gate',
  'Near Foysagar',
] as const;

export const isDeliveryArea = (value: string) => (DELIVERY_AREAS as readonly string[]).includes(value);
