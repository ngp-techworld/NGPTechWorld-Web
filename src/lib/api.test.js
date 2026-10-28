import { vi } from 'vitest'
import { api } from './api'

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api.getContent', () => {
  test('GETs /content and returns the unwrapped data', async () => {
    const data = { texts: { heroBadge: { ar: 'أ', en: 'a' } }, collections: { process_steps: [] } }
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getContent()).resolves.toEqual(data)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/content$/)
    expect(options?.method ?? 'GET').toBe('GET')
  })

  test('rejects on an HTTP error so the provider can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(404, { message: 'Not Found' })))
    await expect(api.getContent()).rejects.toMatchObject({ status: 404 })
  })

  test('rejects when the server answers with something that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <') },
    }))
    await expect(api.getContent()).rejects.toBeInstanceOf(SyntaxError)
  })

  test('rejects when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.getContent()).rejects.toBeInstanceOf(TypeError)
  })
})

describe('api.getPortfolio', () => {
  test('GETs /portfolio with only the filters that are set, and returns data and meta', async () => {
    const body = { data: [{ slug: 'a' }], meta: { current_page: 2, last_page: 3, total: 30 }, links: {} }
    const fetchMock = vi.fn().mockResolvedValue(respond(200, body))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getPortfolio({ category: 'web', search: '', industry: undefined, technology: 'react native', page: 2, per_page: 12 }))
      .resolves.toEqual({ data: body.data, meta: body.meta })

    const url = new URL(fetchMock.mock.calls[0][0], 'http://x.test')
    expect(url.pathname).toMatch(/\/portfolio$/)
    expect(Object.fromEntries(url.searchParams)).toEqual({ category: 'web', technology: 'react native', page: '2', per_page: '12' })
  })

  test('GETs /portfolio without a query string when nothing is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getPortfolio()

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/portfolio$/)
  })

  test('rejects on an HTTP error, keeping the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(422, { errors: { category: ['bad'] } })))
    await expect(api.getPortfolio({ category: 'games' })).rejects.toMatchObject({ status: 422 })
  })
})

describe('api.getPortfolioFacets', () => {
  test('GETs /portfolio/facets and returns the unwrapped data', async () => {
    const data = { totals: { projects: 3, categories: 2 }, categories: [], industries: [], technologies: [], platforms: [], statuses: [] }
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getPortfolioFacets()).resolves.toEqual(data)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/portfolio\/facets$/)
  })
})

describe('api.getProject', () => {
  test('encodes the slug, so a crafted value cannot change the path or add a query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data: { slug: 'x' } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getProject('../team/sara?x=1')

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/projects\/\.\.%2Fteam%2Fsara%3Fx%3D1$/)
  })
})
