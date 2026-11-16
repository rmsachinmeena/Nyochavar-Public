import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/**
 * Small pieces shared by the seller login screens. Colours come from CSS variables that the page sets from the chosen
 * seller type (--seller-accent, --seller-accent-dark, --seller-soft), so one set of styles serves every theme.
 */
export const SELLER_AUTH_STYLES = `
.seller-field { transition: border-color .15s, box-shadow .15s, background-color .15s; }
.seller-field:focus { outline: none; border-color: var(--seller-accent); background-color: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-accent) 18%, transparent); }
.seller-field[aria-invalid="true"] { border-color: #ef4444; box-shadow: 0 0 0 3px rgb(239 68 68 / .12); }
.seller-primary { background-color: var(--seller-accent); transition: background-color .15s, transform .1s, box-shadow .15s; box-shadow: 0 10px 22px -10px var(--seller-accent); }
.seller-primary:hover:not(:disabled) { background-color: var(--seller-accent-dark); }
.seller-primary:active:not(:disabled) { transform: scale(.985); }
.seller-primary:disabled { background-color: #94a3b8; box-shadow: none; cursor: not-allowed; }
.seller-link { color: var(--seller-accent); }
.seller-link:hover { color: var(--seller-accent-dark); text-decoration: underline; }
`;

const INPUT_BASE =
  'seller-field block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-base text-slate-900 placeholder:text-slate-400 hover:bg-white sm:text-sm';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Something at the right end of the field, for example a "show" button */
  trailing?: React.ReactNode;
  /** Small line under the field */
  hint?: string;
  invalid?: boolean;
  /** Something at the right end of the label row, for example a "Forgot password?" link */
  labelAction?: React.ReactNode;
}

export const SellerTextField: React.FC<TextFieldProps> = ({ id, label, icon, trailing, hint, invalid, labelAction, ...input }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {labelAction}
    </div>
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">{icon}</span>
      <input id={id} aria-invalid={invalid || undefined} {...input} className={`${INPUT_BASE} pl-10 ${trailing ? 'pr-12' : 'pr-3.5'}`} />
      {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
    </div>
    {hint && <p className="pl-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

type PasswordFieldProps = Omit<TextFieldProps, 'icon' | 'trailing' | 'type'>;

export const SellerPasswordField: React.FC<PasswordFieldProps> = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <SellerTextField
      {...props}
      type={visible ? 'text' : 'password'}
      icon={<Lock className="h-4 w-4" />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
};
