import React from 'react';

// Vector pictures for the order messages, drawn in the shop's blue theme (no image files to download).
const BLUE = '#0052ff';
const BLUE_DARK = '#0041cc';
const BLUE_SOFT = '#eef4ff';
const BLUE_MID = '#cfe0ff';
const INK = '#0f172a';
const SKIN = '#f5c9a4';
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

type FrameProps = { title: string; subtitle: string; children: React.ReactNode };

const Frame: React.FC<FrameProps> = ({ title, subtitle, children }) => (
  <svg viewBox="0 0 320 160" role="img" aria-label={title} className="block h-auto w-full rounded-2xl">
    <rect width="320" height="160" fill={BLUE_SOFT} />
    {children}
    <text x="160" y="132" textAnchor="middle" fontFamily={FONT} fontSize="15" fontWeight="800" fill={BLUE_DARK}>
      {title}
    </text>
    <text x="160" y="148" textAnchor="middle" fontFamily={FONT} fontSize="9.5" fontWeight="600" fill={BLUE} opacity="0.75">
      {subtitle}
    </text>
  </svg>
);

const Parcel: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect width="34" height="28" rx="3" fill="#fff" stroke={BLUE} strokeWidth="2" />
    <rect x="14" width="6" height="28" fill={BLUE} />
    <path d="M17 0c-6-9-14-4-9 0zM17 0c6-9 14-4 9 0z" fill={BLUE_DARK} />
  </g>
);

const Sparkles: React.FC = () => (
  <g fill={BLUE} opacity="0.35">
    <circle cx="40" cy="30" r="3" />
    <circle cx="282" cy="40" r="2.5" />
    <circle cx="256" cy="18" r="2" />
    <circle cx="64" cy="76" r="2" />
    <path d="M290 84l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
  </g>
);

/** Order confirmed: a gift box with a tick. */
export const OrderConfirmedArt: React.FC = () => (
  <Frame title="Order Confirmed" subtitle="We are getting your gift ready">
    <Sparkles />
    <ellipse cx="160" cy="112" rx="58" ry="6" fill={BLUE_MID} />
    <rect x="118" y="58" width="84" height="52" rx="6" fill="#fff" stroke={BLUE} strokeWidth="3" />
    <rect x="112" y="46" width="96" height="18" rx="5" fill={BLUE} />
    <rect x="152" y="46" width="16" height="64" fill={BLUE_DARK} />
    <path d="M160 46c-14-24-34-12-24 0zM160 46c14-24 34-12 24 0z" fill="none" stroke={BLUE_DARK} strokeWidth="3" strokeLinejoin="round" />
    <circle cx="206" cy="58" r="17" fill="#16a34a" stroke="#fff" strokeWidth="3" />
    <path d="M198 58l6 6 11-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

/** Delivery partner assigned: the rider with helmet and a name badge, parcel ready. */
export const RiderAssignedArt: React.FC = () => (
  <Frame title="Delivery Partner Assigned" subtitle="Your rider is getting ready to pick up">
    <Sparkles />
    <ellipse cx="160" cy="116" rx="46" ry="5" fill={BLUE_MID} />
    {/* body */}
    <path d="M128 112v-30c0-10 8-18 18-18h28c10 0 18 8 18 18v30z" fill={BLUE} />
    <path d="M150 64l10 14 10-14z" fill="#fff" />
    <rect x="148" y="86" width="24" height="14" rx="3" fill="#fff" />
    <rect x="152" y="90" width="16" height="2.5" rx="1" fill={BLUE} />
    <rect x="152" y="95" width="10" height="2.5" rx="1" fill={BLUE_MID} />
    {/* head and helmet */}
    <circle cx="160" cy="44" r="16" fill={SKIN} />
    <path d="M143 44c0-20 34-20 34 0z" fill={INK} />
    <rect x="145" y="42" width="30" height="5" rx="2" fill={BLUE_DARK} />
    <circle cx="154" cy="52" r="1.6" fill={INK} />
    <circle cx="166" cy="52" r="1.6" fill={INK} />
    <path d="M155 58q5 4 10 0" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    <Parcel x="212" y="78" />
    <Parcel x="76" y="86" s={0.8} />
  </Frame>
);

/** Out for delivery: rider on a scooter with a parcel, a faint brand name, and a parcel pin on a map. */
export const OutForDeliveryArt: React.FC = () => (
  <Frame title="Out for Delivery" subtitle="Your parcel is on its way">
    {/* map */}
    <g stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round">
      <path d="M0 40h120l30 30h170" />
      <path d="M70 0v80M230 0v60" />
      <path d="M0 98h320" />
    </g>
    <g fill={BLUE_MID} opacity="0.7">
      <rect x="8" y="8" width="52" height="24" rx="4" />
      <rect x="250" y="10" width="56" height="30" rx="4" />
      <rect x="84" y="50" width="40" height="20" rx="4" />
    </g>
    <path d="M40 104C90 104 120 84 170 82S250 70 272 56" fill="none" stroke={BLUE} strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
    {/* destination pin with parcel */}
    <g transform="translate(272 22)">
      <path d="M0 44C-12 28-18 22-18 12a18 18 0 0 1 36 0c0 10-6 16-18 32z" fill={BLUE} stroke="#fff" strokeWidth="2.5" />
      <rect x="-8" y="5" width="16" height="13" rx="2" fill="#fff" />
      <rect x="-1.5" y="5" width="3" height="13" fill={BLUE} />
    </g>
    {/* faint brand name */}
    <text x="20" y="22" fontFamily={FONT} fontSize="11" fontWeight="800" fill={BLUE_DARK} opacity="0.35" letterSpacing="1">
      NYOCHAVAR
    </text>
    {/* scooter */}
    <g transform="translate(86 46)">
      <circle cx="16" cy="48" r="11" fill={INK} />
      <circle cx="16" cy="48" r="4.5" fill="#cbd5e1" />
      <circle cx="86" cy="48" r="11" fill={INK} />
      <circle cx="86" cy="48" r="4.5" fill="#cbd5e1" />
      <path d="M16 48h18l6-18h30l8 18h8" fill="none" stroke={BLUE_DARK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M26 40h42c6 0 10 4 10 8H20z" fill={BLUE} />
      <path d="M78 48l-6-34h-8M62 14h18" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* rider */}
      <path d="M40 34l8-22h14l-4 22z" fill={BLUE_DARK} />
      <path d="M60 18l16-2" stroke={BLUE_DARK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="52" cy="2" r="9" fill={SKIN} />
      <path d="M43 2c0-12 18-12 18 0z" fill={INK} />
      {/* parcel box on the back */}
      <rect x="-6" y="14" width="30" height="24" rx="3" fill="#fff" stroke={BLUE} strokeWidth="2.5" />
      <rect x="6" y="14" width="6" height="24" fill={BLUE} />
    </g>
  </Frame>
);

/** Delivered: the rider hands the parcel to the customer outside the door. */
export const DeliveredArt: React.FC = () => (
  <Frame title="Delivered" subtitle="Your gift has reached you. Enjoy!">
    <Sparkles />
    {/* house wall, door, step */}
    <rect x="196" y="22" width="100" height="94" rx="4" fill="#fff" stroke={BLUE_MID} strokeWidth="2" />
    <rect x="222" y="44" width="48" height="72" rx="3" fill={BLUE} />
    <circle cx="262" cy="82" r="2.6" fill="#fff" />
    <rect x="228" y="52" width="36" height="18" rx="2" fill={BLUE_DARK} opacity="0.5" />
    <rect x="186" y="114" width="120" height="6" rx="2" fill={BLUE_MID} />
    {/* rider */}
    <g transform="translate(70 0)">
      <path d="M0 114V80c0-9 7-16 16-16h14c9 0 16 7 16 16v34z" fill={BLUE} />
      <circle cx="23" cy="48" r="14" fill={SKIN} />
      <path d="M9 48c0-18 28-18 28 0z" fill={INK} />
      <circle cx="18" cy="53" r="1.5" fill={INK} />
      <circle cx="28" cy="53" r="1.5" fill={INK} />
      <path d="M19 58q4 3 8 0" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M44 84l30-6" stroke={BLUE} strokeWidth="9" strokeLinecap="round" />
    </g>
    {/* parcel in hand */}
    <Parcel x="142" y="64" s={0.95} />
    {/* customer */}
    <g transform="translate(160 0)">
      <path d="M0 114V84c0-8 6-14 14-14h12c8 0 14 6 14 14v30z" fill="#16a34a" />
      <circle cx="20" cy="56" r="13" fill={SKIN} />
      <path d="M6 54c0-16 28-16 28 2c-4-6-22-8-28-2z" fill="#7c2d12" />
      <circle cx="15.5" cy="58" r="1.4" fill={INK} />
      <circle cx="24.5" cy="58" r="1.4" fill={INK} />
      <path d="M16 63q4 3 8 0" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M-6 88l-14-6" stroke="#16a34a" strokeWidth="8" strokeLinecap="round" />
    </g>
    <circle cx="48" cy="40" r="15" fill="#16a34a" stroke="#fff" strokeWidth="3" />
    <path d="M41 40l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

const BY_EVENT: Record<string, React.FC> = {
  order_placed: OrderConfirmedArt,
  rider_assigned: RiderAssignedArt,
  out_for_delivery: OutForDeliveryArt,
  delivered: DeliveredArt,
};

/** The picture for a notification, or nothing for messages that have none. */
export const OrderEventArt: React.FC<{ eventKey?: string | null }> = ({ eventKey }) => {
  const Art = eventKey ? BY_EVENT[eventKey] : undefined;
  return Art ? <Art /> : null;
};
