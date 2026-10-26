import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { createCrudHooks } from '@/lib/crud'

/** GET /registry/projects (list with completeness) and GET /registry/projects/{id} (operations, completeness, abilities). */
export const registryProjects = createCrudHooks('/registry/projects')
export const technologiesCatalog = createCrudHooks('/registry/technologies')
export const industriesCatalog = createCrudHooks('/registry/industries')

export const overviewKey = ['registry', 'overview']
// The legacy admin project (`/projects`, see features/projects/hooks.js): same key prefix as its createCrudHooks.
const legacyProjects = ['crud', '/projects']

/** Base path of a project's registry endpoints. */
export const registryPath = (projectId) => `/registry/projects/${projectId}`

/** The 10 overview counters. */
export function useRegistryOverview() {
  return useQuery({ queryKey: overviewKey, queryFn: ({ signal }) => api.get('/registry/overview', undefined, { signal }).then((res) => res.data) })
}

/**
 * Re-reads what shows a project after a change that may move its completeness, publication or abilities (a module
 * added, a group saved…): the registry record, the registry list and the overview counters.
 */
export function useRefreshRegistry(projectId) {
  const queryClient = useQueryClient()
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: registryProjects.keys.one(projectId) }),
        queryClient.invalidateQueries({ queryKey: registryProjects.keys.lists }),
        queryClient.invalidateQueries({ queryKey: overviewKey }),
      ]),
    [queryClient, projectId],
  )
}

/**
 * POST /registry/projects/{id}/<action> (publish · unpublish · feature · unfeature · archive · restore). The answer is
 * the registry record itself: it replaces the cached one, and the legacy record and every list are refreshed.
 */
export function useProjectAction(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action) => api.post(`${registryPath(projectId)}/${action}`).then((res) => res.data),
    onSuccess: async (record) => {
      queryClient.setQueryData(registryProjects.keys.one(projectId), record)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registryProjects.keys.lists }),
        queryClient.invalidateQueries({ queryKey: overviewKey }),
        queryClient.invalidateQueries({ queryKey: legacyProjects }),
      ])
    },
  })
}

/** DELETE /registry/projects/{id} {confirm_slug} (super admins only). */
export function useDeleteRegistryProject(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (confirmSlug) => api.delete(registryPath(projectId), { body: { confirm_slug: confirmSlug } }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: registryProjects.keys.one(projectId) })
      queryClient.removeQueries({ queryKey: [...legacyProjects, 'one', String(projectId)] })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registryProjects.keys.lists }),
        queryClient.invalidateQueries({ queryKey: overviewKey }),
        queryClient.invalidateQueries({ queryKey: [...legacyProjects, 'list'] }),
      ])
    },
  })
}
