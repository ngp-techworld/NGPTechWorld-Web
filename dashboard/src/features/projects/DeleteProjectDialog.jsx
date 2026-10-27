import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { Button, Field, Input, Modal, useToast } from '@/ui'
import strings from './strings'

/**
 * `DELETE registry/projects/{id}` with `{confirm_slug}` — or, on a backend without the registry (404), the original
 * `DELETE /projects/{id}` with the same body (API contract B5). Deleting a project takes every registry record with it,
 * so every list and record that showed it is dropped or re-read.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, slug }) => {
      const body = { confirm_slug: slug }
      try {
        return await api.delete(`/registry/projects/${id}`, { body })
      } catch (err) {
        if (err.status !== 404) throw err
        return api.delete(`/projects/${id}`, { body })
      }
    },
    onSuccess: async (_, { id }) => {
      queryClient.removeQueries({ queryKey: ['crud', '/projects', 'one', String(id)] })
      queryClient.removeQueries({ queryKey: ['crud', '/registry/projects', 'one', String(id)] })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crud', '/projects', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['crud', '/registry/projects', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'overview'] }),
      ])
    },
  })
}

/**
 * The only way to delete a project: type its slug (spec §4). `project` = { id, slug, name }; `onDeleted` runs after a
 * successful delete (e.g. leave the deleted project's page). Used by the project list and the Publication card.
 */
export function DeleteProjectDialog({ project, onClose, onDeleted }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const { pickField } = useLanguage()
  const remove = useDeleteProject()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const open = Boolean(project)

  const close = () => {
    if (remove.isPending) return
    setTyped('')
    setError('')
    onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await remove.mutateAsync({ id: project.id, slug: typed })
      toast.success(t.deleted)
      setTyped('')
      onClose()
      onDeleted?.(project)
    } catch (err) {
      if (err.status === 422) setError(t.deleteSlugMismatch)
      else toast.error(errorText(err, c))
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.deleteTitle}
      description={open ? t.deleteMessage(pickField(project, 'name') || project.slug) : undefined}
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={remove.isPending}>
            {c.cancel}
          </Button>
          <Button type="submit" form="delete-project-form" variant="danger" icon={Trash2} loading={remove.isPending} disabled={!open || typed !== project.slug}>
            {c.delete}
          </Button>
        </>
      }
    >
      {open ? (
        <form id="delete-project-form" onSubmit={submit} noValidate className="pb-2">
          <Field label={t.deleteTypeSlug(project.slug)} error={error}>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} dir="ltr" autoComplete="off" spellCheck={false} placeholder={project.slug} />
          </Field>
        </form>
      ) : null}
    </Modal>
  )
}
