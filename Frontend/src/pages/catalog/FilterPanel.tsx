import React, { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PRICE_BANDS, RECIPIENT_OPTIONS, TAG_OPTIONS } from '../../utils/catalog';
import type { CatalogFilters, RecipientKey, TagKey } from '../../utils/catalog';

export interface FacetCounts {
  occasions: { name: string; count: number }[];
  prices: Record<string, number>;
  tags: Record<TagKey, number>;
}

interface FilterPanelProps {
  filters: CatalogFilters;
  counts: FacetCounts;
  onChange: (patch: Partial<CatalogFilters>) => void;
}

const OCCASIONS_PREVIEW = 6;

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-100 py-5 first:pt-0 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3.5">{children}</div>}
    </div>
  );
};

interface OptionRowProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
  type?: 'checkbox' | 'radio';
  name?: string;
}

const OptionRow: React.FC<OptionRowProps> = ({ label, checked, onChange, count, type = 'checkbox', name }) => (
  <label className="group flex cursor-pointer items-center gap-3 py-1.5">
    <input type={type} name={name} checked={checked} onChange={onChange} className="peer sr-only" />
    <span
      aria-hidden="true"
      className={`grid h-5 w-5 shrink-0 place-items-center border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
        type === 'radio' ? 'rounded-full' : 'rounded-md'
      } ${checked ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}
    >
      {checked &&
        (type === 'radio' ? (
          <span className="h-2 w-2 rounded-full bg-white" />
        ) : (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ))}
    </span>
    <span className={`flex-1 text-sm ${checked ? 'font-medium text-ink' : 'text-slate-600 group-hover:text-ink'}`}>{label}</span>
    {count !== undefined && <span className="text-xs tabular-nums text-slate-400">{count}</span>}
  </label>
);

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, counts, onChange }) => {
  const priceGroupName = useId();
  const [showAllOccasions, setShowAllOccasions] = useState(false);

  const toggleOccasion = (name: string) =>
    onChange({
      occasions: filters.occasions.includes(name)
        ? filters.occasions.filter((occasion) => occasion !== name)
        : [...filters.occasions, name],
    });

  const toggleTag = (tag: TagKey) =>
    onChange({ tags: filters.tags.includes(tag) ? filters.tags.filter((value) => value !== tag) : [...filters.tags, tag] });

  const visibleOccasions = showAllOccasions ? counts.occasions : counts.occasions.slice(0, OCCASIONS_PREVIEW);
  const priceOptions = PRICE_BANDS.filter((band) => (counts.prices[band.id] ?? 0) > 0 || filters.price === band.id);
  const tagOptions = TAG_OPTIONS.filter((tag) => counts.tags[tag.value] > 0 || filters.tags.includes(tag.value));
  const recipientOptions: { value: RecipientKey | null; label: string }[] = [{ value: null, label: 'Everyone' }, ...RECIPIENT_OPTIONS];

  return (
    <div>
      <FilterSection title="Recipient">
        <div role="radiogroup" aria-label="Recipient" className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
          {recipientOptions.map((option) => {
            const active = filters.recipient === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ recipient: option.value })}
                className={`rounded-full px-2 py-2 text-[13px] font-medium transition ${
                  active ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {counts.occasions.length > 0 && (
        <FilterSection title="Occasion">
          <div>
            {visibleOccasions.map(({ name, count }) => (
              <OptionRow
                key={name}
                label={name}
                count={count}
                checked={filters.occasions.some((occasion) => occasion.toLowerCase() === name.toLowerCase())}
                onChange={() => toggleOccasion(name)}
              />
            ))}
          </div>
          {counts.occasions.length > OCCASIONS_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllOccasions((value) => !value)}
              className="mt-2 text-sm font-medium text-brand hover:underline"
            >
              {showAllOccasions ? 'Show fewer' : `Show all ${counts.occasions.length}`}
            </button>
          )}
        </FilterSection>
      )}

      <FilterSection title="Price">
        <div>
          <OptionRow
            type="radio"
            name={priceGroupName}
            label="Any price"
            checked={!filters.price}
            onChange={() => onChange({ price: null })}
          />
          {priceOptions.map((band) => (
            <OptionRow
              key={band.id}
              type="radio"
              name={priceGroupName}
              label={band.label}
              count={counts.prices[band.id] ?? 0}
              checked={filters.price === band.id}
              onChange={() => onChange({ price: band.id })}
            />
          ))}
        </div>
      </FilterSection>

      {tagOptions.length > 0 && (
        <FilterSection title="Highlights">
          <div>
            {tagOptions.map((tag) => (
              <OptionRow
                key={tag.value}
                label={tag.label}
                count={counts.tags[tag.value]}
                checked={filters.tags.includes(tag.value)}
                onChange={() => toggleTag(tag.value)}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  );
};
