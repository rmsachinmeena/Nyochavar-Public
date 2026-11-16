import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import type { StepId, WizardStep } from './productFormState';

/** A labelled field: the label, an optional hint and character counter, and the error line under it. */
export const WizardField: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  counter?: string;
  children: React.ReactNode;
}> = ({ id, label, required, hint, error, counter, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-end justify-between gap-3">
      <label htmlFor={id} className="text-xs font-bold text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {counter && <span className="text-[11px] font-medium text-slate-400">{counter}</span>}
    </div>
    {children}
    {error ? (
      <p role="alert" className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
      </p>
    ) : (
      hint && <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>
    )}
  </div>
);

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
    invalid
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
      : 'border-slate-200 hover:border-slate-300 focus:border-brand focus:ring-brand/15'
  }`;

/**
 * Progress through the steps. On a phone it is one line ("Step 2 of 6: Photos") with a progress bar; on a wider screen
 * every step is shown with a number, finished steps get a tick, and a finished step can be clicked to go back to it.
 */
export const WizardStepper: React.FC<{
  steps: WizardStep[];
  current: StepId;
  done: Set<StepId>;
  onGo: (step: StepId) => void;
}> = ({ steps, current, done, onGo }) => {
  const index = steps.findIndex((step) => step.id === current);
  const active = steps[index];

  return (
    <nav aria-label="Product form steps">
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-ink">
            Step {index + 1} of {steps.length}: {active.title}
          </span>
          <span className="text-slate-400">{Math.round(((index + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="hidden items-start sm:flex">
        {steps.map((step, i) => {
          const isCurrent = step.id === current;
          const isDone = done.has(step.id);
          const canGo = isDone || i < index;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <button
                type="button"
                disabled={!canGo}
                onClick={() => onGo(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center ${canGo ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold transition ${
                    isCurrent
                      ? 'border-brand bg-brand text-white shadow-md shadow-brand/30'
                      : isDone
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {isDone && !isCurrent ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`w-full truncate px-1 text-[11px] font-semibold ${isCurrent ? 'text-ink' : 'text-slate-500'}`}>{step.title}</span>
              </button>
              {i < steps.length - 1 && <span className={`mt-4 h-0.5 w-4 shrink-0 rounded-full lg:w-8 ${isDone ? 'bg-brand' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
