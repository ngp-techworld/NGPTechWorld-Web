import { useMutation, useQueryClient } from '@tanstack/react-query'
import { overviewKey, registryProjects } from '@/features/registry/kit/hooks'
import { api, saveBlob } from '@/lib/api'
import { createCrudHooks } from '@/lib/crud'

// The import API (contract: docs/superpowers/notes/phase-2-import-api-contract.md in the portfolio hub), under
// /api/admin/registry. Every route needs two-step sign-in: 403 `mfa_enrollment_required` otherwise.

export const IMPORTS_PATH = '/registry/imports'

/**
 * `useList({ page, status })` → ImportBatchSummary rows; `useOne(id)` → the ImportBatch. A batch is not refetched on
 * window focus: viewing a preview with sensitive values is recorded server side (`viewed_sensitive`), and the preview
 * only changes through refresh or apply, whose answers replace the cached batch.
 */
export const importBatches = createCrudHooks(IMPORTS_PATH)
export const BATCH_QUERY_OPTIONS = { refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 5 * 60 * 1000 }

/** multipart `POST imports` (`file`: the ZIP) → the new ImportBatch. `onProgress({ loaded, total })` while sending. */
export async function uploadPackage(file, { onProgress, signal } = {}) {
  const body = new FormData()
  body.append('file', file, file.name)
  const res = await api.post(IMPORTS_PATH, body, { signal, onUploadProgress: onProgress ?? (() => {}) })
  return res.data
}

/** Writes an answered batch into the cache (the batch page follows its status) and refreshes the history. */
function useStoreBatch() {
  const queryClient = useQueryClient()
  return async (batch) => {
    if (batch?.id) queryClient.setQueryData(importBatches.keys.one(batch.id), batch)
    await queryClient.invalidateQueries({ queryKey: importBatches.keys.lists })
    return batch
  }
}

/** `POST imports/{id}/apply {decisions}` → the applied batch (`report` set); the project's screens are refreshed too. */
export function useApplyImport(id) {
  const store = useStoreBatch()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decisions) => api.post(`${IMPORTS_PATH}/${id}/apply`, { decisions }).then((res) => res.data),
    onSuccess: async (batch) => {
      await store(batch)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registryProjects.keys.all }),
        queryClient.invalidateQueries({ queryKey: overviewKey }),
        queryClient.invalidateQueries({ queryKey: ['crud', '/projects'] }),
      ])
    },
  })
}

/** `POST imports/{id}/refresh` → the batch with its preview recomputed against the current database. */
export function useRefreshImport(id) {
  const store = useStoreBatch()
  return useMutation({ mutationFn: () => api.post(`${IMPORTS_PATH}/${id}/refresh`).then((res) => res.data), onSuccess: store })
}

/** `DELETE imports/{id}` (204): the ZIP is deleted and the batch becomes `cancelled`. */
export function useCancelImport(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`${IMPORTS_PATH}/${id}`),
    onSuccess: async () => {
      queryClient.setQueryData(importBatches.keys.one(id), (batch) => (batch ? { ...batch, status: 'cancelled', abilities: { apply: false, cancel: false } } : batch))
      await queryClient.invalidateQueries({ queryKey: importBatches.keys.lists })
    },
  })
}

/** `GET projects/{id}/export` as a blob (bearer token included), saved as `<slug>-ngp-portfolio.zip`. */
export async function downloadProjectPackage({ id, slug }) {
  const { blob, filename } = await api.download(`/registry/projects/${id}/export`)
  saveBlob(blob, filename || `${slug || `project-${id}`}-ngp-portfolio.zip`)
}
