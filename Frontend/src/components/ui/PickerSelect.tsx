import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

interface PickerSelectProps {
  /** Goes on the button, so a <label htmlFor> and "scroll to the missed field" both find it */
  id: string;
  /** Shown as the small popup's title */
  title: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  /** Red border (a missed field) */
  invalid?: boolean;
  onChange: (value: string) => void;
}

/**
 * A dropdown that opens as a small popup in the middle of the screen (the browser's own list takes over the whole
 * screen on phones). Uses the site's colours and fonts.
 */
export const PickerSelect: React.FC<PickerSelectProps> = ({ id, title, value, options, placeholder = 'Select', disabled, invalid, onChange }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const choose = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
        className={`flex h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-4 text-left text-base shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px] ${
          invalid ? 'border-red-500! ring-4 ring-red-500/10' : 'border-slate-200'
        }`}
      >
        <span className={`truncate ${value ? 'text-ink' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-200 flex items-center justify-center bg-slate-900/50 p-5 animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-label={title}
              className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 animate-in zoom-in-95 duration-150"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h3 className="font-serif text-base text-ink">{title}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul id={listId} role="listbox" aria-label={title} className="max-h-72 overflow-y-auto p-1.5">
                {options.map((option) => {
                  const isSelected = option === value;
                  return (
                    <li
                      key={option}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => choose(option)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          choose(option);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[14px] transition-colors hover:bg-brand-soft focus:bg-brand-soft focus:outline-none ${
                        isSelected ? 'bg-brand-soft font-semibold text-brand' : 'font-medium text-ink'
                      }`}
                    >
                      <span>{option}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default PickerSelect;
