const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function req(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
    ...options,
  })
  if (!res.ok) {
    const err = new Error(`API ${res.status}`)
    err.status = res.status
    try { err.body = await res.json() } catch { /* ignore */ }
    throw err
  }
  return res.status === 204 ? null : res.json()
}

/** `?a=1&b=x` from the params that carry a value; empty strings, null and undefined are left out. */
function queryString(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const api = {
  getStats: async () => (await req('/stats')).data,
  getServices: async () => (await req('/services')).data,
  getProjects: async (category) =>
    (await req(`/projects${category && category !== 'all' ? `?category=${category}` : ''}`)).data,
  getProject: async (slug) => (await req(`/projects/${slug}`)).data,
  // The /portfolio page: searched, filtered and paged on the server. Takes the API's own parameter
  // names (search, category, industry, technology, platform, status, featured, page, per_page) and
  // answers `{ data, meta }`, since "load more" needs meta.current_page / meta.last_page.
  getPortfolio: async (params) => {
    const { data, meta } = await req(`/portfolio${queryString(params)}`)
    return { data, meta }
  },
  getPortfolioFacets: async () => (await req('/portfolio/facets')).data,
  getTestimonials: async () => (await req('/testimonials')).data,
  getPartners: async () => (await req('/partners')).data,
  getFaqs: async () => (await req('/faqs')).data,
  getTeam: async () => (await req('/team')).data,
  getTeamMember: async (slug) => (await req(`/team/${slug}`)).data,
  getSettings: async () => (await req('/settings')).data,
  getContent: async () => (await req('/content')).data,
  postContact: (payload) => req('/contact', { method: 'POST', body: JSON.stringify(payload) }),
  getOffers: async () => (await req('/offers')).data,
  getOffer: async (slug) => (await req(`/offers/${encodeURIComponent(slug)}`)).data,
  postOfferRequest: (slug, payload) => req(`/offers/${encodeURIComponent(slug)}/requests`, { method: 'POST', body: JSON.stringify(payload) }),
  getBooks: async () => (await req('/books')).data,
  getBook: async (slug) => (await req('/books/' + encodeURIComponent(slug))).data,
  readBook: (slug) => req('/books/' + encodeURIComponent(slug) + '/read', { method: 'POST' }),
  // Records this visit and answers with the new total, in one request. A POST because it
  // writes; the server deduplicates, so calling it on every page load is not a problem.
  recordVisit: async () => (await req('/visits', { method: 'POST' })).data,
}
