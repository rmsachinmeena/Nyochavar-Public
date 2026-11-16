import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox, cx } from './primitives';

export type TableLayout = 'table' | 'card';

/**
 * How a column renders in card layout:
 *  - title    → card headline (top-left)
 *  - aside    → top-right of the card header, opposite the title (amounts, key status)
 *  - subtitle → muted line under the headline
 *  - field    → label/value pair; consecutive fields share a two-column grid
 *  - block    → full-width row in the card body, no label
 *  - footer   → the card's action row along the bottom
 *  - hidden   → table layout only
 * Body roles (field, block) render in the order the columns are declared.
 */
export type MobileRole = 'title' | 'aside' | 'subtitle' | 'field' | 'block' | 'footer' | 'hidden';

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, layout: TableLayout) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Applied to the <td> in table layout */
  className?: string;
  headerClassName?: string;
  mobile?: MobileRole;
  /** Overrides the header as the label of a card `field` */
  mobileLabel?: React.ReactNode;
  /** Applied to the column's wrapper inside a card */
  mobileClassName?: string;
  /** Restrict the column to one layout */
  only?: TableLayout;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows?: T[];
  data?: T[];
  rowKey?: (row: T) => string;
  keyExtractor?: (row: T) => string;
  loading?: boolean;
  loadingLabel?: string;
  empty?: React.ReactNode;
  className?: string;
  /** Row selection for bulk actions: a checkbox per row plus a select-all box. Pair with useRowSelection. */
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (next: Set<string>) => void;
  /** Accessible label of a row's checkbox, e.g. the product name */
  selectLabel?: (row: T) => string;
}

const ALIGN: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center'
};

/** Below this width the table never renders, even if it would technically fit — cards are easier to tap. */
const MIN_TABLE_WIDTH = 640;
/** Card layout goes two-up once there is this much room. */
const TWO_UP_WIDTH = 680;
/** Extra room required before switching back to the table, wider than a scrollbar, so the layout can't flip-flop. */
const HYSTERESIS = 24;

/**
 * Selected row keys for a DataTable's bulk actions. Keys that leave `rowKeys` (deleted, filtered out,
 * another page) drop out automatically, so a bulk delete only ever touches rows the admin can see.
 */
export function useRowSelection(rowKeys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const signature = rowKeys.join('|');

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(rowKeys);
      const next = new Set([...prev].filter((key) => visible.has(key)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, setSelected, clear };
}

type BodySegment<T> = { kind: 'fields'; columns: DataColumn<T>[] } | { kind: 'block'; column: DataColumn<T> };

/**
 * Renders a real table when it fits the space it has, and a card list when it doesn't.
 * The decision is based on this component's own width, not the viewport, so the admin
 * sidebar, browser zoom and window size are all accounted for.
 */
export function DataTable<T>({
  columns,
  rows: rawRows,
  data,
  rowKey: rawRowKey,
  keyExtractor,
  loading = false,
  loadingLabel = 'Loading…',
  empty,
  className,
  selectedKeys,
  onSelectionChange,
  selectLabel
}: DataTableProps<T>) {
  const rows = rawRows ?? data ?? [];
  const rowKey = rawRowKey ?? keyExtractor ?? ((row: any) => row.id ?? String(row));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [tableMinWidth, setTableMinWidth] = useState<number | null>(null);
  const [layout, setLayout] = useState<TableLayout>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'table' : 'card'
  );

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Runs after every render: measure the table while it is showing, fall back to cards if it overflows.
  useLayoutEffect(() => {
    if (width === null || loading || rows.length === 0) return;
    if (width < MIN_TABLE_WIDTH) {
      if (layout !== 'card') setLayout('card');
      return;
    }
    if (layout === 'table') {
      const needed = tableRef.current?.scrollWidth ?? 0;
      if (needed > width + 1) {
        setTableMinWidth(needed);
        setLayout('card');
      }
    } else if (tableMinWidth === null || width >= tableMinWidth + HYSTERESIS) {
      setLayout('table');
    }
  });

  const tableColumns = columns.filter((c) => c.only !== 'card');
  const cardColumns = columns.filter((c) => c.only !== 'table');
  const roleOf = (c: DataColumn<T>): MobileRole => c.mobile ?? 'field';

  const titleColumn = cardColumns.find((c) => roleOf(c) === 'title');
  const asideColumns = cardColumns.filter((c) => roleOf(c) === 'aside');
  const subtitleColumns = cardColumns.filter((c) => roleOf(c) === 'subtitle');
  const footerColumns = cardColumns.filter((c) => roleOf(c) === 'footer');

  const bodySegments = cardColumns.reduce<BodySegment<T>[]>((segments, column) => {
    const role = roleOf(column);
    if (role === 'block') segments.push({ kind: 'block', column });
    if (role === 'field') {
      const last = segments[segments.length - 1];
      if (last && last.kind === 'fields') last.columns.push(column);
      else segments.push({ kind: 'fields', columns: [column] });
    }
    return segments;
  }, []);

  const twoUp = layout === 'card' && width !== null && width >= TWO_UP_WIDTH;

  const selectable = Boolean(selectedKeys && onSelectionChange);
  const isSelected = (row: T) => Boolean(selectedKeys?.has(rowKey(row)));
  const selectedCount = selectable ? rows.filter(isSelected).length : 0;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const toggleRow = (row: T, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(rowKey(row));
    else next.delete(rowKey(row));
    onSelectionChange?.(next);
  };
  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedKeys);
    rows.forEach((row) => (checked ? next.add(rowKey(row)) : next.delete(rowKey(row))));
    onSelectionChange?.(next);
  };
  const rowCheckbox = (row: T) => (
    <Checkbox
      checked={isSelected(row)}
      onChange={(checked) => toggleRow(row, checked)}
      label={`Select ${selectLabel ? selectLabel(row) : 'row'}`}
    />
  );
  const selectAllCheckbox = (
    <Checkbox
      checked={allSelected}
      indeterminate={selectedCount > 0}
      onChange={toggleAll}
      label={allSelected ? 'Clear selection' : 'Select all'}
    />
  );

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-xs font-medium">{loadingLabel}</span>
      </div>
    );
  } else if (rows.length === 0) {
    content = empty;
  } else if (layout === 'table') {
    content = (
      <div className="relative overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {selectable && (
                <th scope="col" className="w-10 py-3 pl-5 pr-1 align-middle">
                  {selectAllCheckbox}
                </th>
              )}
              {tableColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    'px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap first:pl-5 last:pr-5',
                    ALIGN[column.align ?? 'left'],
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cx('transition-colors', isSelected(row) ? 'bg-blue-50/60' : 'hover:bg-slate-50/70')}
              >
                {selectable && <td className="w-10 py-3.5 pl-5 pr-1 align-middle">{rowCheckbox(row)}</td>}
                {tableColumns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-3 py-3.5 align-middle text-[13px] text-slate-700 first:pl-5 last:pr-5',
                      ALIGN[column.align ?? 'left'],
                      column.className
                    )}
                  >
                    {column.cell(row, 'table')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    content = (
      <>
      {selectable && (
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-5">
          {selectAllCheckbox}
          <span className="text-xs font-medium text-slate-500">
            {selectedCount > 0 ? `${selectedCount} of ${rows.length} selected` : `Select all (${rows.length})`}
          </span>
        </div>
      )}
      <ul className={cx(twoUp ? 'grid grid-cols-2' : 'divide-y divide-slate-100')}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cx(
              'min-w-0 px-4 py-3.5 text-sm text-slate-700 sm:px-5',
              twoUp && 'border-b border-slate-100 odd:border-r',
              selectable && 'flex items-start gap-3',
              isSelected(row) && 'bg-blue-50/60'
            )}
          >
            {selectable && <div className="pt-0.5">{rowCheckbox(row)}</div>}
            <div className={cx(selectable && 'min-w-0 flex-1')}>
            {(titleColumn || asideColumns.length > 0) && (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {titleColumn && (
                    <div className={cx('text-[14px] font-semibold leading-snug text-slate-900', titleColumn.mobileClassName)}>
                      {titleColumn.cell(row, 'card')}
                    </div>
                  )}
                  {subtitleColumns.map((column) => (
                    <div key={column.key} className={cx('mt-0.5 text-xs text-slate-500', column.mobileClassName)}>
                      {column.cell(row, 'card')}
                    </div>
                  ))}
                </div>
                {asideColumns.length > 0 && (
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    {asideColumns.map((column) => (
                      <div key={column.key} className={column.mobileClassName}>
                        {column.cell(row, 'card')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!titleColumn && asideColumns.length === 0 && subtitleColumns.length > 0 && (
              <div>
                {subtitleColumns.map((column) => (
                  <div key={column.key} className={cx('text-xs text-slate-500', column.mobileClassName)}>
                    {column.cell(row, 'card')}
                  </div>
                ))}
              </div>
            )}

            {bodySegments.map((segment, index) =>
              segment.kind === 'block' ? (
                <div key={segment.column.key} className={cx('mt-3', segment.column.mobileClassName)}>
                  {segment.column.cell(row, 'card')}
                </div>
              ) : (
                <dl key={`fields-${index}`} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {segment.columns.map((column) => (
                    <div key={column.key} className={cx('min-w-0', column.mobileClassName)}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {column.mobileLabel ?? column.header}
                      </dt>
                      <dd className="mt-1 text-[13px] text-slate-700">{column.cell(row, 'card')}</dd>
                    </div>
                  ))}
                </dl>
              )
            )}

            {footerColumns.length > 0 && (
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-slate-200 pt-3">
                {footerColumns.map((column) => (
                  <div key={column.key} className={cx('min-w-0', column.mobileClassName)}>
                    {column.cell(row, 'card')}
                  </div>
                ))}
              </div>
            )}
            </div>
          </li>
        ))}
      </ul>
      </>
    );
  }

  return (
    <div ref={wrapperRef} className={cx('relative min-w-0', className)}>
      {content}
    </div>
  );
}
