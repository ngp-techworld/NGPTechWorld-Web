import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Globe, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { Alert, Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, Select, SortableList, Spinner, useConfirm } from '@/ui'
import { useProjectChildren } from './hooks'
import { LINK_TYPES, emptyLink, isHttpUrl, linkToFormValues, linkToPayload, makeLinkSchema } from './schema'
import strings from './strings'

const LINK_FORM_ID = 'project-link-form'

/** Form of the add / edit dialog. Mounted fresh every time the dialog opens. */
function LinkForm({ link, onSubmit, urlRef }) {
  const c = useCommon()
  const t = useStrings(strings)
  const schema = useMemo(() => makeLinkSchema(c), [c])
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: link ? linkToFormValues(link) : emptyLink() })
  const { ref: registerRef, ...urlField } = register('url')

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(linkToPayload(values))
    } catch (err) {
      applyServerErrors(setError, err) // 422 → field errors; anything else already produced a toast
    }
  })

  return (
    <form id={LINK_FORM_ID} onSubmit={submit} noValidate className="space-y-5 pb-2">
      <Field label={t.linkType} required error={errors.type}>
        <Select {...register('type')} options={LINK_TYPES.map((value) => ({ value, label: t.linkTypes[value] }))} />
      </Field>
      <Field label={t.linkUrl} required error={errors.url}>
        <Input
          type="url"
          {...urlField}
          ref={(node) => {
            registerRef(node)
            urlRef.current = node
          }}
          placeholder="https://"
          autoComplete="off"
        />
      </Field>
    </form>
  )
}

function LinkModal({ open, link, onClose, onSubmit, saving }) {
  const c = useCommon()
  const t = useStrings(strings)
  const urlRef = useRef(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={link ? t.linkEdit : t.linkNew}
      size="md"
      closeOnBackdrop={false}
      initialFocusRef={urlRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {c.cancel}
          </Button>
          <Button type="submit" form={LINK_FORM_ID} loading={saving}>
            {saving ? c.saving : c.save}
          </Button>
        </>
      }
    >
      <LinkForm link={link} onSubmit={onSubmit} urlRef={urlRef} />
    </Modal>
  )
}

/**
 * Links of an existing project: live CRUD (add / edit in a dialog, delete with confirm, drag to reorder).
 * Without `canWrite` (the registry's `updatePublic`) the list is shown without any change control.
 */
export function LinksTab({ projectId, canWrite = true }) {
  const t = useStrings(strings)
  const c = useCommon()
  const confirm = useConfirm()
  const { list, create, update, remove, reorder } = useProjectChildren(projectId, 'links')
  const [dialog, setDialog] = useState({ open: false, link: null })
  const rows = list.rows

  const close = () => setDialog({ open: false, link: null })
  const save = async (payload) => {
    if (dialog.link) await update.mutateAsync({ id: dialog.link.id, data: payload })
    else await create.mutateAsync(payload)
    close()
  }
  const onDelete = async (link) => {
    const ok = await confirm({ title: t.deleteLinkTitle, message: t.deleteLinkMessage(link.url), confirmLabel: c.delete })
    if (ok) remove.mutate(link.id)
  }

  let body
  if (list.isError && rows.length === 0) {
    body = (
      <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => list.refetch()}>{c.retry}</Button>}>
        {errorText(list.error, c)}
      </Alert>
    )
  } else if (list.isLoading) {
    body = (
      <div className="flex justify-center py-10 text-accent-lighter">
        <Spinner size={24} label={c.loading} />
      </div>
    )
  } else if (rows.length === 0) {
    body = <EmptyState icon={Link2} title={t.noLinks} description={t.noLinksHint} />
  } else {
    body = (
      <SortableList
        items={rows}
        ariaLabel={t.linksTitle}
        disabled={!canWrite}
        onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
        renderItem={(link, { handle, isDragging }) => {
          const Icon = link.type === 'website' ? Globe : Link2
          return (
            <div className={cx('flex items-center gap-3 rounded-xl border bg-white/[.03] px-3 py-2', isDragging ? 'border-accent-light' : 'border-white/[.08]')}>
              {canWrite ? handle : null}
              <Icon size={18} aria-hidden="true" className="shrink-0 text-accent-lighter" />
              <Badge tone="accent">{t.linkTypes[link.type] ?? link.type}</Badge>
              {isHttpUrl(link.url) ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  title={t.openLink}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-soft hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
                >
                  <span className="truncate">{link.url}</span>
                  <ExternalLink size={13} aria-hidden="true" className="shrink-0" />
                </a>
              ) : (
                <span dir="ltr" className="min-w-0 flex-1 truncate text-sm text-soft">
                  {link.url}
                </span>
              )}
              {canWrite ? (
                <>
                  <IconButton icon={Pencil} label={t.editLink(link.url)} onClick={() => setDialog({ open: true, link })} />
                  <IconButton icon={Trash2} tone="danger" label={t.deleteLink(link.url)} onClick={() => onDelete(link)} disabled={remove.isPending} />
                </>
              ) : null}
            </div>
          )
        }}
      />
    )
  }

  return (
    <>
      <Card
        title={t.linksTitle}
        description={t.linksDescription}
        actions={
          canWrite ? (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ open: true, link: null })}>
              {t.addLink}
            </Button>
          ) : null
        }
      >
        {body}
      </Card>
      <LinkModal open={dialog.open} link={dialog.link} onClose={close} onSubmit={save} saving={create.isPending || update.isPending} />
    </>
  )
}
