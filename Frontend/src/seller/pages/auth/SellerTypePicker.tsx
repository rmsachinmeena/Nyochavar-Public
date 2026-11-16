import React from 'react';
import { SELLER_LOGIN_THEMES, type SellerLoginTheme } from './sellerLoginThemes';

interface SellerTypePickerProps {
  theme: SellerLoginTheme;
  onChange: (themeId: string) => void;
}

/**
 * "I sell ...": a row of chips, one per kind of seller. Picking one changes the colours, picture and words of the page.
 * Scrolls sideways on phones; wraps on wider screens.
 */
export const SellerTypePicker: React.FC<SellerTypePickerProps> = ({ theme, onChange }) => (
  <div>
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">I sell</p>
    <div
      role="radiogroup"
      aria-label="Kind of seller"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {SELLER_LOGIN_THEMES.map((option) => {
        const Icon = option.icon;
        const active = option.id === theme.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
              active ? 'text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
            style={active ? { backgroundColor: option.accent, borderColor: option.accent } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);
