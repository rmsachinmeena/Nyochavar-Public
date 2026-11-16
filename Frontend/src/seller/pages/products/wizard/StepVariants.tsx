import React from 'react';
import { Check, Copy, Layers, Package, Plus, Trash2 } from 'lucide-react';
import {
  VARIANT_LIMITS,
  newVariant,
  toAmount,
  validateVariantRow,
  type DraftErrors,
  type ProductDraft,
  type VariantDraft,
} from './productFormState';
import { WizardField, inputClass } from './WizardParts';
import { VariantPhotos } from './VariantPhotos';

interface StepVariantsProps {
  draft: ProductDraft;
  errors: DraftErrors;
  onChange: (changes: Partial<ProductDraft>) => void;
  /** Adds one finished upload to the end of an option's pictures */
  onAddVariantImage: (variantId: string, url: string) => void;
  /** Tells the page whether an option's pictures are still uploading, so Continue waits for them */
  onVariantBusy: (variantId: string, busy: boolean) => void;
}

const SUGGESTED_LABELS = ['Size', 'Flavour', 'Colour', 'Weight', 'Pack of', 'Design'];

const cleanMoney = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const rupees = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const smallInput = (invalid?: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
    invalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : 'border-slate-200 hover:border-slate-300 focus:border-brand focus:ring-brand/15'
  }`;

const RowLabel: React.FC<{ htmlFor: string; text: string; error?: string; required?: boolean }> = ({ htmlFor, text, error, required }) => (
  <label htmlFor={htmlFor} className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700">
    <span>
      {text}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </span>
    {error && <span className="font-semibold text-rose-600">{error}</span>}
  </label>
);

/**
 * Step 4: options of the product (sizes, flavours, colours...). The product from the earlier steps is the first option;
 * each option added here has its own name, price, stock and (optionally) one of the product pictures.
 * The store's product page shows one row of options, so there is one option type per product.
 */
export const StepVariants: React.FC<StepVariantsProps> = ({ draft, errors, onChange, onAddVariantImage, onVariantBusy }) => {
  const showRowErrors = Boolean(errors.variants || errors.variantLabel);
  const mainPrice = toAmount(draft.price);

  const setVariant = (id: string, changes: Partial<VariantDraft>) =>
    onChange({ variants: draft.variants.map((variant) => (variant.id === id ? { ...variant, ...changes } : variant)) });

  const addVariant = (copyFrom?: VariantDraft) => {
    if (draft.variants.length >= VARIANT_LIMITS.max) return;
    // A copy keeps the price and stock, but not the name or the pictures (each option has its own)
    const next = copyFrom ? { ...copyFrom, id: newVariant().id, name: '', images: [] } : newVariant(draft.price);
    onChange({ variants: [...draft.variants, next] });
  };

  const choose = (hasVariants: boolean) => {
    if (hasVariants && draft.variants.length === 0) onChange({ hasVariants, variants: [newVariant(draft.price)] });
    else onChange({ hasVariants });
  };

  return (
    <div className="space-y-6">
      {/* Does the product come in options? */}
      <fieldset>
        <legend className="text-xs font-bold text-slate-800">Does your product come in different options?</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { value: false, icon: Package, title: 'No, just one', text: 'One version of the product, one price.' },
            { value: true, icon: Layers, title: 'Yes, it has options', text: 'For example sizes, flavours or colours, each with its own price.' },
          ].map((option) => {
            const selected = draft.hasVariants === option.value;
            const Icon = option.icon;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(option.value)}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                  selected ? 'border-brand bg-brand-soft/60' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{option.text}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {!draft.hasVariants && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          Nothing more to fill in here. Press Continue. You can add options later by editing the product.
        </p>
      )}

      {draft.hasVariants && (
        <>
          <WizardField
            id="wz-variantLabel"
            label="What are the options?"
            required
            error={errors.variantLabel}
            hint='This becomes the heading buyers see, for example "Select Size".'
            counter={`${draft.variantLabel.trim().length}/${VARIANT_LIMITS.label}`}
          >
            <input
              id="wz-variantLabel"
              type="text"
              value={draft.variantLabel}
              maxLength={VARIANT_LIMITS.label}
              onChange={(event) => onChange({ variantLabel: event.target.value })}
              placeholder="e.g. Size"
              className={inputClass(Boolean(errors.variantLabel))}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange({ variantLabel: label })}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    draft.variantLabel.trim().toLowerCase() === label.toLowerCase()
                      ? 'border-brand bg-brand text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </WizardField>

          <div className="rounded-xl border border-brand/20 bg-brand-soft/50 px-4 py-3 text-xs leading-relaxed text-slate-700">
            <strong className="text-ink">Your main product is the first option.</strong> It keeps the price ({mainPrice > 0 ? rupees(mainPrice) : 'from step 3'}) and stock from step 3.
            Add the other options below.
          </div>

          <div id="wz-variants" tabIndex={-1} className="space-y-4 outline-none">
            <div className="flex items-end justify-between">
              <p className="text-xs font-bold text-slate-800">
                Other options<span className="ml-0.5 text-rose-500">*</span>
              </p>
              <span className="text-[11px] font-medium text-slate-400">
                {draft.variants.length}/{VARIANT_LIMITS.max}
              </span>
            </div>

            {errors.variants && (
              <p role="alert" className="text-[11px] font-semibold text-rose-600">
                {errors.variants}
              </p>
            )}

            {draft.variants.map((variant, index) => {
              const rowErrors = showRowErrors
                ? validateVariantRow(variant, draft.variants.filter((_, i) => i !== index).map((other) => other.name))
                : {};
              return (
                <div key={variant.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Option {index + 2}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => addVariant(variant)}
                        disabled={draft.variants.length >= VARIANT_LIMITS.max}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove option ${index + 2}`}
                        onClick={() => onChange({ variants: draft.variants.filter((entry) => entry.id !== variant.id) })}
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="col-span-2 lg:col-span-4">
                      <RowLabel htmlFor={`${variant.id}-name`} text="Name" required error={rowErrors.name} />
                      <input
                        id={`${variant.id}-name`}
                        type="text"
                        value={variant.name}
                        maxLength={VARIANT_LIMITS.name}
                        placeholder={draft.variantLabel.trim() ? `e.g. ${draft.variantLabel.trim() === 'Size' ? '500 g' : `a ${draft.variantLabel.trim().toLowerCase()}`}` : 'e.g. 500 g'}
                        onChange={(event) => setVariant(variant.id, { name: event.target.value })}
                        className={smallInput(Boolean(rowErrors.name))}
                      />
                    </div>
                    <div>
                      <RowLabel htmlFor={`${variant.id}-price`} text="Price (₹)" required error={rowErrors.price} />
                      <input
                        id={`${variant.id}-price`}
                        type="text"
                        inputMode="decimal"
                        value={variant.price}
                        onChange={(event) => setVariant(variant.id, { price: cleanMoney(event.target.value) })}
                        className={smallInput(Boolean(rowErrors.price))}
                      />
                    </div>
                    <div>
                      <RowLabel htmlFor={`${variant.id}-mrp`} text="MRP (₹)" error={rowErrors.mrp} />
                      <input
                        id={`${variant.id}-mrp`}
                        type="text"
                        inputMode="decimal"
                        value={variant.mrp}
                        placeholder="Optional"
                        onChange={(event) => setVariant(variant.id, { mrp: cleanMoney(event.target.value) })}
                        className={smallInput(Boolean(rowErrors.mrp))}
                      />
                    </div>
                    <div>
                      <RowLabel htmlFor={`${variant.id}-stock`} text="Stock" required error={rowErrors.stock} />
                      <input
                        id={`${variant.id}-stock`}
                        type="text"
                        inputMode="numeric"
                        value={variant.stock}
                        onChange={(event) => setVariant(variant.id, { stock: event.target.value.replace(/\D/g, '') })}
                        className={smallInput(Boolean(rowErrors.stock))}
                      />
                    </div>
                    <div>
                      <RowLabel htmlFor={`${variant.id}-sku`} text="SKU" error={rowErrors.sku} />
                      <input
                        id={`${variant.id}-sku`}
                        type="text"
                        value={variant.sku}
                        placeholder="Optional"
                        onChange={(event) => setVariant(variant.id, { sku: event.target.value.toUpperCase() })}
                        className={`${smallInput(Boolean(rowErrors.sku))} font-mono`}
                      />
                    </div>
                  </div>

                  <VariantPhotos
                    variantId={variant.id}
                    images={variant.images}
                    productImages={draft.images}
                    onChange={(images) => setVariant(variant.id, { images })}
                    onAdd={onAddVariantImage}
                    onBusyChange={onVariantBusy}
                  />
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => addVariant()}
              disabled={draft.variants.length >= VARIANT_LIMITS.max}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft/30 py-3 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand-soft/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add another option
            </button>
          </div>

          {/* How buyers will pick */}
          {draft.variants.some((variant) => variant.name.trim()) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-800">How buyers will choose</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Select {draft.variantLabel.trim() || 'an option'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-lg border border-brand bg-brand-soft/60 px-3 py-1.5 text-[11px] font-bold text-brand">
                  Original{mainPrice > 0 ? ` · ${rupees(mainPrice)}` : ''}
                </span>
                {draft.variants
                  .filter((variant) => variant.name.trim())
                  .map((variant) => (
                    <span key={variant.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                      {variant.name.trim()}
                      {toAmount(variant.price) > 0 ? ` · ${rupees(toAmount(variant.price))}` : ''}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
