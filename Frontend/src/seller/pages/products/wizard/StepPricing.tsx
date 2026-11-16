import React from 'react';
import { IndianRupee, PackageCheck, TrendingUp } from 'lucide-react';
import { PRICE_LIMITS, toAmount, type DraftErrors, type ProductDraft } from './productFormState';
import { WizardField, inputClass } from './WizardParts';

interface StepPricingProps {
  draft: ProductDraft;
  errors: DraftErrors;
  onChange: (changes: Partial<ProductDraft>) => void;
  /** Nyochavar's share of each sale, for example 0.1 for 10% */
  commissionRate: number;
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Keeps only what can be a price: digits and one dot with up to two decimals
const cleanMoney = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const MoneyField: React.FC<{
  id: string;
  value: string;
  invalid: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ id, value, invalid, placeholder, onChange }) => (
  <div className="relative">
    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">₹</span>
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(cleanMoney(event.target.value))}
      className={`${inputClass(invalid)} pl-8`}
    />
  </div>
);

/** Step 3: what the product costs, what the buyer sees, how many are in stock, and what the seller earns. */
export const StepPricing: React.FC<StepPricingProps> = ({ draft, errors, onChange, commissionRate }) => {
  const price = toAmount(draft.price);
  const mrp = toAmount(draft.mrp);
  const stock = draft.stock.trim() === '' ? null : toAmount(draft.stock);
  const commission = Math.round(price * commissionRate * 100) / 100;
  const earn = Math.max(0, Math.round((price - commission) * 100) / 100);
  const percentPaid = Math.round(commissionRate * 1000) / 10;
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <WizardField id="wz-price" label="Selling price" required error={errors.price} hint="What the buyer pays for one unit, including all taxes.">
          <MoneyField id="wz-price" value={draft.price} invalid={Boolean(errors.price)} placeholder="e.g. 999" onChange={(price) => onChange({ price })} />
        </WizardField>

        <WizardField
          id="wz-mrp"
          label="MRP (original price)"
          error={errors.mrp}
          hint={discount > 0 ? `Buyers will see ${discount}% OFF on your product.` : 'Optional. Fill it in to show a crossed-out price and a discount badge.'}
        >
          <MoneyField id="wz-mrp" value={draft.mrp} invalid={Boolean(errors.mrp)} placeholder="e.g. 1299" onChange={(mrp) => onChange({ mrp })} />
        </WizardField>
      </div>

      {/* What the seller earns, worked out live */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60">
        <div className="flex items-center gap-2 border-b border-emerald-200/70 px-4 py-2.5 text-xs font-bold text-emerald-900">
          <TrendingUp className="h-4 w-4" /> What you earn on each sale
        </div>
        <dl className="space-y-2 px-4 py-3.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Selling price</dt>
            <dd className="font-semibold text-slate-900">{price > 0 ? rupees(price) : '-'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Nyochavar commission ({percentPaid}%)</dt>
            <dd className="font-semibold text-rose-600">{price > 0 ? `- ${rupees(commission)}` : '-'}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-emerald-200/70 pt-2.5">
            <dt className="font-bold text-emerald-900">You earn</dt>
            <dd className="text-lg font-black text-emerald-700">{price > 0 ? rupees(earn) : '-'}</dd>
          </div>
        </dl>
        <p className="border-t border-emerald-200/70 px-4 py-2.5 text-[11px] leading-relaxed text-emerald-900/80">
          Delivery and payment charges are handled by Nyochavar. There is no other deduction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <WizardField id="wz-stock" label="Units in stock" required error={errors.stock} hint="How many you can send out right now. Enter 0 if none; buyers then see it as out of stock.">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <PackageCheck className="h-4 w-4" />
            </span>
            <input
              id="wz-stock"
              type="text"
              inputMode="numeric"
              value={draft.stock}
              placeholder="e.g. 25"
              maxLength={String(PRICE_LIMITS.maxStock).length}
              onChange={(event) => onChange({ stock: event.target.value.replace(/\D/g, '') })}
              className={`${inputClass(Boolean(errors.stock))} pl-10`}
            />
          </div>
          {stock !== null && stock > 0 && stock <= 5 && <p className="text-[11px] font-medium text-amber-700">Only a few left: remember to add stock when you can.</p>}
          {stock === 0 && <p className="text-[11px] font-medium text-amber-700">With 0 units the product shows as out of stock until you add more.</p>}
        </WizardField>

        <WizardField id="wz-sku" label="SKU / product code" error={errors.sku} hint="Your own code for this product, to find it quickly. Optional.">
          <input
            id="wz-sku"
            type="text"
            value={draft.sku}
            maxLength={PRICE_LIMITS.maxSku}
            placeholder="e.g. CHOC-12-DARK"
            onChange={(event) => onChange({ sku: event.target.value.toUpperCase() })}
            className={`${inputClass(Boolean(errors.sku))} font-mono`}
          />
        </WizardField>
      </div>

      <WizardField id="wz-weightGrams" label="Package weight (grams)" error={errors.weightGrams} hint="The weight of the packed product. Helps with delivery planning. Optional.">
        <div className="relative sm:max-w-xs">
          <input
            id="wz-weightGrams"
            type="text"
            inputMode="numeric"
            value={draft.weightGrams}
            placeholder="e.g. 650"
            onChange={(event) => onChange({ weightGrams: event.target.value.replace(/\D/g, '').slice(0, 7) })}
            className={`${inputClass(Boolean(errors.weightGrams))} pr-12`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-semibold text-slate-400">g</span>
        </div>
      </WizardField>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <IndianRupee className="h-3.5 w-3.5" /> You can change the price and stock later from your products list.
      </p>
    </div>
  );
};
