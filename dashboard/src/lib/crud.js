import { useMemo } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCommon } from '@/i18n'
import { useToast } from '@/ui/Toast'
import { api, isUnreadableResponse } from './api'
import { errorText } from './errors'

const EMPTY = []

/**
 * Re-sort the rows of a cached list envelope (`{ data, meta, links }`) to follow `ids`. Rows that are not in `ids`
 * keep their slots, and the `order` field of the moved rows is updated — this is the optimistic step of useReorder.
 */
export function applyOrder(envelope, ids) {
  if (!envelope || !Array.isArray(envelope.data)) return envelope
  const position = new Map(ids.map((id, index) => [String(id), index]))
  const moved = envelope.data.filter((row) => position.has(String(row.id))).sort((a, b) => position.get(String(a.id)) - position.get(String(b.id)))
  let next = 0
  const data = envelope.data.map((row) => {
    if (!position.has(String(row.id))) return row
    const replacement = moved[next++]
    return 'order' in replacement ? { ...replacement, order: position.get(String(replacement.id)) } : replacement
  })
  return { ...envelope, data }
}

/** Toasts of a mutation hook: `silent` turns both off, `successMessage` overrides the default text. */
function useNotifier({ silent = false, successMessage } = {}, defaultKey = 'saved') {
  const toast = useToast()
  const c = useCommon()
  return {
    success: () => {
      if (!silent) toast.success(successMessage ?? c[defaultKey])
    },
    failure: (err) => {
      if (silent) return
      // a 2xx the client could not read: probably saved, so a warning rather than an error
      if (isUnreadableResponse(err)) toast.warning(errorText(err, c))
      else toast.error(errorText(err, c))
    },
  }
}

/**
 * A write answered 2xx with a body that could not be read was most likely applied: refresh what the resource shows
 * (lists and records) so the screen tells the truth, as a success would have.
 */
function refreshIfUnreadable(qc, keys, err) {
  if (isUnreadableResponse(err)) qc.invalidateQueries({ queryKey: keys.all })
}

/**
 * Hooks for one admin resource (the string after /api/admin), built on react-query:
 *
 *   export const faqs = createCrudHooks('/faqs')
 *   const { rows, meta, isLoading } = faqs.useList({ page: 1, per_page: 15, search: 'x', sort: 'order', dir: 'asc', is_active: 1 })
 *   const { data: faq } = faqs.useOne(id)
 *   const create = faqs.useCreate();   await create.mutateAsync(values)
 *   const update = faqs.useUpdate();   update.mutate({ id, data: { is_active: false } })
 *   const remove = faqs.useDelete();   remove.mutate(id)
 *   const reorder = faqs.useReorder(); reorder.mutate([3, 1, 2])
 *
 * Every mutation invalidates the resource's lists and shows a toast (success text from the common strings, errors
 * localized). Options of the mutation hooks: { silent: true } (no toasts), { successMessage }, plus the usual
 * useMutation callbacks (onSuccess / onError run after ours). List / one hooks take any useQuery option as the
 * last argument (`{ enabled, refetchInterval… }`).
 *
 * Needs <QueryClientProvider>, <ToastProvider> and <LanguageProvider> above it (the app and renderWithProviders have them).
 * Nested resources: `const hooks = useCrudHooks(`/projects/${id}/team-members`)` inside a component.
 */
export function createCrudHooks(resource) {
  const base = ['crud', resource]
  const keys = {
    all: base,
    lists: [...base, 'list'],
    list: (params) => [...base, 'list', params ?? {}],
    one: (id) => [...base, 'one', String(id)],
  }

  /** `rows` = envelope.data, `meta` = Laravel paginator meta; the raw envelope stays in `data`. */
  function useList(params = {}, options = {}) {
    const query = useQuery({
      queryKey: keys.list(params),
      queryFn: ({ signal }) => api.get(resource, params, { signal }),
      placeholderData: keepPreviousData,
      ...options,
    })
    return { ...query, rows: query.data?.data ?? EMPTY, meta: query.data?.meta ?? null }
  }

  /** `data` is the record itself (envelope already unwrapped). Disabled while `id` is empty. */
  function useOne(id, options = {}) {
    const hasId = id !== undefined && id !== null && id !== ''
    return useQuery({
      queryKey: keys.one(id),
      queryFn: ({ signal }) => api.get(`${resource}/${id}`, undefined, { signal }).then((res) => res.data),
      ...options,
      enabled: hasId && (options.enabled ?? true),
    })
  }

  function useCreate({ silent, successMessage, onSuccess, onError, ...rest } = {}) {
    const qc = useQueryClient()
    const notify = useNotifier({ silent, successMessage })
    return useMutation({
      ...rest,
      mutationFn: (body) => api.post(resource, body).then((res) => res.data),
      onSuccess: async (...args) => {
        await qc.invalidateQueries({ queryKey: keys.lists })
        notify.success()
        return onSuccess?.(...args)
      },
      onError: (err, ...args) => {
        refreshIfUnreadable(qc, keys, err)
        notify.failure(err)
        return onError?.(err, ...args)
      },
    })
  }

  /** mutate({ id, data }) — `data` may hold only the changed fields (PUT accepts partial updates). */
  function useUpdate({ silent, successMessage, onSuccess, onError, ...rest } = {}) {
    const qc = useQueryClient()
    const notify = useNotifier({ silent, successMessage })
    return useMutation({
      ...rest,
      mutationFn: ({ id, data }) => api.put(`${resource}/${id}`, data).then((res) => res.data),
      onSuccess: async (record, variables, ...args) => {
        qc.setQueryData(keys.one(variables.id), record)
        await qc.invalidateQueries({ queryKey: keys.lists })
        notify.success()
        return onSuccess?.(record, variables, ...args)
      },
      onError: (err, ...args) => {
        refreshIfUnreadable(qc, keys, err)
        notify.failure(err)
        return onError?.(err, ...args)
      },
    })
  }

  /** mutate(id) */
  function useDelete({ silent, successMessage, onSuccess, onError, ...rest } = {}) {
    const qc = useQueryClient()
    const notify = useNotifier({ silent, successMessage }, 'deleted')
    return useMutation({
      ...rest,
      mutationFn: (id) => api.delete(`${resource}/${id}`),
      onSuccess: async (result, id, ...args) => {
        qc.removeQueries({ queryKey: keys.one(id) })
        await qc.invalidateQueries({ queryKey: keys.lists })
        notify.success()
        return onSuccess?.(result, id, ...args)
      },
      onError: (err, ...args) => {
        refreshIfUnreadable(qc, keys, err)
        notify.failure(err)
        return onError?.(err, ...args)
      },
    })
  }

  /**
   * mutate(idsInNewOrder). The cached lists are re-sorted immediately (optimistic) and restored if the request
   * fails. The API sets `order` = position of each id, so send EVERY row of the list (per_page ≤ 200).
   */
  function useReorder({ silent, successMessage, onSuccess, onError, ...rest } = {}) {
    const qc = useQueryClient()
    const notify = useNotifier({ silent, successMessage }, 'orderSaved')
    return useMutation({
      ...rest,
      mutationFn: (ids) => api.post(`${resource}/reorder`, { ids }),
      onMutate: async (ids) => {
        await qc.cancelQueries({ queryKey: keys.lists })
        const snapshots = qc.getQueriesData({ queryKey: keys.lists })
        qc.setQueriesData({ queryKey: keys.lists }, (old) => applyOrder(old, ids))
        return { snapshots }
      },
      onError: (err, ids, context, ...args) => {
        context?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
        notify.failure(err)
        return onError?.(err, ids, context, ...args)
      },
      onSuccess: (...args) => {
        notify.success()
        return onSuccess?.(...args)
      },
      onSettled: () => qc.invalidateQueries({ queryKey: keys.lists }),
    })
  }

  return { resource, keys, useList, useOne, useCreate, useUpdate, useDelete, useReorder }
}

/** createCrudHooks for a resource path only known at runtime (nested resources). Memoised per path. */
export function useCrudHooks(resource) {
  return useMemo(() => createCrudHooks(resource), [resource])
}
