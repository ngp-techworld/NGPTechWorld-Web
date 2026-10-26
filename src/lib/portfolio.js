/**
 * The portfolio pages' vocabulary: which URL parameter maps to which API parameter, the API's
 * enum values in the order the site shows them, and small readers for the registry's shapes.
 *
 * The URL uses short, readable names (`?q=&tech=`) because these links get shared; the API uses
 * its own (`search`, `technology`). The mapping lives here so the page never has to know both.
 */

/** URL parameter → API parameter, in the order the toolbar shows them. */
export const FILTER_PARAMS = {
  q: 'search',
  category: 'category',
  industry: 'industry',
  tech: 'technology',
  platform: 'platform',
  status: 'status',
}

export const PER_PAGE = 12

/** Mirrors App\Registry\Enums::PLATFORMS. */
export const PLATFORMS = ['web', 'android', 'ios', 'windows', 'macos', 'linux', 'api', 'cli', 'other']

/** Mirrors Enums::PUBLIC_DEVELOPMENT_STATUSES — the only statuses the API accepts as a filter. */
export const PUBLIC_STATUSES = ['in_development', 'testing', 'completed', 'maintenance']

/** Mirrors Enums::TECH_CATEGORIES; the stack on a project page is grouped in this order. */
export const TECH_CATEGORIES = [
  'frontend', 'backend', 'language', 'database', 'orm', 'authentication', 'authorization', 'api',
  'integration', 'storage', 'cloud', 'containerization', 'ci_cd', 'monitoring', 'testing', 'mobile',
  'tooling', 'other',
]

/** Mirrors Enums::CATEGORIES. */
export const CATEGORIES = ['web', 'mobile', 'ai', 'design', 'erp']

// What PortfolioController::index validates. A value outside these makes the API answer 422, and a
// link carrying one (?category=games, a stale ?status=paused) would show an error that "Try again"
// can never clear — so such a value is treated as not set at all.
const ALLOWED = { category: CATEGORIES, platform: PLATFORMS, status: PUBLIC_STATUSES }
const MAX_LENGTH = { q: 100, industry: 60, tech: 100 }

/** Every filter in the URL, as strings ('' when absent or not one the API accepts). */
export function readFilters(searchParams) {
  const filters = {}
  for (const key of Object.keys(FILTER_PARAMS)) {
    const raw = searchParams.get(key) ?? ''
    if (ALLOWED[key]) filters[key] = ALLOWED[key].includes(raw) ? raw : ''
    else filters[key] = MAX_LENGTH[key] ? raw.slice(0, MAX_LENGTH[key]) : raw
  }
  return filters
}

/** The API parameters for a set of URL filters, leaving out the ones that are not set. */
export function toApiParams(filters) {
  const params = {}
  for (const [urlKey, apiKey] of Object.entries(FILTER_PARAMS)) {
    const value = String(filters[urlKey] ?? '').trim()
    if (value) params[apiKey] = value
  }
  return params
}

export const hasFilters = (filters) => Object.values(filters).some((v) => String(v ?? '').trim() !== '')

/** A `{ ar, en }` pair (highlights, screenshot captions) in the reading language, else the other one. */
export const pickPair = (pair, contentLang) =>
  (pair && typeof pair === 'object' ? pair[contentLang] || pair.en || pair.ar : '') || ''

/** The development status label, falling back to the legacy completed / in-progress pair. */
export function statusLabel(project, t) {
  const label = t.devStatus?.[project?.development_status]
  if (label) return label
  return project?.status === 'completed' ? t.statusCompleted : t.statusInProgress
}

/** Text with something in it — the registry stores optional texts as null, '' or whitespace. */
export const filled = (value) => typeof value === 'string' && value.trim() !== ''
