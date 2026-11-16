import React from 'react';
import { Leaf } from 'lucide-react';
import type { ProductDetails } from '../../types/product';

const RETURNS: Record<NonNullable<ProductDetails['returnPolicy']>, string> = {
  damaged: 'Replacement if it arrives damaged or wrong',
  seven_days: '7-day return',
  none: 'No returns (a replacement only if it arrives damaged)',
};

const dispatchText = (details: ProductDetails): string | null => {
  if (details.dispatchDays === undefined) return null;
  const when = details.dispatchDays === 0 ? 'the same day' : `${details.dispatchDays} day${details.dispatchDays === 1 ? '' : 's'}`;
  return details.productType === 'made_to_order' ? `Made to order: ready in ${when}` : `Dispatched within ${when}`;
};

/**
 * "Product information": what a seller told us about the product (what is in the box, ingredients, shelf life, licence,
 * origin, returns...). Only the parts that were filled in are shown, and nothing at all when there is nothing to show.
 */
export const ProductInformation: React.FC<{ details?: ProductDetails }> = ({ details }) => {
  if (!details) return null;

  const rows: Array<[string, React.ReactNode]> = [];
  if (details.brand) rows.push(['Brand', details.brand]);
  if (details.origin) rows.push(['Made in', details.origin]);
  if (details.material) rows.push(['Made of', details.material]);
  const dispatch = dispatchText(details);
  if (dispatch) rows.push(['Preparation', dispatch]);
  if (details.shelfLife) rows.push(['Shelf life', `${details.shelfLife.value} ${details.shelfLife.unit === 'days' ? (details.shelfLife.value === 1 ? 'day' : 'days') : details.shelfLife.value === 1 ? 'month' : 'months'}`]);
  if (details.storage) rows.push(['Storage', details.storage]);
  if (details.fssai) rows.push(['FSSAI licence', <span key="fssai" className="font-mono">{details.fssai}</span>]);
  if (details.personalisationNote) rows.push(['Personalisation', details.personalisationNote]);
  if (details.returnPolicy) rows.push(['Returns', RETURNS[details.returnPolicy]]);

  const hasBox = Array.isArray(details.inTheBox) && details.inTheBox.length > 0;
  if (rows.length === 0 && !hasBox && !details.ingredients) return null;

  return (
    <section aria-labelledby="product-information-heading" className="mt-8 sm:mt-10">
      <h2 id="product-information-heading" className="flex flex-wrap items-center gap-3 text-lg font-semibold text-ink">
        Product information
        {details.isFood && details.foodType && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              details.foodType === 'veg' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'
            }`}
          >
            <Leaf className="h-3.5 w-3.5" />
            {details.foodType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
          </span>
        )}
      </h2>

      {hasBox && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-ink">What is in the box</h3>
          <ul className="mt-2 grid gap-1.5 text-[15px] text-slate-600 sm:grid-cols-2">
            {details.inTheBox!.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {details.ingredients && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">Ingredients</h3>
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{details.ingredients}</p>
          {details.allergens && <p className="mt-2 text-sm font-medium text-amber-700">Allergy information: {details.allergens}</p>}
        </div>
      )}
    </section>
  );
};

export default ProductInformation;
