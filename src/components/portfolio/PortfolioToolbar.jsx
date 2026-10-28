import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../i18n/LanguageContext'
import { PLATFORMS, PUBLIC_STATUSES } from '../../lib/portfolio'
import Select from '../Select'
import { CloseIcon, SearchIcon } from './icons'

const SEARCH_DELAY = 300

/**
 * The search field. It keeps what is being typed to itself and hands the text up once typing has
 * paused for 300 ms (or at once on Enter), so a word typed letter by letter costs one request
 * instead of one per letter.
 *
 * It also follows the URL: when `value` changes from outside — the back button, "Clear filters" —
 * the field shows the new value. `committed` tells the two apart, so an answer to our own commit
 * arriving while the visitor is still typing never rewinds the field.
 */
function SearchBox({ value, onCommit, inputRef, clearSignal }) {
  const { t } = useLang()
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const timer = useRef(0)
  const commitRef = useRef(onCommit)
  useEffect(() => { commitRef.current = onCommit })

  useEffect(() => {
    if (value === committed.current) return
    committed.current = value
    setText(value)
  }, [value])

  // "Clear filters" also drops text that was typed but not yet sent: otherwise the pending commit
  // would put the search straight back a moment after the clear.
  useEffect(() => {
    if (!clearSignal) return
    clearTimeout(timer.current)
    committed.current = ''
    setText('')
  }, [clearSignal])

  const commit = (raw) => {
    clearTimeout(timer.current)
    const next = raw.trim()
    if (next === committed.current) return
    committed.current = next
    commitRef.current(next)
  }

  useEffect(() => {
    if (text.trim() === committed.current) return undefined
    timer.current = setTimeout(() => commit(text), SEARCH_DELAY)
    return () => clearTimeout(timer.current)
    // `commit` reads only refs; re-arming on its identity would restart the wait every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <form role="search" className="pf-search" onSubmit={(e) => { e.preventDefault(); commit(text) }}>
      <span className="pf-search__icon"><SearchIcon /></span>
      <input
        ref={inputRef}
        type="search"
        className="pf-search__input"
        aria-label={t.pfSearch}
        placeholder={t.pfSearchHint}
        value={text}
        maxLength={100}
        enterKeyHint="search"
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  )
}

/** Category pills — the site's existing .pill style, with the facet count beside each label. */
function CategoryPills({ value, facets, onSelect, showCounts }) {
  const { t } = useLang()
  const counts = Array.isArray(facets?.categories) ? new Map(facets.categories.map((c) => [c.key, c.count])) : null
  // Only categories that have something published, once the counts are known — plus the one in
  // the URL, so a shared link to an emptied category still shows what it is filtering by.
  const options = t.cats.filter((c) => c.v === 'all' || !counts || counts.has(c.v) || c.v === value)

  return (
    <div role="group" aria-label={t.pfCategory} className="pf-pills">
      {options.map((c) => {
        const v = c.v === 'all' ? '' : c.v
        const on = value === v
        const count = !showCounts ? null : c.v === 'all' ? facets?.totals?.projects : counts?.get(c.v)
        return (
          <button
            key={c.v}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(v)}
            className={`pill pf-pill ${on ? 'pill-on' : ''}`}
          >
            {c.l}
            {count != null && <> <span className="pf-pill__count">{count}</span></>}
          </button>
        )
      })}
    </div>
  )
}

function FacetSelect({ id, label, allLabel, value, options, onChange }) {
  // A value from the URL that the facets do not list (yet) is still shown rather than dropped.
  const list = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options
  if (list.length === 0) return null

  return (
    <Select
      id={id}
      ariaLabel={label}
      placeholder={allLabel}
      value={value}
      onChange={onChange}
      options={[{ value: '', label: allLabel }, ...list]}
      className="pf-select"
      style={value ? { borderColor: 'var(--line-brand)', background: 'var(--surface-3)' } : undefined}
    />
  )
}

const withCount = (label, count) => (count == null ? label : `${label} (${count})`)

/**
 * The facet counts are for the whole published portfolio, not for the current results. Beside a
 * filter they are only true while that filter is the only one in play: with an industry picked, a
 * status reading "In testing (2)" could lead to no results at all. So a filter shows its counts
 * only when no other filter (and no search) is active. The hero's totals are unaffected.
 */
const othersActive = (filters, key) => Object.entries(filters).some(([k, v]) => k !== key && v)

/**
 * Search, category pills and the four selects, plus the result count and "Clear filters".
 *
 * `facets` is null while loading and false when it failed. Without counts the platform and status
 * selects fall back to the API's own value lists; industry and technology have no such list, so
 * they wait for the facets (or stay hidden if the facets never come).
 */
export default function PortfolioToolbar({ filters, facets, onChange, onClear, filtered, countText, searchRef, clearSignal }) {
  const { t, pick } = useLang()
  const data = facets || null

  // Any list the facets lack is treated as not known yet, never trusted to be there.
  const facetList = (key) => (Array.isArray(data?.[key]) ? data[key] : null)
  const counted = (key, count) => (othersActive(filters, key) ? null : count)
  const industries = (facetList('industries') ?? []).map((i) => ({ value: i.key, label: withCount(pick(i, 'name') || i.key, counted('industry', i.count)) }))
  const technologies = (facetList('technologies') ?? []).map((x) => ({ value: x.slug, label: withCount(x.name, counted('tech', x.count)) }))
  const platforms = facetList('platforms')
    ? facetList('platforms').map((p) => ({ value: p.key, label: withCount(t.platformLabels[p.key] ?? p.key, counted('platform', p.count)) }))
    : PLATFORMS.map((p) => ({ value: p, label: t.platformLabels[p] }))
  const statuses = facetList('statuses')
    ? facetList('statuses').map((s) => ({ value: s.key, label: withCount(t.devStatus[s.key] ?? s.key, counted('status', s.count)) }))
    : PUBLIC_STATUSES.map((s) => ({ value: s, label: t.devStatus[s] }))

  return (
    <section aria-label={t.pfSearch}>
      <div className="pf-toolbar">
        <SearchBox
          value={filters.q}
          onCommit={(q) => onChange('q', q, { replace: Boolean(filters.q) })}
          inputRef={searchRef}
          clearSignal={clearSignal}
        />
        <CategoryPills value={filters.category} facets={data} showCounts={!othersActive(filters, 'category')} onSelect={(v) => onChange('category', v)} />
        <div className="pf-selects">
          <FacetSelect id="pf-industry" label={t.pfIndustry} allLabel={t.pfAllIndustries} value={filters.industry} options={industries} onChange={(v) => onChange('industry', v)} />
          <FacetSelect id="pf-tech" label={t.pfTechnology} allLabel={t.pfAllTechnologies} value={filters.tech} options={technologies} onChange={(v) => onChange('tech', v)} />
          <FacetSelect id="pf-platform" label={t.pfPlatform} allLabel={t.pfAllPlatforms} value={filters.platform} options={platforms} onChange={(v) => onChange('platform', v)} />
          <FacetSelect id="pf-status" label={t.pfStatus} allLabel={t.pfAllStatuses} value={filters.status} options={statuses} onChange={(v) => onChange('status', v)} />
        </div>
      </div>

      <div className="pf-toolbar__foot">
        <p className="pf-count" aria-live="polite">{countText}</p>
        {filtered && (
          <button type="button" className="pf-clear" onClick={onClear}>
            <CloseIcon size={15} />
            {t.pfClear}
          </button>
        )}
      </div>
    </section>
  )
}
