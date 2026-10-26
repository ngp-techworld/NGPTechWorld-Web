import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { useCrudHooks } from '@/lib/crud'
import { errorText } from '@/lib/errors'
import { cx } from '@/lib/cx'
import { Alert, Button, DataTable, Field, Input, Modal, Pagination, SearchInput, Select, useConfirm, useToast } from '@/ui'
import { FieldGrid } from './RegistryField'
import { belongsToForm, changedPayload, makeResolver, recordToValues, valuesToPayload } from './form'
import { actionErrorText, localizeErrors } from './serverErrors'
import registryStrings from './strings'

const FORM_ID = 'registry-collection-form'

/** A request body as multipart (uploads): booleans as 1/0, lists as `key[]`, nulls left out. */
export function toFormData(payload, file) {
  const body = new FormData()
  if (file) body.append('file', file)
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) value.forEach((item) => body.append(`${key}[]`, String(item)))
    else if (typeof value === 'boolean') body.append(key, value ? '1' : '0')
    else if (typeof value !== 'object') body.append(key, String(value))
  })
  return body
}

function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(String(name ?? ''))
  return match ? match[1].toLowerCase() : ''
}

/** The add / edit / view form of one record, generated from `config.fields`. Mounted fresh every time it opens. */
function RecordForm({ config, record, ctx, canWrite, onSubmit }) {
  const c = useCommon()
  const r = useStrings(registryStrings)
  const fields = useMemo(() => (typeof config.fields === 'function' ? config.fields(ctx, record) : config.fields), [config, ctx, record])
  const resolver = useMemo(() => makeResolver(fields, c, r), [fields, c, r])
  const defaults = useMemo(() => recordToValues(fields, record, config.defaults), [fields, record, config.defaults])
  const baseline = useRef(defaults)
  const form = useForm({ resolver, defaultValues: defaults })
  const upload = !record && config.upload
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [otherErrors, setOtherErrors] = useState([])

  const pickFile = (event) => {
    const next = event.target.files?.[0] ?? null
    setFileError('')
    if (next && upload.extensions && !upload.extensions.includes(extensionOf(next.name))) {
      setFileError(r.fileBadType)
      setFile(null)
      return
    }
    if (next && upload.maxMB && next.size > upload.maxMB * 1024 * 1024) {
      setFileError(r.fileTooLarge(upload.maxMB))
      setFile(null)
      return
    }
    setFile(next)
  }

  const validateAndSave = form.handleSubmit(async (values) => {
    if (upload && !file) return
    setOtherErrors([])
    try {
      await onSubmit({ values, fields, baseline: baseline.current, file })
    } catch (err) {
      const localized = localizeErrors(err, r)
      if (applyServerErrors(form.setError, localized)) {
        const errors = localized.errors
        if (errors.file) setFileError(errors.file[0])
        setOtherErrors(
          Object.entries(errors)
            .filter(([key]) => key !== 'file' && !belongsToForm(fields, key))
            .map(([, messages]) => messages[0]),
        )
      }
    }
  })

  // the file is checked together with the fields, so every problem shows at once
  const submit = (event) => {
    if (upload && !file) setFileError((current) => current || r.fileRequired)
    return validateAndSave(event)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-5 pb-2">
      {!canWrite ? <Alert tone="info">{r.readOnly}</Alert> : null}
      {otherErrors.length ? (
        <Alert tone="danger" title={r.otherErrors}>
          <ul className="list-inside list-disc">
            {otherErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {upload ? (
        <Field label={upload.label ?? r.file} required error={fileError} hint={upload.hint}>
          <Input type="file" accept={upload.accept} onChange={pickFile} data-testid="collection-file-input" />
        </Field>
      ) : null}
      <fieldset disabled={!canWrite} className="min-w-0">
        <FieldGrid fields={fields} form={form} ctx={ctx} disabled={!canWrite} />
      </fieldset>
    </form>
  )
}

/**
 * One registry collection of a project (or a catalog): a table plus an add / edit dialog generated from a field list.
 *
 *   <CollectionTab resource={`/registry/projects/${id}/modules`} config={modulesConfig(t, r)} canWrite={abilities.updatePublic} />
 *
 * config = {
 *   title, description, itemLabel (dialog titles: "Add <itemLabel>"), fields (array, or (ctx, record) => array), defaults,
 *   columns: (helpers) => DataTable columns, rowName(row) (delete message), rowActions?(row, helpers) → extra actions,
 *   filters?: [{ name, label, options }], search?: bool, sort?: { sort, dir }, perPage?, emptyTitle, emptyHint,
 *   upload?: { accept, extensions, maxMB, label, hint } (create sends multipart with `file`), modalSize?
 * }
 * helpers = { canWrite, open(row), update(row, data) (quiet inline change), isUpdating(row), ctx }.
 * Without `canWrite` the table and the dialog are read-only (no add, no delete). Every successful change calls `onChanged`.
 */
export function CollectionTab({ resource, config, canWrite = false, ctx, onChanged, className }) {
  const c = useCommon()
  const r = useStrings(registryStrings)
  const toast = useToast()
  const confirm = useConfirm()
  const hooks = useCrudHooks(resource)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState({ open: false, record: null })

  const params = { per_page: config.perPage ?? 100, page, sort: config.sort?.sort ?? 'order', dir: config.sort?.dir ?? 'asc', ...filters }
  const list = hooks.useList(params)
  const changed = () => onChanged?.()
  const create = hooks.useCreate({ onSuccess: changed })
  const update = hooks.useUpdate({ onSuccess: changed })
  const failed = (err) => toast.error(actionErrorText(err, r, c))
  // inline changes and deletes have no form to show a 422 on: their errors are toasted in words instead
  const quick = hooks.useUpdate({
    silent: true,
    onSuccess: () => {
      toast.success(c.saved)
      changed()
    },
    onError: failed,
  })
  const remove = hooks.useDelete({
    silent: true,
    onSuccess: () => {
      toast.success(c.deleted)
      changed()
    },
    onError: failed,
  })

  const close = () => setDialog({ open: false, record: null })
  const open = (record) => setDialog({ open: true, record })
  const setFilter = (name, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const save = async ({ values, fields, baseline, file }) => {
    if (dialog.record) {
      const data = changedPayload(fields, baseline, values)
      if (Object.keys(data).length) await update.mutateAsync({ id: dialog.record.id, data })
    } else {
      const payload = { ...(config.extraPayload ?? {}), ...valuesToPayload(fields, values) }
      await create.mutateAsync(config.upload ? toFormData(payload, file) : payload)
    }
    close()
  }

  const onDelete = async (row) => {
    const ok = await confirm({ title: r.deleteTitle(config.itemLabel), message: r.deleteMessage(config.rowName?.(row) ?? `#${row.id}`), confirmLabel: c.delete })
    if (ok) remove.mutate(row.id)
  }

  const helpers = {
    canWrite,
    ctx,
    open,
    update: (row, data) => quick.mutate({ id: row.id, data }),
    isUpdating: (row) => quick.isPending && quick.variables?.id === row.id,
    pendingData: (row) => (quick.isPending && quick.variables?.id === row.id ? quick.variables.data : null),
  }
  const rows = list.rows
  const columns = config.columns(helpers)
  const rowActions = (row) => [
    ...(config.rowActions?.(row, helpers) ?? []),
    { key: 'open', label: canWrite ? c.edit : r.view, icon: canWrite ? Pencil : Eye, onClick: () => open(row) },
    { key: 'delete', label: c.delete, icon: Trash2, tone: 'danger', hidden: !canWrite || config.canDelete?.(row) === false, onClick: () => onDelete(row), disabled: remove.isPending },
  ]
  const hasFilters = Object.values(filters).some((value) => value !== '' && value !== undefined)

  return (
    <section aria-label={config.title} className={cx('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{config.title}</h2>
          {config.description ? <p className="mt-0.5 max-w-3xl text-sm text-muted">{config.description}</p> : null}
        </div>
        {canWrite ? (
          <Button size="sm" icon={config.upload ? Upload : Plus} onClick={() => open(null)}>
            {r.addItem(config.itemLabel)}
          </Button>
        ) : null}
      </div>
      {config.search || config.filters?.length ? (
        <div className="flex flex-wrap items-center gap-3">
          {config.search ? (
            <SearchInput value={filters.search ?? ''} onChange={(search) => setFilter('search', search)} placeholder={config.searchPlaceholder} className="min-w-[200px] flex-1" />
          ) : null}
          {(config.filters ?? []).map((filter) => (
            <Select
              key={filter.name}
              aria-label={filter.label}
              value={filters[filter.name] ?? ''}
              onChange={(event) => setFilter(filter.name, event.target.value)}
              placeholder={r.filterAll(filter.label)}
              options={filter.options}
              wrapperClassName="w-full sm:w-52"
            />
          ))}
        </div>
      ) : null}
      {list.isError && rows.length === 0 ? (
        <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => list.refetch()}>{c.retry}</Button>}>
          {errorText(list.error, c)}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={list.isLoading}
          busy={list.isFetching && !list.isLoading}
          rowActions={rowActions}
          onRowClick={open}
          caption={config.title}
          minWidth={config.minWidth ?? 560}
          skeletonRows={3}
          emptyTitle={hasFilters ? c.noResults : config.emptyTitle}
          emptyDescription={hasFilters ? c.noResultsHint : config.emptyHint}
          emptyIcon={config.icon}
        />
      )}
      {list.meta && list.meta.last_page > 1 ? <Pagination meta={list.meta} onPageChange={setPage} /> : null}

      <Modal
        open={dialog.open}
        onClose={close}
        title={dialog.record ? (canWrite ? r.editItem(config.itemLabel) : r.viewItem(config.itemLabel)) : r.addItem(config.itemLabel)}
        size={config.modalSize ?? 'lg'}
        closeOnBackdrop={false}
        footer={
          canWrite ? (
            <>
              <Button variant="secondary" onClick={close} disabled={create.isPending || update.isPending}>
                {c.cancel}
              </Button>
              <Button type="submit" form={FORM_ID} loading={create.isPending || update.isPending}>
                {create.isPending || update.isPending ? c.saving : c.save}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              {c.close}
            </Button>
          )
        }
      >
        <RecordForm key={dialog.record?.id ?? 'new'} config={config} record={dialog.record} ctx={ctx} canWrite={canWrite} onSubmit={save} />
      </Modal>
    </section>
  )
}
