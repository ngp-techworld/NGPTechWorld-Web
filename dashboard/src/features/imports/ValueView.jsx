import { useState } from 'react'
import { useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import strings from './strings'

// A preview value (`current`, `incoming`, a skipped value): any JSON value. Strings, numbers and booleans as they are,
// null as "—", arrays and objects compactly; anything long is cut with an expand control.

const LIMIT = 140

const isPlain = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value)

/** One line: ['a', 'b'] → 'a · b'; { ar: 'x', en: 'y' } → 'ar: x · en: y'; deeper levels as JSON. */
export function compactText(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map((item) => (isPlain(item) ? String(item ?? '—') : JSON.stringify(item))).join(' · ')
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${isPlain(item) ? String(item ?? '—') : JSON.stringify(item)}`)
    .join(' · ')
}

const isNested = (value) => value !== null && typeof value === 'object' && Object.values(value).some((item) => item !== null && typeof item === 'object')

function Toggle({ open, onClick }) {
  const t = useStrings(strings)
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className="ms-1 whitespace-nowrap text-xs font-semibold text-accent-lighter hover:underline">
      {open ? t.showLess : t.showMore}
    </button>
  )
}

export function ValueView({ value, className }) {
  const t = useStrings(strings)
  const [open, setOpen] = useState(false)

  if (value === null || value === undefined || value === '') return <span className={cx('text-faint', className)}>{t.empty}</span>
  if (typeof value === 'boolean') return <span className={className}>{value ? t.yes : t.no}</span>
  if (typeof value === 'number') {
    return (
      <bdi dir="ltr" className={cx('font-mono text-[13px]', className)}>
        {String(value)}
      </bdi>
    )
  }
  if (typeof value === 'string') {
    const long = value.length > LIMIT
    return (
      <span dir="auto" className={cx('whitespace-pre-wrap break-words', className)}>
        {long && !open ? `${value.slice(0, LIMIT)}…` : value}
        {long ? <Toggle open={open} onClick={() => setOpen(!open)} /> : null}
      </span>
    )
  }

  if (Array.isArray(value) && value.length === 0) return <span className={cx('font-mono text-[13px] text-faint', className)}>[]</span>
  const text = compactText(value)
  const expandable = text.length > LIMIT || isNested(value)
  const count = Array.isArray(value) ? <span className="me-1 text-xs text-muted">({t.itemsCount(value.length)})</span> : null
  if (open) {
    return (
      <span className={cx('block', className)}>
        <pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-2 text-start font-mono text-[12px] text-soft">
          {JSON.stringify(value, null, 2)}
        </pre>
        <Toggle open onClick={() => setOpen(false)} />
      </span>
    )
  }
  return (
    <span className={cx('break-words', className)}>
      {count}
      <bdi dir="auto" className="text-[13px]">
        {text.length > LIMIT ? `${text.slice(0, LIMIT)}…` : text}
      </bdi>
      {expandable ? <Toggle open={false} onClick={() => setOpen(true)} /> : null}
    </span>
  )
}
