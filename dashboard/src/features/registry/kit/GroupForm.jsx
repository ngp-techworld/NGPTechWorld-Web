import { useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCommon, useStrings } from '@/i18n'
import { api } from '@/lib/api'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { errorText } from '@/lib/errors'
import { Alert, Card, FormActions, useToast } from '@/ui'
import { FieldGrid } from './RegistryField'
import { changedPayload, makeResolver, recordToValues } from './form'
import { overviewKey, registryPath, registryProjects } from './hooks'
import { localizeErrors } from './serverErrors'
import registryStrings from './strings'

/**
 * One operations group of a project (`PUT /registry/projects/{id}/operations/{group}` — administration, monitoring,
 * auth, deployment, data), generated from a field list. Only the changed fields are sent (the API takes partial
 * updates, so two people editing different fields do not overwrite each other); after a save the form is re-based on
 * the stored values the API answers with. A 422 lands on the fields — a "looks like a secret" refusal in plain words.
 *
 * `values` = `registry.operations[group]` as loaded; the parent mounts this once per project (never reset on a
 * background refetch). Without `canWrite` it is read-only.
 */
export function GroupForm({ projectId, group, values, fields, canWrite = false, title, description, ctx }) {
  const c = useCommon()
  const r = useStrings(registryStrings)
  const toast = useToast()
  const queryClient = useQueryClient()
  const resolver = useMemo(() => makeResolver(fields, c, r), [fields, c, r])
  const baseline = useRef(null)
  if (baseline.current === null) baseline.current = recordToValues(fields, values ?? {})

  const form = useForm({ resolver, defaultValues: baseline.current })
  const {
    handleSubmit,
    setError,
    reset,
    formState: { isDirty },
  } = form

  const save = useMutation({ mutationFn: (body) => api.put(`${registryPath(projectId)}/operations/${group}`, body).then((res) => res.data) })

  const submit = handleSubmit(async (formValues) => {
    const body = changedPayload(fields, baseline.current, formValues)
    if (!Object.keys(body).length) return
    try {
      const saved = await save.mutateAsync(body)
      const next = recordToValues(fields, saved.values ?? {})
      baseline.current = next
      reset(next)
      queryClient.setQueryData(registryProjects.keys.one(projectId), (old) => (old ? { ...old, operations: { ...old.operations, [group]: saved.values } } : old))
      toast.success(c.saved)
      // completeness reads some of these fields (owner, technical lead, deployment method, "no database")
      queryClient.invalidateQueries({ queryKey: registryProjects.keys.one(projectId) })
      queryClient.invalidateQueries({ queryKey: registryProjects.keys.lists })
      queryClient.invalidateQueries({ queryKey: overviewKey })
    } catch (err) {
      if (applyServerErrors(setError, localizeErrors(err, r))) toast.error(c.validationFailed)
      else toast.error(errorText(err, c))
    }
  })

  return (
    <Card title={title} description={description} aria-label={title}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset disabled={!canWrite || save.isPending} className="min-w-0">
          <FieldGrid fields={fields} form={form} ctx={ctx} disabled={!canWrite} />
        </fieldset>
        {canWrite ? <FormActions saving={save.isPending} dirty={isDirty} /> : <Alert tone="info">{r.readOnly}</Alert>}
      </form>
    </Card>
  )
}
