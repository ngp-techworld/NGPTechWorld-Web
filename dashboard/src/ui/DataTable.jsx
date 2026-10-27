import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useCommon } from '@/i18n'
import { cx } from '@/lib/cx'
import { Checkbox } from './Checkbox'
import { EmptyState } from './EmptyState'
import { IconButton } from './IconButton'
import { Skeleton } from './Spinner'
import { focusRing } from './styles'

const hideBelow = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' }
const alignCls = { start: 'text-start', center: 'text-center', end: 'text-end' }

/**
 * Which ends of a horizontal scroller have more content past them: `{ start, end }` in reading order. In RTL the
 * browser counts scrollLeft from 0 at the start towards negative values, so the distance is its absolute value.
 */
export function useScrollEdges(ref) {
  const [edges, setEdges] = useState({ start: false, end: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      const pos = Math.abs(el.scrollLeft)
      const next = { start: max > 1 && pos > 1, end: max > 1 && pos < max - 1 }
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // the table grows when rows arrive, the scroller when the window changes
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    if (el.firstElementChild) observer?.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [ref])
  return edges
}

const edgeFade = 'pointer-events-none absolute inset-y-0 z-10 w-8 from-deep/90 to-transparent transition-opacity duration-200'

/**
 * Data grid for list pages. Data and state live in the parent (server-side paging / sorting).
 *
 * columns = [{ key, header, cell?(row, index), sortable?, sortKey?, align?: 'start|center|end', width?, hideBelow?: 'sm|md|lg|xl|2xl', className? }]
 *   - `cell` defaults to row[key]; `sortKey` is the API column (defaults to `key`).
 * sort = { key: 'created_at', dir: 'desc' } (matches the API `sort` / `dir` params), onSortChange({ key, dir }):
 *   clicking a header sorts ascending first, then toggles.
 * selectable + selected (array of row keys) + onSelectedChange(keys): checkbox column (select-all covers the rows on screen).
 * rowActions(row) → [{ key?, label, icon, onClick?, to?, tone?: 'danger', disabled?, hidden? }] rendered as icon buttons.
 * loading = first load (skeleton rows); busy = refetching with rows on screen (dimmed).
 * minWidth (default 560): below this width the table scrolls horizontally instead of squeezing the columns; a soft
 *   shadow then fades in on each side that has more columns past it (mirrored in RTL).
 * emptyState / emptyTitle / emptyDescription customise the "no rows" message.
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = 'id',
  loading = false,
  busy = false,
  sort,
  onSortChange,
  selectable = false,
  selected = [],
  onSelectedChange,
  rowActions,
  onRowClick,
  emptyState,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeletonRows = 5,
  minWidth = 560,
  caption,
  className,
}) {
  const c = useCommon()
  const scroller = useRef(null)
  const edges = useScrollEdges(scroller)
  const keyOf = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey])
  const selectedSet = new Set(selected)
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(keyOf(row)))
  const someSelected = rows.some((row) => selectedSet.has(keyOf(row)))
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

  const toggleAll = (checked) => {
    const keys = rows.map(keyOf)
    onSelectedChange?.(checked ? [...new Set([...selected, ...keys])] : selected.filter((key) => !keys.includes(key)))
  }
  const toggleOne = (key, checked) => onSelectedChange?.(checked ? [...selected, key] : selected.filter((item) => item !== key))

  const sortBy = (column) => {
    const key = column.sortKey ?? column.key
    onSortChange?.({ key, dir: sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc' })
  }

  const showSkeleton = loading && rows.length === 0
  const showEmpty = !loading && rows.length === 0

  return (
    <div className={cx('relative overflow-hidden rounded-card border border-white/[.08] bg-white/[.025] shadow-card', className)}>
      {/* more columns past an edge: a shadow on that side (the start fades towards the end, mirrored in RTL) */}
      <div aria-hidden="true" data-edge="start" data-visible={edges.start || undefined} className={cx(edgeFade, 'start-0 bg-gradient-to-r rtl:bg-gradient-to-l', edges.start ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden="true" data-edge="end" data-visible={edges.end || undefined} className={cx(edgeFade, 'end-0 bg-gradient-to-l rtl:bg-gradient-to-r', edges.end ? 'opacity-100' : 'opacity-0')} />
      {/* `relative`: the sr-only caption / header text are absolutely positioned and would otherwise escape this scroller (and widen the page in RTL) */}
      <div ref={scroller} className="relative overflow-x-auto">
        <table style={{ minWidth }} className={cx('w-full border-collapse text-sm transition-opacity', busy && 'opacity-60')} aria-busy={loading || busy || undefined}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-white/[.08] bg-white/[.03] text-[12px] font-bold uppercase tracking-wide text-muted">
              {selectable ? (
                <th scope="col" className="w-11 px-4 py-3">
                  <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} aria-label={c.selectAll} disabled={rows.length === 0} />
                </th>
              ) : null}
              {columns.map((column) => {
                const key = column.sortKey ?? column.key
                const active = column.sortable && sort?.key === key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable ? (active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none') : undefined}
                    style={column.width ? { width: column.width } : undefined}
                    className={cx('px-4 py-3 font-bold', alignCls[column.align ?? 'start'], column.hideBelow && hideBelow[column.hideBelow], column.headerClassName)}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => sortBy(column)}
                        title={typeof column.header === 'string' ? c.sortBy(column.header) : undefined}
                        className={cx('-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 uppercase transition-colors hover:text-ink', focusRing, active && 'text-ink')}
                      >
                        {column.header}
                        {active ? sort.dir === 'desc' ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" /> : <ArrowUpDown size={13} aria-hidden="true" className="opacity-50" />}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
              {rowActions ? (
                <th scope="col" className="w-px px-4 py-3 text-end">
                  <span className="sr-only">{c.actions}</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[.06]">
            {showSkeleton
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`sk-${index}`} aria-hidden="true">
                    {selectable ? <td className="px-4 py-4" /> : null}
                    {columns.map((column, i) => (
                      <td key={column.key} className={cx('px-4 py-4', column.hideBelow && hideBelow[column.hideBelow])}>
                        <Skeleton className={cx('h-4', i === 0 ? 'w-3/4' : 'w-1/2')} />
                      </td>
                    ))}
                    {rowActions ? <td className="px-4 py-4" /> : null}
                  </tr>
                ))
              : null}

            {showEmpty ? (
              <tr>
                <td colSpan={colCount}>
                  {emptyState ?? <EmptyState icon={emptyIcon} title={emptyTitle ?? c.noResults} description={emptyDescription ?? c.noResultsHint} action={emptyAction} />}
                </td>
              </tr>
            ) : null}

            {rows.map((row, index) => {
              const key = keyOf(row)
              const isSelected = selectedSet.has(key)
              const actions = rowActions ? rowActions(row).filter((action) => action && !action.hidden) : null
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  aria-selected={selectable ? isSelected : undefined}
                  className={cx('transition-colors hover:bg-white/[.03]', isSelected && 'bg-accent/10', onRowClick && 'cursor-pointer')}
                >
                  {selectable ? (
                    <td className="w-11 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <Checkbox checked={isSelected} onChange={(checked) => toggleOne(key, checked)} aria-label={c.selectRow} />
                    </td>
                  ) : null}
                  {columns.map((column) => {
                    const value = column.cell ? column.cell(row, index) : row[column.key]
                    return (
                      <td key={column.key} className={cx('px-4 py-3 align-middle text-ink', alignCls[column.align ?? 'start'], column.hideBelow && hideBelow[column.hideBelow], column.className)}>
                        {value === null || value === undefined || value === '' ? <span className="text-faint">—</span> : value}
                      </td>
                    )
                  })}
                  {actions ? (
                    <td className="w-px whitespace-nowrap px-3 py-2 text-end" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        {actions.map((action, i) => (
                          <IconButton key={action.key ?? i} icon={action.icon} label={action.label} tone={action.tone} to={action.to} onClick={action.onClick} disabled={action.disabled} />
                        ))}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
