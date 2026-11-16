// Areas we deliver to (Ajmer). Must stay the same as Frontend/src/pages/checkout/deliveryAreas.ts: the checkout only
// offers these, and the server refuses any other area so an edited request cannot order to an address we cannot serve.
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
  'Near Foysagar'
];

export const isDeliveryArea = (value) => DELIVERY_AREAS.includes(String(value || '').trim());
