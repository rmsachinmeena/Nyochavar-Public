import React, { useState } from 'react';
import { cx } from './primitives';

/* Rounds a raw step up to 1 / 2 / 2.5 / 5 × 10ⁿ so axis ticks land on clean numbers. */
const niceStep = (raw: number) => {
  if (raw <= 0) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
};

export interface ColumnDatum {
  key: string;
  /** Short axis label */
  label: string;
  /** Full label for the tooltip, e.g. a full date */
  fullLabel?: string;
  value: number;
  /** Secondary tooltip line, e.g. "3 orders" */
  detail?: string;
}

const TICK_COUNT = 4;
const GUTTER = 'pl-12';

export const ColumnChart: React.FC<{
  data: ColumnDatum[];
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  ariaLabel: string;
  plotHeight?: number;
  /** Show every Nth x-axis label (the last one is always shown) */
  labelEvery?: number;
  dimmed?: boolean;
}> = ({ data, formatValue, formatTick = formatValue, ariaLabel, plotHeight = 200, labelEvery = 1, dimmed = false }) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max / TICK_COUNT);
  const top = step * TICK_COUNT;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i * step);
  const peakIndex = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  const edge = Math.max(1, Math.round(data.length * 0.15));

  return (
    <figure className={cx('transition-opacity', dimmed && 'opacity-50')}>
      <div className="relative" style={{ height: plotHeight }}>
        {ticks.map((tick) => (
          <div
            key={tick}
            aria-hidden="true"
            className={cx('absolute inset-x-0 flex items-center', GUTTER)}
            style={{ bottom: `${(tick / top) * 100}%` }}
          >
            <span className="absolute left-0 w-10 -translate-y-px text-right text-[10px] tabular-nums text-slate-400">
              {formatTick(tick)}
            </span>
            <span className={cx('h-px w-full', tick === 0 ? 'bg-slate-200' : 'bg-slate-100')} />
          </div>
        ))}

        <div className={cx('absolute inset-0 flex items-end', GUTTER)}>
          {data.map((d, i) => {
            const pct = top > 0 ? (d.value / top) * 100 : 0;
            const isActive = active === i;
            const align = i < edge ? 'left-0' : i >= data.length - edge ? 'right-0' : 'left-1/2 -translate-x-1/2';
            return (
              <button
                key={d.key}
                type="button"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={(e) => {
                  if (e.pointerType !== 'touch') setActive((cur) => (cur === i ? null : cur));
                }}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                aria-label={`${d.fullLabel ?? d.label}: ${formatValue(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center px-[1px] focus-visible:outline-none"
              >
                {d.value > 0 ? (
                  <span
                    className={cx(
                      'block w-[60%] max-w-6 rounded-t-[4px] transition-colors',
                      isActive ? 'bg-blue-500' : 'bg-blue-600',
                      'group-focus-visible:ring-2 group-focus-visible:ring-blue-500/40 group-focus-visible:ring-offset-2'
                    )}
                    style={{ height: `${pct}%` }}
                  />
                ) : (
                  <span className="block h-[2px] w-[60%] max-w-6 bg-slate-200" />
                )}

                {i === peakIndex && !isActive && (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-slate-700"
                    style={{ bottom: `calc(${pct}% + 4px)` }}
                  >
                    {formatValue(d.value)}
                  </span>
                )}

                {isActive && (
                  <span
                    role="tooltip"
                    className={cx(
                      'pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-left shadow-lg',
                      align
                    )}
                    style={{ bottom: `calc(${pct}% + 8px)` }}
                  >
                    <span className="block text-[13px] font-semibold text-white">{formatValue(d.value)}</span>
                    <span className="block text-[11px] text-slate-300">
                      {d.fullLabel ?? d.label}
                      {d.detail ? ` · ${d.detail}` : ''}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cx('mt-2 flex h-4', GUTTER)} aria-hidden="true">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const show = isLast || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery);
          return (
            <span key={d.key} className="relative min-w-0 flex-1">
              {show && (
                <span
                  className={cx(
                    'absolute top-0 whitespace-nowrap text-[10px] text-slate-500',
                    isLast && data.length > 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  )}
                >
                  {d.label}
                </span>
              )}
            </span>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.fullLabel ?? d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Shown at the bar's tip */
  display: string;
  sublabel?: string;
  leading?: React.ReactNode;
}

/* Horizontal bars for ranked lists and funnels — one hue, square at the baseline, value at the tip. */
export const BarList: React.FC<{ items: BarListItem[]; max?: number; dimmed?: boolean }> = ({
  items,
  max,
  dimmed = false
}) => {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cx('space-y-3.5 transition-opacity', dimmed && 'opacity-50')}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3">
          {item.leading}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium text-slate-700">{item.label}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">{item.display}</span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-r-[4px] bg-blue-50">
              <div
                className="h-full rounded-r-[4px] bg-blue-600"
                style={{ width: `${top > 0 ? Math.max(item.value > 0 ? 2 : 0, (item.value / top) * 100) : 0}%` }}
              />
            </div>
            {item.sublabel && <p className="mt-1 text-[11px] text-slate-500">{item.sublabel}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
};
