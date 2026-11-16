import type { LucideIcon } from 'lucide-react';
import { Flame, Flower2, Gift, NotebookPen, PartyPopper, PenLine, Shirt, Cookie } from 'lucide-react';

/**
 * Picture and words of the seller login page for each kind of seller (the same kinds as the seller register page).
 * To change a picture or a line, edit it here: the page itself never needs touching.
 * The pictures are placeholders from Unsplash; swap them for our own Cloudinary pictures when we have them.
 */
export interface SellerLoginTheme {
  id: string;
  /** Matches an entry of `sellerCategories` (seller/data/mockSellerData.ts) */
  label: string;
  icon: LucideIcon;
  /** Big line on the picture */
  headline: string;
  /** Small paragraph under it */
  subtext: string;
  /** Three short selling points */
  points: [string, string, string];
  image: string;
  /** Colours: the same blue + white for every kind of seller */
  accent: string;
  accentDark: string;
  soft: string;
  overlay: string;
}

/** The site's own theme (blue + white, --color-brand in index.css): every kind of seller uses it, only the picture and the words change. */
const BLUE_AND_WHITE = {
  accent: '#0052FF',
  accentDark: '#0041CC',
  soft: '#EEF4FF',
  /** Deep navy laid over the picture so the white words stay readable */
  overlay: '#0A1738',
};

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1400&auto=format&fit=crop&q=80`;

export const SELLER_LOGIN_THEMES: SellerLoginTheme[] = [
  {
    id: 'luxury-hampers',
    label: 'Luxury Hampers',
    icon: Gift,
    headline: 'Your hampers, ready for every celebration',
    subtext: 'Manage curated gift boxes, festive bundles and premium packaging from one place.',
    points: ['List hampers in minutes', 'Premium buyers, repeat orders', 'Fast payouts every week'],
    image: photo('1549465220-1a8b9238cd48'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'chocolates-gourmet',
    label: 'Chocolates & Gourmet',
    icon: Cookie,
    headline: 'Sweeten every order that comes in',
    subtext: 'Keep your chocolates, mithai and gourmet treats in stock and out for delivery on time.',
    points: ['Same-day delivery slots', 'Freshness-first order alerts', 'Gifting season ready'],
    image: photo('1513201099705-a9746e1e201f'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'customized-keepsakes',
    label: 'Customized Keepsakes',
    icon: PenLine,
    headline: 'Make every keepsake personal',
    subtext: 'Handle names, photos and custom notes for personalised gifts, and ship them with care.',
    points: ['Custom note on every order', 'Approve designs before dispatch', 'Gift buyers who love detail'],
    image: photo('1513519245088-0e12902e5a38'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'home-fragrances',
    label: 'Home & Fragrances',
    icon: Flame,
    headline: 'Bring warmth to every home',
    subtext: 'Candles, diffusers and home decor: track your orders and your stock in one calm dashboard.',
    points: ['Simple stock tracking', 'Beautiful product pages', 'Clear, on-time payouts'],
    image: photo('1603006905003-be475563bc59'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'flowers-plants',
    label: 'Flowers & Plants',
    icon: Flower2,
    headline: 'Fresh blooms, delivered with love',
    subtext: 'Bouquets and plants need speed. See new orders the moment they arrive and plan your day.',
    points: ['Instant new-order alerts', 'Time-slot deliveries', 'Built for fresh produce'],
    image: photo('1561181286-d3fee7d55364'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'stationery-keepsakes',
    label: 'Stationery & Keepsakes',
    icon: NotebookPen,
    headline: 'Thoughtful little things, big orders',
    subtext: 'Diaries, pens and keepsakes: list them once and let gift buyers find you all year round.',
    points: ['Easy bulk product upload', 'Corporate gifting buyers', 'Order and payout reports'],
    image: photo('1512909006721-3d6018887383'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'fashion-accessories',
    label: 'Fashion & Personal Accessories',
    icon: Shirt,
    headline: 'Style that makes the perfect gift',
    subtext: 'Accessories, perfumes and fashion gifts: manage sizes, stock and returns without the mess.',
    points: ['Variant and stock control', 'Gift-ready packaging tips', 'Transparent commission'],
    image: photo('1522335789203-aabd1fc54bc9'),
    ...BLUE_AND_WHITE,
  },
  {
    id: 'festive-traditional',
    label: 'Festive & Traditional Gifts',
    icon: PartyPopper,
    headline: 'Celebrate every festival with us',
    subtext: 'From Diwali to Raksha Bandhan, be ready for the festive rush with orders handled in one place.',
    points: ['Festival-season campaigns', 'Bulk and corporate orders', 'Priority seller support'],
    image: photo('1513151233558-d860c5398176'),
    ...BLUE_AND_WHITE,
  },
];

export const DEFAULT_SELLER_THEME_ID = SELLER_LOGIN_THEMES[0].id;

export const getSellerLoginTheme = (id: string | null | undefined): SellerLoginTheme =>
  SELLER_LOGIN_THEMES.find((theme) => theme.id === id) ?? SELLER_LOGIN_THEMES[0];
