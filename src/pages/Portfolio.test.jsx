import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LanguageProvider } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { api } from '../lib/api'
import Portfolio from './Portfolio'

vi.mock('../lib/api', () => ({ api: { getPortfolio: vi.fn(), getPortfolioFacets: vi.fn() } }))

const t = ui.ar // the site starts in Arabic unless the visitor picked another language

const facets = {
  totals: { projects: 14, categories: 3 },
  categories: [{ key: 'web', count: 8 }, { key: 'mobile', count: 4 }, { key: 'ai', count: 2 }],
  industries: [{ key: 'retail', name_ar: 'التجزئة', name_en: 'Retail', count: 5 }],
  technologies: [{ slug: 'laravel', name: 'Laravel', count: 6 }, { slug: 'flutter', name: 'Flutter', count: 3 }],
  platforms: [{ key: 'web', count: 8 }, { key: 'android', count: 4 }],
  statuses: [{ key: 'completed', count: 9 }, { key: 'maintenance', count: 5 }],
}

const card = (slug, extra = {}) => ({
  id: slug, slug, category: 'web', industry: null, client: null, year: 2025, status: 'completed',
  development_status: 'completed', name_ar: `مشروع ${slug}`, name_en: `Project ${slug}`,
  short_ar: `وصف ${slug}`, short_en: `About ${slug}`, cover_image: null, platforms: ['web'],
  technologies: [], highlight: null, public_demo_url: null, featured: false, ...extra,
})

const page = (items, current = 1, last = 1, total = items.length) =>
  ({ data: items, meta: { current_page: current, last_page: last, total, per_page: 12 } })

/** The list requests only — the featured strip asks with `featured`. */
const listCalls = () => api.getPortfolio.mock.calls.map(([p]) => p).filter((p) => !p.featured)
const lastListCall = () => listCalls().at(-1)

/** A promise the test resolves when it chooses to. */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>browser-back</button>
    </>
  )
}

const renderAt = (url = '/portfolio') =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/portfolio" element={<><Portfolio /><LocationProbe /></>} />
          <Route path="/portfolio/:slug" element={<p>detail page</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  )

const urlSearch = () => screen.getByTestId('search').textContent
/** The grid of results, as opposed to the featured strip above it. */
const results = () => screen.getByRole('list', { name: t.portfolioTitle })

/** Matches an element whose whole text is `text`, even when parts of it sit in child spans. */
const wholeText = (text) => (_, el) => el?.textContent === text && [...(el?.children ?? [])].every((c) => c.textContent !== text)

beforeEach(() => {
  localStorage.clear()
  api.getPortfolioFacets.mockReset().mockResolvedValue(facets)
  api.getPortfolio.mockReset().mockImplementation(async (params) =>
    params.featured ? page([card('star', { featured: true })]) : page([card('alpha'), card('beta')], 1, 1, 2))
})

describe('the hero', () => {
  test('states the live counts from the facets', async () => {
    renderAt()
    expect(await screen.findByText(wholeText(t.pfIndex(14, 3)))).toBeInTheDocument()
  })

  test('shows a strip of featured projects, asked for separately', async () => {
    renderAt()
    const strip = await screen.findByRole('region', { name: t.pfFeatured })
    expect(within(strip).getByRole('link', { name: /مشروع star/ })).toHaveAttribute('href', '/portfolio/star')
    expect(api.getPortfolio).toHaveBeenCalledWith({ featured: 1, per_page: 6 })
  })

  test('leaves the strip out when nothing is featured', async () => {
    api.getPortfolio.mockImplementation(async (params) => (params.featured ? page([]) : page([card('alpha')])))
    renderAt()
    await within(results()).findByRole('link', { name: /مشروع alpha/ })
    expect(screen.queryByRole('region', { name: t.pfFeatured })).toBeNull()
  })
})

describe('filters live in the URL', () => {
  test('a shared link restores every filter, in the request and on screen', async () => {
    renderAt('/portfolio?q=shop&category=mobile&industry=retail&tech=laravel&platform=android&status=completed')

    await waitFor(() => expect(lastListCall()).toEqual({
      search: 'shop', category: 'mobile', industry: 'retail', technology: 'laravel',
      platform: 'android', status: 'completed', page: 1, per_page: 12,
    }))
    expect(screen.getByRole('searchbox', { name: t.pfSearch })).toHaveValue('shop')
    expect(screen.getByRole('button', { name: /^موبايل/ })).toHaveAttribute('aria-pressed', 'true')
    // Every select has other filters beside it here, so none shows a (global) count.
    await waitFor(() => expect(screen.getByRole('button', { name: t.pfIndustry })).toHaveTextContent(/^التجزئة$/))
    expect(screen.getByRole('button', { name: t.pfTechnology })).toHaveTextContent(/^Laravel$/)
    expect(screen.getByRole('button', { name: t.pfPlatform })).toHaveTextContent(new RegExp(`^${t.platformLabels.android}$`))
    expect(screen.getByRole('button', { name: t.pfStatus })).toHaveTextContent(new RegExp(`^${t.devStatus.completed}$`))
  })

  test('shows counts beside a filter only while no other filter is active, since they are global', async () => {
    // QA M5: with an industry picked, the status select offered "In testing (2)" for an empty result.
    renderAt('/portfolio?industry=retail')
    await waitFor(() => expect(screen.getByRole('button', { name: t.pfIndustry })).toHaveTextContent('التجزئة (5)'))

    fireEvent.click(screen.getByRole('button', { name: t.pfStatus }))
    expect(screen.getByRole('option', { name: t.devStatus.completed })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /\(\d+\)/ })).toBeNull()
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

    expect(screen.getByRole('button', { name: /^ويب/ })).toHaveAccessibleName('ويب')
    // The hero still states the whole portfolio.
    expect(screen.getByText(wholeText(t.pfIndex(14, 3)))).toBeInTheDocument()
  })

  test('hides the counts while a search is typed in, too', async () => {
    renderAt('/portfolio?q=shop')
    fireEvent.click(await screen.findByRole('button', { name: t.pfIndustry }))
    expect(screen.getByRole('option', { name: 'التجزئة' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^${t.cats[0].l}`) })).toHaveAccessibleName(t.cats[0].l)
  })

  test('shows every count when nothing is filtered', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: t.pfIndustry }))
    expect(screen.getByRole('option', { name: 'التجزئة (5)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ويب/ })).toHaveAccessibleName('ويب 8')
  })

  test('choosing a technology writes ?tech= and asks the API for that technology', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: t.pfTechnology }))
    fireEvent.click(screen.getByRole('option', { name: 'Laravel (6)' }))

    expect(urlSearch()).toBe('?tech=laravel')
    await waitFor(() => expect(lastListCall()).toEqual({ technology: 'laravel', page: 1, per_page: 12 }))
  })

  test('choosing an industry and a category combines them', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: t.pfIndustry }))
    fireEvent.click(screen.getByRole('option', { name: 'التجزئة (5)' }))
    fireEvent.click(screen.getByRole('button', { name: /^ويب/ }))

    expect(new URLSearchParams(urlSearch()).get('industry')).toBe('retail')
    expect(new URLSearchParams(urlSearch()).get('category')).toBe('web')
    await waitFor(() => expect(lastListCall()).toEqual({ industry: 'retail', category: 'web', page: 1, per_page: 12 }))
  })

  test('the back button returns to the previous filters', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: /^ويب/ }))
    await waitFor(() => expect(lastListCall()).toMatchObject({ category: 'web' }))

    fireEvent.click(screen.getByRole('button', { name: 'browser-back' }))

    expect(urlSearch()).toBe('')
    await waitFor(() => expect(lastListCall()).toEqual({ page: 1, per_page: 12 }))
    expect(screen.getByRole('button', { name: new RegExp(`^${t.cats[0].l}`) })).toHaveAttribute('aria-pressed', 'true')
  })

  test('"Clear filters" empties the query', async () => {
    renderAt('/portfolio?category=web&tech=laravel')
    fireEvent.click(await screen.findByRole('button', { name: t.pfClear }))

    expect(urlSearch()).toBe('')
    await waitFor(() => expect(lastListCall()).toEqual({ page: 1, per_page: 12 }))
  })

  test('"Clear filters" hands focus to the search field instead of dropping it with the button', async () => {
    renderAt('/portfolio?category=web')
    const clear = await screen.findByRole('button', { name: t.pfClear })
    clear.focus()
    fireEvent.click(clear)

    expect(screen.queryByRole('button', { name: t.pfClear })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: t.pfSearch }))
  })

  test('"Clear filters" also drops a search that was typed but not yet sent', async () => {
    renderAt('/portfolio?category=web')
    const clear = await screen.findByRole('button', { name: t.pfClear })
    fireEvent.change(screen.getByRole('searchbox', { name: t.pfSearch }), { target: { value: 'shop' } })
    fireEvent.click(clear) // inside the 300 ms window

    await act(() => new Promise((r) => setTimeout(r, 400)))
    expect(urlSearch()).toBe('')
    expect(screen.getByRole('searchbox', { name: t.pfSearch })).toHaveValue('')
    expect(listCalls().some((p) => p.search)).toBe(false)
  })

  test('ignores values the API would reject, instead of showing an error that Retry cannot fix', async () => {
    // The API answers 422 for a category, platform or status outside its enums.
    renderAt('/portfolio?category=games&platform=amiga&status=paused')

    await within(results()).findByRole('link', { name: /مشروع alpha/ })
    expect(lastListCall()).toEqual({ page: 1, per_page: 12 })
    expect(screen.queryByText(t.loadError)).toBeNull()
    expect(screen.queryByRole('button', { name: t.pfClear })).toBeNull()
  })

  test('cuts a search from the URL to the 100 characters the API accepts', async () => {
    renderAt(`/portfolio?q=${'a'.repeat(150)}`)
    await waitFor(() => expect(lastListCall()?.search).toBe('a'.repeat(100)))
  })

  test('there is nothing to clear when no filter is set', async () => {
    renderAt()
    await within(results()).findByRole('link', { name: /مشروع alpha/ })
    expect(screen.queryByRole('button', { name: t.pfClear })).toBeNull()
  })
})

describe('search', () => {
  test('waits until typing stops, then sends one request and writes ?q=', async () => {
    renderAt()
    await within(results()).findByRole('link', { name: /مشروع alpha/ })
    const before = listCalls().length
    const box = screen.getByRole('searchbox', { name: t.pfSearch })

    // Typed at a human pace: each key lands well inside the 300 ms window opened by the one before.
    const pause = (ms) => act(() => new Promise((r) => setTimeout(r, ms)))
    fireEvent.change(box, { target: { value: 'f' } })
    await pause(120)
    fireEvent.change(box, { target: { value: 'fa' } })
    await pause(120)
    fireEvent.change(box, { target: { value: 'fal' } })
    await pause(120)
    expect(listCalls().length).toBe(before) // nothing yet: still inside the 300 ms window

    await waitFor(() => expect(lastListCall()).toEqual({ search: 'fal', page: 1, per_page: 12 }))
    expect(listCalls().slice(before)).toEqual([{ search: 'fal', page: 1, per_page: 12 }])
    expect(urlSearch()).toBe('?q=fal')
  })
})

describe('the results', () => {
  test('render as cards linking to their detail pages, with the total', async () => {
    renderAt()
    const link = await within(results()).findByRole('link', { name: /مشروع alpha/ })
    expect(link).toHaveAttribute('href', '/portfolio/alpha')
    expect(screen.getByText(t.pfResults(2))).toBeInTheDocument()
  })

  test('sit under their own heading, so card titles do not nest under the featured strip', async () => {
    renderAt()
    await within(results()).findByRole('link', { name: /مشروع alpha/ })
    const heading = screen.getByRole('heading', { level: 2, name: t.pfAllProjects })
    expect(heading.compareDocumentPosition(results()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(results()).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)
  })

  test('show skeletons while the first page loads', async () => {
    const pending = deferred()
    api.getPortfolio.mockImplementation((params) => (params.featured ? Promise.resolve(page([])) : pending.promise))
    renderAt()

    expect(results()).toHaveAttribute('aria-busy', 'true')
    await act(async () => pending.resolve(page([card('alpha')])))
    expect(results()).toHaveAttribute('aria-busy', 'false')
  })

  test('"load more" keeps keyboard focus: on the button while loading, then on the first new card', async () => {
    const next = deferred()
    api.getPortfolio.mockImplementation((params) => {
      if (params.featured) return Promise.resolve(page([]))
      return params.page === 2 ? next.promise : Promise.resolve(page([card('alpha'), card('beta')], 1, 2, 3))
    })
    renderAt()
    const button = await screen.findByRole('button', { name: t.pfLoadMore })
    button.focus()
    fireEvent.click(button)

    // Still focusable while busy — a disabled button would drop focus to <body>.
    expect(button).toHaveTextContent(t.pfLoadingMore)
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(document.activeElement).toBe(button)
    fireEvent.click(button) // pressing again while busy asks for nothing more
    expect(listCalls().filter((p) => p.page === 2)).toHaveLength(1)

    // The last page removes the button; focus lands on what was just added instead of on <body>.
    await act(async () => next.resolve(page([card('gamma')], 2, 2, 3)))
    expect(screen.queryByRole('button', { name: t.pfLoadMore })).toBeNull()
    expect(document.activeElement).toBe(within(results()).getByRole('link', { name: /مشروع gamma/ }))
  })

  test('"load more" moves focus to the first new card when more pages remain', async () => {
    api.getPortfolio.mockImplementation(async (params) => {
      if (params.featured) return page([])
      if (params.page === 2) return page([card('gamma'), card('delta')], 2, 3, 6)
      return page([card('alpha'), card('beta')], 1, 3, 6)
    })
    renderAt()
    const button = await screen.findByRole('button', { name: t.pfLoadMore })
    button.focus()
    fireEvent.click(button)

    await within(results()).findByRole('link', { name: /مشروع gamma/ })
    expect(document.activeElement).toBe(within(results()).getByRole('link', { name: /مشروع gamma/ }))
  })

  test('"load more" leaves focus alone when the visitor has moved on while it loaded', async () => {
    const next = deferred()
    api.getPortfolio.mockImplementation((params) => {
      if (params.featured) return Promise.resolve(page([]))
      return params.page === 2 ? next.promise : Promise.resolve(page([card('alpha')], 1, 2, 2))
    })
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: t.pfLoadMore }))
    const box = screen.getByRole('searchbox', { name: t.pfSearch })
    box.focus()

    await act(async () => next.resolve(page([card('gamma')], 2, 2, 2)))
    expect(document.activeElement).toBe(box)
  })

  test('"load more" appends the next page and keeps the earlier one', async () => {
    api.getPortfolio.mockImplementation(async (params) => {
      if (params.featured) return page([])
      return params.page === 2 ? page([card('gamma')], 2, 2, 3) : page([card('alpha'), card('beta')], 1, 2, 3)
    })
    renderAt('/portfolio?category=web')

    fireEvent.click(await screen.findByRole('button', { name: t.pfLoadMore }))

    expect(await within(results()).findByRole('link', { name: /مشروع gamma/ })).toBeInTheDocument()
    expect(within(results()).getByRole('link', { name: /مشروع alpha/ })).toBeInTheDocument()
    expect(lastListCall()).toEqual({ category: 'web', page: 2, per_page: 12 })
    expect(screen.queryByRole('button', { name: t.pfLoadMore })).toBeNull() // that was the last page
  })

  test('a slow answer for filters already left behind never replaces the newer one', async () => {
    const web = deferred()
    const mobile = deferred()
    api.getPortfolio.mockImplementation((params) => {
      if (params.featured) return Promise.resolve(page([]))
      if (params.category === 'web') return web.promise
      if (params.category === 'mobile') return mobile.promise
      return Promise.resolve(page([card('alpha')]))
    })
    renderAt()
    await within(results()).findByRole('link', { name: /مشروع alpha/ })

    fireEvent.click(screen.getByRole('button', { name: /^ويب/ }))
    fireEvent.click(screen.getByRole('button', { name: /^موبايل/ }))
    await act(async () => mobile.resolve(page([card('phone', { category: 'mobile' })])))
    await act(async () => web.resolve(page([card('site')])))

    expect(within(results()).getByRole('link', { name: /مشروع phone/ })).toBeInTheDocument()
    expect(within(results()).queryByRole('link', { name: /مشروع site/ })).toBeNull()
  })

  test('a "load more" answer that lands after the filters changed never joins the new list', async () => {
    const second = deferred()
    api.getPortfolio.mockImplementation((params) => {
      if (params.featured) return Promise.resolve(page([]))
      if (params.category === 'mobile') return Promise.resolve(page([card('phone', { category: 'mobile' })]))
      return params.page === 2 ? second.promise : Promise.resolve(page([card('alpha')], 1, 2, 2))
    })
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: t.pfLoadMore }))
    fireEvent.click(screen.getByRole('button', { name: /^موبايل/ }))
    await within(results()).findByRole('link', { name: /مشروع phone/ })

    await act(async () => second.resolve(page([card('gamma')], 2, 2, 2)))

    expect(within(results()).getAllByRole('link').map((a) => a.textContent)).toEqual(['مشروع phone'])
  })

  test('an answer that arrives after the page has gone is dropped quietly', async () => {
    const pending = deferred()
    api.getPortfolio.mockImplementation((params) => (params.featured ? Promise.resolve(page([])) : pending.promise))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderAt()

    unmount()
    await act(async () => pending.resolve(page([card('alpha')])))

    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  test('survives facets that are missing some of their lists', async () => {
    api.getPortfolioFacets.mockResolvedValue({ totals: { projects: 2, categories: 1 } })
    renderAt()

    expect(await within(results()).findByRole('link', { name: /مشروع alpha/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^${t.cats[0].l}`) })).toBeInTheDocument()
  })

  test('say so, and offer to clear, when no project matches', async () => {
    api.getPortfolio.mockImplementation(async (params) => (params.featured ? page([]) : page([], 1, 1, 0)))
    renderAt('/portfolio?category=ai')

    const empty = await screen.findByText(t.pfEmpty)
    const panel = empty.closest('[role="status"]')
    fireEvent.click(within(panel).getByRole('button', { name: t.pfClear }))

    expect(urlSearch()).toBe('')
  })

  test('say the portfolio is coming when nothing is published and no filter is set', async () => {
    api.getPortfolio.mockImplementation(async () => page([], 1, 1, 0))
    renderAt()
    expect(await screen.findByText(t.pfNone)).toBeInTheDocument()
    expect(screen.queryByText(t.pfEmpty)).toBeNull()
  })

  test('explain a failure and try again on request', async () => {
    let fail = true
    api.getPortfolio.mockImplementation(async (params) => {
      if (params.featured) return page([])
      if (fail) throw new Error('down')
      return page([card('alpha')])
    })
    renderAt()

    expect(await screen.findByText(t.loadError)).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: t.pfRetry }))

    expect(await within(results()).findByRole('link', { name: /مشروع alpha/ })).toBeInTheDocument()
    expect(screen.queryByText(t.loadError)).toBeNull()
  })

  test('the page still works when the facet counts cannot be loaded', async () => {
    api.getPortfolioFacets.mockRejectedValue(new Error('down'))
    renderAt()

    expect(await within(results()).findByRole('link', { name: /مشروع alpha/ })).toBeInTheDocument()
    expect(screen.queryByText(wholeText(t.pfIndex(14, 3)))).toBeNull()
    expect(screen.getByRole('button', { name: /^ويب/ })).toBeInTheDocument() // categories fall back to the built-in list
  })
})
