import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { OCCASION_META } from '../../../../utils/occasionUtils';
import { LIMITS, type DraftErrors, type ProductDraft } from './productFormState';
import { WizardField, inputClass } from './WizardParts';

interface StepBasicsProps {
  draft: ProductDraft;
  errors: DraftErrors;
  onChange: (changes: Partial<ProductDraft>) => void;
  /** The store's own categories, fetched from the server */
  categories: Array<{ id: string; name: string }>;
  categoriesLoaded: boolean;
}

/** Step 1: what the product is called, where it is listed, and what the buyer gets. */
export const StepBasics: React.FC<StepBasicsProps> = ({ draft, errors, onChange, categories, categoriesLoaded }) => {
  const [boxItem, setBoxItem] = useState('');

  const addBoxItem = () => {
    const item = boxItem.trim().slice(0, LIMITS.inTheBox.itemLength);
    if (!item) return;
    if (draft.inTheBox.length >= LIMITS.inTheBox.items) return;
    if (draft.inTheBox.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      setBoxItem('');
      return;
    }
    onChange({ inTheBox: [...draft.inTheBox, item] });
    setBoxItem('');
  };

  const toggleOccasion = (name: string) =>
    onChange({
      occasions: draft.occasions.includes(name) ? draft.occasions.filter((occasion) => occasion !== name) : [...draft.occasions, name],
    });

  return (
    <div className="space-y-6">
      <WizardField
        id="wz-title"
        label="Product name"
        required
        error={errors.title}
        counter={`${draft.title.trim().length}/${LIMITS.title.max}`}
        hint="A clear name buyers can search for, for example: Belgian Chocolate Truffle Gift Box (12 pcs)"
      >
        <input
          id="wz-title"
          type="text"
          value={draft.title}
          maxLength={LIMITS.title.max}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="e.g. Belgian Chocolate Truffle Gift Box (12 pcs)"
          className={inputClass(Boolean(errors.title))}
          autoFocus
        />
      </WizardField>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <WizardField id="wz-category" label="Category" required error={errors.category} hint="Buyers find your product under this category in the store.">
          <select
            id="wz-category"
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value })}
            className={inputClass(Boolean(errors.category))}
          >
            <option value="">{!categoriesLoaded ? 'Loading categories...' : categories.length === 0 ? 'No categories available yet' : 'Choose a category'}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </WizardField>

        <WizardField id="wz-brand" label="Brand / made by" error={errors.brand} hint="Shown to buyers as the maker. Your store name is filled in for you.">
          <input
            id="wz-brand"
            type="text"
            value={draft.brand}
            maxLength={LIMITS.brand.max}
            onChange={(event) => onChange({ brand: event.target.value })}
            className={inputClass(Boolean(errors.brand))}
          />
        </WizardField>
      </div>

      <WizardField
        id="wz-tagline"
        label="Short tagline"
        error={errors.tagline}
        counter={`${draft.tagline.trim().length}/${LIMITS.tagline.max}`}
        hint="One line shown under the name. Optional."
      >
        <input
          id="wz-tagline"
          type="text"
          value={draft.tagline}
          maxLength={LIMITS.tagline.max}
          onChange={(event) => onChange({ tagline: event.target.value })}
          placeholder="e.g. Handmade in small batches, wrapped with love"
          className={inputClass(Boolean(errors.tagline))}
        />
      </WizardField>

      <WizardField
        id="wz-description"
        label="Description"
        required
        error={errors.description}
        counter={`${draft.description.trim().length}/${LIMITS.description.max}`}
        hint="Tell buyers what the product is, what it is made of, its size, and why it makes a good gift."
      >
        <textarea
          id="wz-description"
          rows={5}
          value={draft.description}
          maxLength={LIMITS.description.max}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Describe your product..."
          className={`${inputClass(Boolean(errors.description))} resize-y leading-relaxed`}
        />
      </WizardField>

      <WizardField
        id="wz-box"
        label="What is in the box"
        hint={`Add each item one by one (up to ${LIMITS.inTheBox.items}). Optional, but buyers like to know exactly what they get.`}
        counter={`${draft.inTheBox.length}/${LIMITS.inTheBox.items}`}
      >
        <div className="flex gap-2">
          <input
            id="wz-box"
            type="text"
            value={boxItem}
            maxLength={LIMITS.inTheBox.itemLength}
            onChange={(event) => setBoxItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addBoxItem();
              }
            }}
            disabled={draft.inTheBox.length >= LIMITS.inTheBox.items}
            placeholder="e.g. 12 dark chocolate truffles"
            className={inputClass(false)}
          />
          <button
            type="button"
            onClick={addBoxItem}
            disabled={!boxItem.trim() || draft.inTheBox.length >= LIMITS.inTheBox.items}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {draft.inTheBox.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {draft.inTheBox.map((item) => (
              <li key={item} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-700">
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => onChange({ inTheBox: draft.inTheBox.filter((existing) => existing !== item) })}
                  className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </WizardField>

      <fieldset>
        <legend className="text-xs font-bold text-slate-800">Occasions</legend>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Pick every occasion this gift suits. Buyers shopping for them will see your product.</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {OCCASION_META.map((occasion) => {
            const selected = draft.occasions.includes(occasion.name);
            const Icon = occasion.icon;
            return (
              <button
                key={occasion.name}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggleOccasion(occasion.name)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  selected ? 'border-brand bg-brand text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {occasion.name}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
