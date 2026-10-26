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
 */
export default function PortfolioResults({ list, filtered, onClear }) {
  const { t } = useLang()
  const { items, status, more, hasMore } = list
  const loading = status === 'loading'

  return (
    <section>
      <ul className="pf-grid" aria-label={t.portfolioTitle} aria-busy={loading}>
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
          <button type="button" className="pf-btn pf-btn--ghost" onClick={list.loadMore} disabled={more === 'loading'}>
            {more === 'loading' ? t.pfLoadingMore : t.pfLoadMore}
          </button>
          {more === 'error' && <p role="status" className="pf-more__error">{t.loadError}</p>}
        </div>
      )}
    </section>
  )
}
