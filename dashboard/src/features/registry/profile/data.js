import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { registryPath } from '../kit/hooks'

// The data of the project profile: every registry collection the caller may read, each loaded whole.

/** The largest page a collection list gives (AdminCrudController: per_page is capped at 200). */
export const PAGE_SIZE = 200
/** A safety stop for the page loop: 200 × 50 rows is far past any project. */
const MAX_PAGES = 50

/** The tier of every collection the profile reads (each controller's `$tier`; members are internal, MFA-gated). */
export const SEGMENT_TIERS = {
  modules: 'public',
  features: 'public',
  technologies: 'public',
  screenshots: 'public',
  'quality-attributes': 'internal',
  'maintenance-records': 'internal',
  integrations: 'internal',
  documents: 'internal',
  members: 'internal',
  repositories: 'sensitive',
  environments: 'sensitive',
  endpoints: 'sensitive',
  servers: 'sensitive',
  accounts: 'sensitive',
  'secret-refs': 'sensitive',
  databases: 'sensitive',
  backups: 'sensitive',
  'env-vars': 'sensitive',
  commands: 'sensitive',
}
export const SEGMENTS = Object.keys(SEGMENT_TIERS)

/** The ability that lets the caller read each tier (ProjectPolicy, sent as `abilities` with the registry record). */
export const TIER_ABILITY = { public: 'view', internal: 'viewInternal', sensitive: 'viewSensitive' }

/** May these `abilities` read `tier`? Decided from the server's answer only. */
export const canRead = (abilities, tier) => Boolean(abilities?.[TIER_ABILITY[tier]])

// The parameters of the whole-list request, also its cache key. It sits under the crud key of the collection
// (['crud', path, 'list', …]), so whatever the project page invalidates after a change refreshes the profile too.
const ALL_ROWS = { profile: 'all' }

/**
 * Every row of a collection: the largest pages the API gives, one after the other until the last one (MagiaGift has
 * 133 env vars, a list may outgrow a page). Answers a list envelope `{ data, meta }` holding all the rows.
 */
export async function fetchAllRows(path, { signal } = {}) {
  const rows = []
  let page = 1
  let lastPage = 1
  let total = 0
  do {
    const answer = await api.get(path, { per_page: PAGE_SIZE, page }, { signal })
    const data = Array.isArray(answer?.data) ? answer.data : []
    rows.push(...data)
    lastPage = Number(answer?.meta?.last_page) || 1
    total = Number(answer?.meta?.total) || rows.length
    page += 1
  } while (page <= lastPage && page <= MAX_PAGES)
  return { data: rows, meta: { current_page: 1, last_page: 1, per_page: rows.length, total } }
}

export const collectionKey = (projectId, segment) => ['crud', `${registryPath(projectId)}/${segment}`, 'list', ALL_ROWS]

/**
 * One query per collection, in parallel: those of a tier the caller cannot read are never enabled (never fetched).
 * Answers `{ [segment]: { rows, isLoading, isError, error, refetch, isFetching, enabled } }`.
 *
 * Reading a sensitive collection is audited, so these never refetch on focus and stay fresh for a minute: moving
 * between the profile and the project page does not read them again.
 */
export function useProfileCollections(projectId, abilities) {
  const enabled = SEGMENTS.map((segment) => Boolean(projectId) && canRead(abilities, SEGMENT_TIERS[segment]))
  const results = useQueries({
    queries: SEGMENTS.map((segment, index) => ({
      queryKey: collectionKey(projectId, segment),
      queryFn: ({ signal }) => fetchAllRows(`${registryPath(projectId)}/${segment}`, { signal }),
      enabled: enabled[index],
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  })
  return Object.fromEntries(
    SEGMENTS.map((segment, index) => {
      const result = results[index]
      return [
        segment,
        {
          enabled: enabled[index],
          rows: result.data?.data ?? EMPTY,
          total: result.data?.meta?.total ?? 0,
          isLoading: enabled[index] && result.isPending,
          isError: result.isError && !result.data,
          error: result.error,
          isFetching: result.isFetching,
          refetch: result.refetch,
        },
      ]
    }),
  )
}

const EMPTY = []
