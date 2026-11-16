import React from 'react';
import { Check, Gift, Leaf, ReceiptText, Truck, Undo2, UtensilsCrossed } from 'lucide-react';
import {
  DETAIL_LIMITS,
  DISPATCH_OPTIONS,
  GST_RATES,
  type DraftErrors,
  type ProductDraft,
  type ProductType,
  type ReturnPolicy,
} from './productFormState';
import { WizardField, inputClass } from './WizardParts';

interface StepDetailsProps {
  draft: ProductDraft;
  errors: DraftErrors;
  onChange: (changes: Partial<ProductDraft>) => void;
}

const Card: React.FC<{ icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }> = ({ icon, title, hint, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white">
    <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>
      </div>
    </header>
    <div className="space-y-5 px-4 py-4">{children}</div>
  </section>
);

/** A row with a switch: a title, a line of explanation, and an on/off button. */
const Switch: React.FC<{ id: string; title: string; text: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ id, title, text, checked, onChange }) => (
  <div className="flex items-start justify-between gap-4">
    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{text}</span>
    </label>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-brand' : 'bg-slate-300'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

/** A set of choice buttons where exactly one is picked. */
function Choices<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; title: string; text?: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${options.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex cursor-pointer items-start justify-between gap-2 rounded-xl border-2 p-3 text-left transition ${
              selected ? 'border-brand bg-brand-soft/60' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{option.title}</span>
              {option.text && <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{option.text}</span>}
            </span>
            {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/** Step 5: how the product is fulfilled, its gifting options, and the product information the law and buyers expect. */
export const StepDetails: React.FC<StepDetailsProps> = ({ draft, errors, onChange }) => {
  const changeType = (productType: ProductType) =>
    // Each kind has its own dispatch choices, so a sensible one is picked for the new kind
    onChange({ productType, dispatchDays: productType === 'ready' ? '2' : '5' });

  return (
    <div className="space-y-5">
      {/* Fulfilment */}
      <Card icon={<Truck className="h-4 w-4" />} title="How you prepare it" hint="Tells buyers and our riders when to expect the parcel.">
        <Choices<ProductType>
          label="Kind of product"
          value={draft.productType}
          onChange={changeType}
          options={[
            { value: 'ready', title: 'Ready to ship', text: 'It is made and in stock. You pack and dispatch it.' },
            { value: 'made_to_order', title: 'Made to order', text: 'You make or personalise it after the order arrives.' },
          ]}
        />
        <WizardField
          id="wz-dispatchDays"
          label={draft.productType === 'ready' ? 'Dispatch time' : 'Time to make and dispatch'}
          required
          error={errors.dispatchDays}
          hint="Count from the moment the order arrives until the parcel is ready for the rider."
        >
          <select
            id="wz-dispatchDays"
            value={draft.dispatchDays}
            onChange={(event) => onChange({ dispatchDays: event.target.value })}
            className={inputClass(Boolean(errors.dispatchDays))}
          >
            {DISPATCH_OPTIONS[draft.productType].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </WizardField>
      </Card>

      {/* Gifting */}
      <Card icon={<Gift className="h-4 w-4" />} title="Gifting options" hint="What buyers can add when they send this as a gift.">
        <Switch
          id="wz-allowCustomNote"
          title="Gift message"
          text="Buyers can write a message that you print or hand-write on a card in the parcel."
          checked={draft.allowCustomNote}
          onChange={(allowCustomNote) => onChange({ allowCustomNote })}
        />
        <Switch id="wz-giftWrap" title="Gift wrapping" text="You can wrap this product as a gift." checked={draft.giftWrap} onChange={(giftWrap) => onChange({ giftWrap })} />
        <Switch
          id="wz-personalisation"
          title="Personalisation"
          text="You can customise it for the buyer, for example with a name, a photo or a date."
          checked={draft.personalisation}
          onChange={(personalisation) => onChange({ personalisation })}
        />
        {draft.personalisation && (
          <WizardField
            id="wz-personalisationNote"
            label="What can the buyer personalise?"
            required
            error={errors.personalisationNote}
            counter={`${draft.personalisationNote.trim().length}/${DETAIL_LIMITS.personalisationNote.max}`}
            hint="Be exact so buyers send what you need, for example: Name (up to 15 letters) printed on the box lid."
          >
            <textarea
              id="wz-personalisationNote"
              rows={3}
              value={draft.personalisationNote}
              maxLength={DETAIL_LIMITS.personalisationNote.max}
              onChange={(event) => onChange({ personalisationNote: event.target.value })}
              className={`${inputClass(Boolean(errors.personalisationNote))} resize-y leading-relaxed`}
            />
          </WizardField>
        )}
      </Card>

      {/* Food */}
      <Card icon={<UtensilsCrossed className="h-4 w-4" />} title="Food and drink" hint="Anything that is eaten or drunk needs extra details by law.">
        <Switch
          id="wz-isFood"
          title="This product is food or drink"
          text="Chocolates, sweets, dry fruits, cakes, hampers with food items and so on."
          checked={draft.isFood}
          onChange={(isFood) => onChange({ isFood })}
        />

        {draft.isFood && (
          <div className="space-y-5 border-t border-slate-100 pt-5">
            <div id="wz-foodType" tabIndex={-1} className="outline-none">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Leaf className="h-3.5 w-3.5 text-emerald-600" /> Veg or Non-veg<span className="text-rose-500">*</span>
              </p>
              <Choices<'veg' | 'non_veg' | ''>
                label="Veg or non-veg"
                value={draft.foodType}
                onChange={(foodType) => onChange({ foodType })}
                options={[
                  { value: 'veg', title: 'Vegetarian' },
                  { value: 'non_veg', title: 'Non-vegetarian' },
                ]}
              />
              {errors.foodType && <p role="alert" className="mt-1.5 text-[11px] font-semibold text-rose-600">{errors.foodType}</p>}
            </div>

            <WizardField
              id="wz-ingredients"
              label="Ingredients"
              required
              error={errors.ingredients}
              counter={`${draft.ingredients.trim().length}/${DETAIL_LIMITS.ingredients.max}`}
              hint="List everything in it, in order of quantity, as it is written on the pack."
            >
              <textarea
                id="wz-ingredients"
                rows={3}
                value={draft.ingredients}
                maxLength={DETAIL_LIMITS.ingredients.max}
                onChange={(event) => onChange({ ingredients: event.target.value })}
                className={`${inputClass(Boolean(errors.ingredients))} resize-y leading-relaxed`}
              />
            </WizardField>

            <WizardField id="wz-allergens" label="Allergy information" hint="For example: Contains nuts, milk and gluten. Optional.">
              <input
                id="wz-allergens"
                type="text"
                value={draft.allergens}
                maxLength={DETAIL_LIMITS.allergens}
                onChange={(event) => onChange({ allergens: event.target.value })}
                className={inputClass(false)}
              />
            </WizardField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <WizardField id="wz-shelfLifeValue" label="Shelf life" required error={errors.shelfLifeValue} hint="How long it stays fresh after it is made.">
                <div className="flex gap-2">
                  <input
                    id="wz-shelfLifeValue"
                    type="text"
                    inputMode="numeric"
                    value={draft.shelfLifeValue}
                    placeholder="e.g. 6"
                    onChange={(event) => onChange({ shelfLifeValue: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                    className={`${inputClass(Boolean(errors.shelfLifeValue))} min-w-0 flex-1`}
                  />
                  <select
                    aria-label="Shelf life unit"
                    value={draft.shelfLifeUnit}
                    onChange={(event) => onChange({ shelfLifeUnit: event.target.value as 'days' | 'months' })}
                    className={`${inputClass(false).replace('w-full', 'w-28')} shrink-0`}
                  >
                    <option value="days">days</option>
                    <option value="months">months</option>
                  </select>
                </div>
              </WizardField>

              <WizardField id="wz-fssai" label="FSSAI licence number" required error={errors.fssai} hint="The 14-digit number on your food licence. It is shown on the product page.">
                <input
                  id="wz-fssai"
                  type="text"
                  inputMode="numeric"
                  value={draft.fssai}
                  maxLength={14}
                  placeholder="14 digits"
                  onChange={(event) => onChange({ fssai: event.target.value.replace(/\D/g, '') })}
                  className={`${inputClass(Boolean(errors.fssai))} font-mono tracking-wider`}
                />
              </WizardField>
            </div>

            <WizardField id="wz-storage" label="How to store it" hint="For example: Keep in a cool, dry place. Optional.">
              <input
                id="wz-storage"
                type="text"
                value={draft.storage}
                maxLength={DETAIL_LIMITS.storage}
                onChange={(event) => onChange({ storage: event.target.value })}
                className={inputClass(false)}
              />
            </WizardField>
          </div>
        )}
      </Card>

      {/* Product information, tax and returns */}
      <Card icon={<ReceiptText className="h-4 w-4" />} title="Product information and tax" hint="Shown on the product page and used for your invoices.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <WizardField id="wz-origin" label="Country of origin" required error={errors.origin} hint="Where the product is made.">
            <input
              id="wz-origin"
              type="text"
              value={draft.origin}
              maxLength={DETAIL_LIMITS.origin}
              onChange={(event) => onChange({ origin: event.target.value })}
              className={inputClass(Boolean(errors.origin))}
            />
          </WizardField>

          <WizardField id="wz-material" label="Made of" hint="Main material, for example: Brass, velvet, soy wax. Optional.">
            <input
              id="wz-material"
              type="text"
              value={draft.material}
              maxLength={DETAIL_LIMITS.material}
              onChange={(event) => onChange({ material: event.target.value })}
              className={inputClass(false)}
            />
          </WizardField>

          <WizardField id="wz-gstRate" label="GST rate" required error={errors.gstRate} hint="The GST that applies to this product. Your selling price already includes it.">
            <select id="wz-gstRate" value={draft.gstRate} onChange={(event) => onChange({ gstRate: event.target.value })} className={inputClass(Boolean(errors.gstRate))}>
              <option value="">Choose GST rate</option>
              {GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </WizardField>

          <WizardField id="wz-hsn" label="HSN code" error={errors.hsn} hint="The 4 to 8 digit tax code of the product. Optional.">
            <input
              id="wz-hsn"
              type="text"
              inputMode="numeric"
              value={draft.hsn}
              maxLength={8}
              onChange={(event) => onChange({ hsn: event.target.value.replace(/\D/g, '') })}
              className={`${inputClass(Boolean(errors.hsn))} font-mono`}
            />
          </WizardField>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Undo2 className="h-3.5 w-3.5 text-slate-500" /> Returns<span className="text-rose-500">*</span>
          </p>
          <Choices<ReturnPolicy>
            label="Return policy"
            value={draft.returnPolicy}
            onChange={(returnPolicy) => onChange({ returnPolicy })}
            options={[
              { value: 'damaged', title: 'Replace if damaged', text: 'A replacement if it arrives damaged or wrong.' },
              { value: 'seven_days', title: '7-day return', text: 'Buyers can return it within 7 days of delivery.' },
              { value: 'none', title: 'No returns', text: 'For perishable or made-to-order items.' },
            ]}
          />
          {(draft.isFood || draft.productType === 'made_to_order' || draft.personalisation) && draft.returnPolicy === 'seven_days' && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              Food, made-to-order and personalised items usually cannot be returned. Check that a 7-day return suits this product.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
