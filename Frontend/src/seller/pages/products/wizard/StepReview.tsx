import React from 'react';
import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
import { cloudinaryOptimized } from '../../../../utils/imageAssets';
import { WIZARD_STEPS, toAmount, type ProductDraft, type StepId } from './productFormState';

export interface Confirmations {
  accurate: boolean;
  rights: boolean;
  fssai: boolean;
}

interface StepReviewProps {
  draft: ProductDraft;
  /** How many things are wrong in each earlier step (a step with 0 is fine) */
  problems: Partial<Record<StepId, number>>;
  confirmations: Confirmations;
  onConfirm: (changes: Partial<Confirmations>) => void;
  onEdit: (step: StepId) => void;
  commissionRate: number;
  publishError: string | null;
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const RETURN_TEXT = {
  damaged: 'Replace if damaged',
  seven_days: '7-day return',
  none: 'No returns',
} as const;

const Section: React.FC<{ step: StepId; problems: number; onEdit: (step: StepId) => void; children: React.ReactNode }> = ({ step, problems, onEdit, children }) => {
  const meta = WIZARD_STEPS.find((candidate) => candidate.id === step)!;
  const Icon = meta.icon;
  return (
    <section className={`rounded-2xl border bg-white ${problems > 0 ? 'border-rose-300' : 'border-slate-200'}`}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {meta.title}
        </h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </header>
      {problems > 0 && (
        <p role="alert" className="flex items-center gap-1.5 bg-rose-50 px-4 py-2 text-[11px] font-semibold text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {problems === 1 ? '1 thing needs fixing here.' : `${problems} things need fixing here.`} Press Edit.
        </p>
      )}
      <div className="space-y-2.5 px-4 py-3.5 text-sm">{children}</div>
    </section>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-sm font-medium text-ink">{children}</dd>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; tone?: 'brand' | 'plain' }> = ({ children, tone = 'plain' }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone === 'brand' ? 'bg-brand-soft text-brand' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>{children}</span>
);

/** Step 6: everything the seller entered in one place, with a way back to fix any part, and the confirmations before publishing. */
export const StepReview: React.FC<StepReviewProps> = ({ draft, problems, confirmations, onConfirm, onEdit, commissionRate, publishError }) => {
  const price = toAmount(draft.price);
  const mrp = toAmount(draft.mrp);
  const earn = Math.max(0, Math.round((price - price * commissionRate) * 100) / 100);
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const totalProblems = (Object.values(problems) as Array<number | undefined>).reduce<number>((sum, count) => sum + (count ?? 0), 0);

  return (
    <div className="space-y-4">
      {totalProblems > 0 ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          Some steps are not complete yet. Press Edit on the sections marked in red, then come back here.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          Everything is filled in. Look it over once, then publish.
        </p>
      )}

      <Section step="basics" problems={problems.basics ?? 0} onEdit={onEdit}>
        <dl className="space-y-2.5">
          <Row label="Name">{draft.title.trim() || '-'}</Row>
          <Row label="Category">{draft.category || '-'}</Row>
          <Row label="Brand">{draft.brand.trim() || '-'}</Row>
          {draft.tagline.trim() && <Row label="Tagline">{draft.tagline.trim()}</Row>}
          <Row label="Description">
            <span className="line-clamp-4 whitespace-pre-line font-normal text-slate-600">{draft.description.trim() || '-'}</span>
          </Row>
          {draft.inTheBox.length > 0 && (
            <Row label="In the box">
              <span className="flex flex-wrap gap-1.5">{draft.inTheBox.map((item) => <Chip key={item}>{item}</Chip>)}</span>
            </Row>
          )}
          {draft.occasions.length > 0 && (
            <Row label="Occasions">
              <span className="flex flex-wrap gap-1.5">{draft.occasions.map((occasion) => <Chip key={occasion} tone="brand">{occasion}</Chip>)}</span>
            </Row>
          )}
        </dl>
      </Section>

      <Section step="photos" problems={problems.photos ?? 0} onEdit={onEdit}>
        {draft.images.length === 0 ? (
          <p className="text-slate-500">No pictures yet.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {draft.images.map((url, index) => (
              <li key={url} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img src={cloudinaryOptimized(url, 200)} alt={`Picture ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {index === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[9px] font-bold text-white">Cover</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section step="pricing" problems={problems.pricing ?? 0} onEdit={onEdit}>
        <dl className="space-y-2.5">
          <Row label="Selling price">
            {price > 0 ? rupees(price) : '-'}
            {discount > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                <s>{rupees(mrp)}</s> <span className="font-bold text-emerald-600">{discount}% OFF</span>
              </span>
            )}
          </Row>
          <Row label="You earn">{price > 0 ? `${rupees(earn)} per sale (after ${Math.round(commissionRate * 1000) / 10}% commission)` : '-'}</Row>
          <Row label="Stock">{draft.stock.trim() === '' ? '-' : `${toAmount(draft.stock).toLocaleString('en-IN')} units`}</Row>
          {draft.sku.trim() && <Row label="SKU">{draft.sku.trim()}</Row>}
          {draft.weightGrams.trim() && <Row label="Weight">{toAmount(draft.weightGrams).toLocaleString('en-IN')} g</Row>}
        </dl>
      </Section>

      <Section step="variants" problems={problems.variants ?? 0} onEdit={onEdit}>
        {!draft.hasVariants || draft.variants.length === 0 ? (
          <p className="text-slate-500">No options: one version of the product.</p>
        ) : (
          <>
            <p className="text-xs font-bold text-slate-500">Select {draft.variantLabel.trim() || 'an option'}</p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              <li className="flex items-center justify-between gap-3 bg-brand-soft/40 px-3 py-2 text-xs">
                <span className="font-bold text-ink">Original (main product)</span>
                <span className="text-slate-600">{price > 0 ? rupees(price) : '-'} · {draft.stock.trim() || 0} in stock</span>
              </li>
              {draft.variants.map((variant) => (
                <li key={variant.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-bold text-ink">{variant.name.trim() || 'Unnamed option'}</span>
                  <span className="shrink-0 text-slate-600">
                    {toAmount(variant.price) > 0 ? rupees(toAmount(variant.price)) : '-'} · {variant.stock.trim() || 0} in stock
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section step="details" problems={problems.details ?? 0} onEdit={onEdit}>
        <dl className="space-y-2.5">
          <Row label="Preparation">
            {draft.productType === 'ready' ? 'Ready to ship' : 'Made to order'} ·{' '}
            {draft.dispatchDays === '0' ? 'same day' : `${draft.dispatchDays} day${draft.dispatchDays === '1' ? '' : 's'}`}
          </Row>
          <Row label="Gifting">
            <span className="flex flex-wrap gap-1.5">
              {!draft.allowCustomNote && !draft.giftWrap && !draft.personalisation && <span className="font-normal text-slate-500">None</span>}
              {draft.allowCustomNote && <Chip>Gift message</Chip>}
              {draft.giftWrap && <Chip>Gift wrapping</Chip>}
              {draft.personalisation && <Chip>Personalisation</Chip>}
            </span>
          </Row>
          {draft.personalisation && draft.personalisationNote.trim() && <Row label="Personalise">{draft.personalisationNote.trim()}</Row>}
          {draft.isFood && (
            <>
              <Row label="Food">{draft.foodType === 'veg' ? 'Vegetarian' : draft.foodType === 'non_veg' ? 'Non-vegetarian' : '-'}</Row>
              <Row label="Ingredients"><span className="line-clamp-3 font-normal text-slate-600">{draft.ingredients.trim() || '-'}</span></Row>
              {draft.allergens.trim() && <Row label="Allergy info">{draft.allergens.trim()}</Row>}
              <Row label="Shelf life">{draft.shelfLifeValue ? `${draft.shelfLifeValue} ${draft.shelfLifeUnit}` : '-'}</Row>
              <Row label="FSSAI licence"><span className="font-mono">{draft.fssai || '-'}</span></Row>
              {draft.storage.trim() && <Row label="Storage">{draft.storage.trim()}</Row>}
            </>
          )}
          <Row label="Made in">{draft.origin.trim() || '-'}</Row>
          {draft.material.trim() && <Row label="Made of">{draft.material.trim()}</Row>}
          <Row label="GST">{draft.gstRate ? `${draft.gstRate}%` : '-'}{draft.hsn.trim() ? ` · HSN ${draft.hsn.trim()}` : ''}</Row>
          <Row label="Returns">{RETURN_TEXT[draft.returnPolicy]}</Row>
        </dl>
      </Section>

      {/* Before going live, the seller confirms */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <h3 className="text-sm font-bold text-ink">Before you publish</h3>
        <div className="mt-3 space-y-3">
          {[
            { key: 'accurate' as const, text: 'I confirm that the details and prices I entered are correct and I will fulfil every order for this product.', show: true },
            { key: 'rights' as const, text: 'I have the right to sell this product and to use these pictures and text.', show: true },
            { key: 'fssai' as const, text: 'I hold a valid FSSAI licence for this food product and the number I entered is mine.', show: draft.isFood },
          ]
            .filter((item) => item.show)
            .map((item) => (
              <label key={item.key} className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmations[item.key]}
                  onChange={(event) => onConfirm({ [item.key]: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span>{item.text}</span>
              </label>
            ))}
        </div>
      </section>

      {publishError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" /> {publishError}
        </p>
      )}
    </div>
  );
};
