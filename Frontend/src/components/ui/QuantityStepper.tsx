import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  label?: string;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 99,
  onRemove,
  size = 'md',
  label = 'Quantity',
}) => {
  const atMin = value <= min;
  const showRemove = atMin && Boolean(onRemove);
  const buttonSize = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonClass = `grid ${buttonSize} place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40`;

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white ${size === 'sm' ? 'p-0.5' : 'p-1'}`}
    >
      <button
        type="button"
        onClick={() => (showRemove ? onRemove?.() : onChange(Math.max(min, value - 1)))}
        disabled={atMin && !onRemove}
        aria-label={showRemove ? 'Remove item' : 'Decrease quantity'}
        className={buttonClass}
      >
        {showRemove ? <Trash2 className={iconSize} /> : <Minus className={iconSize} />}
      </button>
      <span
        aria-live="polite"
        className={`min-w-[2rem] text-center font-semibold tabular-nums text-ink ${size === 'sm' ? 'text-sm' : 'text-base'}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={buttonClass}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
};
