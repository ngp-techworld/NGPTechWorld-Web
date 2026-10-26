import { useEffect, useRef } from 'react'
import { useLang } from '../../i18n/LanguageContext'
import PortfolioCard from './PortfolioCard'
import PortfolioCardSkeleton from './PortfolioCardSkeleton'

const FIRST_PAGE_SKELETONS = 6
const NEXT_PAGE_SKELETONS = 3

/**
 * The grid, and every state it can be in: loading (skeletons the size of real cards), loaded, empty
 * (with a way out), failed (with a retry) and "load more".
 *
 * The <ul> is always there, so a screen reader keeps one named list whose contents change, and
 * `aria-busy` says when they are about to.
 *
 * Keyboard focus survives "load more". The button stays focusable while busy (aria-disabled, not
 * disabled — a disabled button drops focus to <body>), and once the page arrives focus moves to the
 * first card it added, which is also where it has to go when the last page removes the button.
 */
export default function PortfolioResults({ list, filtered, onClear }) {
  const { t } = useLang()
  const { items, status, more, hasMore } = list
  const loading = status === 'loading'
  const listRef = useRef(null)
  const buttonRef = useRef(null)
  // Index of the first card the pending "load more" will add, or null when none is pending.
  const focusFrom = useRef(null)

  // New filters start a new list: a "load more" that was pending no longer has anywhere to land.
  useEffect(() => { if (loading) focusFrom.current = null }, [loading])

  useEffect(() => {
    const from = focusFrom.current
    if (from == null || items.length <= from) return
    focusFrom.current = null
    // Only take focus back from the button (or from <body>, where it went if the button is gone) —
    // never from somewhere the visitor moved to while the page was loading.
    const active = document.activeElement
    if (active && active !== document.body && active !== buttonRef.current) return
    listRef.current?.children[from]?.querySelector('.pf-card__link')?.focus()
  }, [items.length])

  const onMore = () => {
    if (more === 'loading') return
    focusFrom.current = items.length
    list.loadMore()
  }

  return (
    <section>
      {/* Gives the cards (h3) a parent heading of their own — without it they would read as part of
          the featured strip above, or jump straight from the page's h1. */}
      <h2 className="sr-only">{t.pfAllProjects}</h2>
      <ul ref={listRef} className="pf-grid" aria-label={t.portfolioTitle} aria-busy={loading}>
        {loading
          ? Array.from({ length: FIRST_PAGE_SKELETONS }, (_, i) => <li key={`s${i}`}><PortfolioCardSkeleton /></li>)
          : items.map((p, i) => (
            // Staggered by column only, so each row of a "load more" settles as quickly as the first.
            <li key={p.id} data-rise style={{ '--i': i % 3 }} className="h-full">
              <PortfolioCard project={p} />
            </li>
          ))}
        {more === 'loading' && Array.from({ length: NEXT_PAGE_SKELETONS }, (_, i) => <li key={`m${i}`}><PortfolioCardSkeleton /></li>)}
      </ul>

      {status === 'error' && (
        <div role="status" className="pf-state">
          <p className="pf-state__title">{t.loadError}</p>
          <button type="button" className="pf-btn pf-btn--ghost" onClick={list.retry}>{t.pfRetry}</button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div role="status" className="pf-state">
          {filtered ? (
            <>
              <p className="pf-state__title">{t.pfEmpty}</p>
              <p className="pf-state__hint">{t.pfEmptyHint}</p>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={onClear}>{t.pfClear}</button>
            </>
          ) : (
            <p className="pf-state__title">{t.pfNone}</p>
          )}
        </div>
      )}

      {hasMore && (
        <div className="pf-more">
          <button
            ref={buttonRef}
            type="button"
            className="pf-btn pf-btn--ghost"
            onClick={onMore}
            aria-disabled={more === 'loading'}
          >
            {more === 'loading' ? t.pfLoadingMore : t.pfLoadMore}
          </button>
          {more === 'error' && <p role="status" className="pf-more__error">{t.loadError}</p>}
        </div>
      )}
    </section>
  )
}
