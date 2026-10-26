import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useLang } from '../i18n/LanguageContext'
import { FILTER_PARAMS, hasFilters, readFilters, toApiParams } from '../lib/portfolio'
import PageTitle from '../components/PageTitle'
import PortfolioHero from '../components/portfolio/PortfolioHero'
import PortfolioToolbar from '../components/portfolio/PortfolioToolbar'
import PortfolioResults from '../components/portfolio/PortfolioResults'
import { usePortfolioList } from '../components/portfolio/usePortfolioList'

const FEATURED = { featured: 1, per_page: 6 }

/**
 * /portfolio — the published projects, searched and filtered on the server.
 *
 * The URL is the state: `?q=&category=&industry=&tech=&platform=&status=`. Every control writes to
 * it and the results are read from it, so a filtered view can be shared as a link and the back
 * button steps through the filters the visitor tried.
 */
export default function Portfolio() {
  const { t } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  // Keyed on the query string, so the API parameters keep their identity until a filter changes.
  const filters = useMemo(() => readFilters(new URLSearchParams(query)), [query])
  const apiParams = useMemo(() => toApiParams(filters), [filters])
  const filtered = hasFilters(filters)
  const list = usePortfolioList(apiParams)

  // null while loading, false when it failed: the toolbar falls back to the built-in value lists.
  const [facets, setFacets] = useState(null)
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    let live = true
    api.getPortfolioFacets()
      .then((data) => { if (live) setFacets(data && typeof data === 'object' ? data : false) })
      .catch(() => { if (live) setFacets(false) })
    api.getPortfolio(FEATURED)
      .then(({ data }) => { if (live) setFeatured(Array.isArray(data) ? data : []) })
      .catch(() => {}) // the strip is a bonus; without it the page is simply the list
    return () => { live = false }
  }, [])

  const setFilter = useCallback((key, value, options) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, options)
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const key of Object.keys(FILTER_PARAMS)) next.delete(key)
      return next
    })
  }, [setSearchParams])

  const countText = list.status === 'ready' && list.total > 0 ? t.pfResults(list.total) : ''

  return (
    <div className="view-enter mx-auto max-w-site px-[26px] pb-[90px]">
      <PageTitle title={t.portfolioTitle} description={t.portfolioSub} />
      <PortfolioHero totals={facets ? facets.totals : null} featured={featured} />
      <PortfolioToolbar
        filters={filters}
        facets={facets}
        onChange={setFilter}
        onClear={clearFilters}
        filtered={filtered}
        countText={countText}
      />
      <PortfolioResults list={list} filtered={filtered} onClear={clearFilters} />
    </div>
  )
}
