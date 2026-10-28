import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ListTree } from 'lucide-react'
import { useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { sectionId } from './parts'
import strings from './strings'

const DOT = { public: 'bg-info', internal: 'bg-accent-light', sensitive: 'bg-danger' }

/** The section the reader is in: the last one whose top has passed the upper third of the window. */
function useActiveSection(keys) {
  const [active, setActive] = useState(keys[0] ?? null)
  const joined = keys.join(',')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const visible = new Map()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting))
        const first = joined.split(',').find((key) => visible.get(sectionId(key)))
        if (first) setActive(first)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    joined.split(',').forEach((key) => {
      const element = document.getElementById(sectionId(key))
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [joined])
  return [active, setActive]
}

function Links({ items, active, onPick }) {
  const p = useStrings(strings)
  return (
    <ol className="space-y-0.5">
      {items.map((item) => (
        <li key={item.key}>
          <a
            href={`#${sectionId(item.key)}`}
            aria-current={active === item.key ? 'location' : undefined}
            onClick={(event) => {
              event.preventDefault()
              const target = document.getElementById(sectionId(item.key))
              target?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
              target?.focus({ preventScroll: true })
              onPick(item.key)
            }}
            className={cx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light',
              active === item.key ? 'bg-accent/20 font-semibold text-ink' : 'text-muted hover:bg-white/[.05] hover:text-ink',
            )}
          >
            <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', DOT[item.tier])} title={p.tiers[item.tier]} />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <span className="sr-only">({p.tiers[item.tier]})</span>
          </a>
        </li>
      ))}
    </ol>
  )
}

/** The legend of the tier dots, under the list. */
function Legend() {
  const p = useStrings(strings)
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[.06] px-2.5 pt-3 text-[11px] text-faint" aria-hidden="true">
      {Object.keys(DOT).map((tier) => (
        <li key={tier} className="inline-flex items-center gap-1.5">
          <span className={cx('size-1.5 rounded-full', DOT[tier])} />
          {p.tiers[tier]}
        </li>
      ))}
    </ul>
  )
}

/**
 * The table of contents: sticky beside the sections on wide screens, a fold-out list above them on phones. Only the
 * sections the page shows are listed; the coloured dot is their tier.
 */
export function Toc({ items, variant }) {
  const p = useStrings(strings)
  const [active, setActive] = useActiveSection(items.map((item) => item.key))
  const mobile = useRef(null)
  if (variant === 'mobile') {
    return (
      <details ref={mobile} className="group rounded-card border border-white/[.08] bg-white/[.03] lg:hidden" data-print-hide="">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-card px-4 py-3 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light [&::-webkit-details-marker]:hidden">
          <ListTree size={16} aria-hidden="true" className="text-accent-lighter" />
          {p.toc}
          <ChevronDown size={16} aria-hidden="true" className="ms-auto text-muted transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label={`${p.tocLabel} (${p.toc})`} className="px-2 pb-3">
          <Links
            items={items}
            active={active}
            onPick={(key) => {
              setActive(key)
              if (mobile.current) mobile.current.open = false
            }}
          />
        </nav>
      </details>
    )
  }
  return (
    <nav aria-label={p.tocLabel} className="lg:sticky lg:top-36" data-print-hide="">
      <p className="mb-2 flex items-center gap-2 px-2.5 text-xs font-bold text-muted">
        <ListTree size={14} aria-hidden="true" />
        {p.toc}
      </p>
      <Links items={items} active={active} onPick={setActive} />
      <Legend />
    </nav>
  )
}
