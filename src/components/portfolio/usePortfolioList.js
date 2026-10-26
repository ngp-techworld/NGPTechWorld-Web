import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { PER_PAGE } from '../../lib/portfolio'

/**
 * The /portfolio results for one set of API filters: the first page, then "load more" pages
 * appended to it.
 *
 * Every request takes a ticket from one counter and only the holder of the newest ticket may write
 * its answer. That is what keeps a slow response for filters the visitor has already left — say
 * "Web", clicked a moment before "Mobile" — from landing on top of the newer results. It covers a
 * "load more" that is still in flight when the filters change, too: its ticket is stale as well.
 *
 * `params` must be stable for as long as the filters are the same (the page memoises it on the URL),
 * since a new object means a new query.
 */
export function usePortfolioList(params) {
  const [state, setState] = useState({ items: [], meta: null, status: 'loading', more: 'idle' })
  const ticket = useRef(0)

  const request = useCallback((page) => {
    const id = ++ticket.current
    const append = page > 1
    setState((s) => (append ? { ...s, more: 'loading' } : { items: [], meta: null, status: 'loading', more: 'idle' }))

    api.getPortfolio({ ...params, page, per_page: PER_PAGE })
      .then(({ data, meta }) => {
        if (id !== ticket.current) return
        setState((s) => {
          const rows = Array.isArray(data) ? data : []
          if (!append) return { items: rows, meta: meta ?? null, status: 'ready', more: 'idle' }
          // A project published between two pages can shift the list by one; never show it twice.
          const seen = new Set(s.items.map((p) => p.id))
          return { items: [...s.items, ...rows.filter((p) => !seen.has(p.id))], meta: meta ?? s.meta, status: 'ready', more: 'idle' }
        })
      })
      .catch(() => {
        if (id !== ticket.current) return
        setState((s) => (append ? { ...s, more: 'error' } : { ...s, status: 'error' }))
      })
  }, [params])

  // Taking a ticket on the way out makes every answer still in flight stale, so nothing writes to a
  // list that is gone (or, under StrictMode's double run, to the first of the two).
  useEffect(() => {
    request(1)
    return () => { ticket.current += 1 }
  }, [request])

  const page = state.meta?.current_page ?? 1
  const lastPage = state.meta?.last_page ?? 1

  return {
    items: state.items,
    total: state.meta?.total ?? state.items.length,
    status: state.status,
    more: state.more,
    hasMore: state.status === 'ready' && page < lastPage,
    loadMore: () => { if (state.more !== 'loading') request(page + 1) },
    retry: () => request(1),
  }
}
