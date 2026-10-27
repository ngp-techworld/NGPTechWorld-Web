import { useMemo, useState } from 'react'
import { Image as ImageIcon, Pencil, Star, Trash2, Upload } from 'lucide-react'
import {
  AuthImage,
  CONTENT_LANGUAGES,
  KEY_PATTERN,
  RecordDialog,
  SCREENSHOT_PLATFORMS,
  actionErrorText,
  changedPayload,
  registryPath,
  toFormData,
  toOptions,
  useRefreshRegistry,
  valuesToPayload,
} from '@/features/registry/kit'
import { useCrudHooks } from '@/lib/crud'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { Alert, Badge, Button, EmptyState, IconButton, Pagination, SortableList, Spinner, Switch, useConfirm, useToast } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
// Reordering sends every id (the API sets `order` = position): only offered while the whole list fits one page.
// 48 a page: each private thumbnail is one request to the file stream, which allows 60 a minute.
const PER_PAGE = 48

/** The fields of a screenshot (ScreenshotController::rules). Visibility is set at upload, then by the switch. */
function screenshotFields({ t, r, c }, { upload }) {
  return [
    { name: 'title', type: 'bilingual', label: t.title, max: 255 },
    { name: 'description', type: 'bilingual', label: t.description, multiline: true, rows: 2, max: 2000 },
    { name: 'platform', type: 'select', label: t.platform, nullable: false, options: toOptions(SCREENSHOT_PLATFORMS, r.screenshotPlatforms) },
    { name: 'language', type: 'select', label: t.language, options: toOptions(CONTENT_LANGUAGES, { ar: c.arabic, en: c.english }) },
    { name: 'module_key', type: 'text', label: t.moduleKey, max: 80, pattern: KEY_PATTERN, patternMessage: r.keyFormat, dir: 'ltr' },
    { name: 'captured_at', type: 'date', label: t.capturedAt },
    upload ? { name: 'is_public', type: 'switch', label: t.publicScreenshot, hint: t.screenshotsDescription } : null,
  ].filter(Boolean)
}

/**
 * A project's screenshots: multipart upload (public or private), thumbnails (a private one is streamed with the
 * bearer token), the public / private switch (the API moves the file between disks), "make it the cover" for a
 * public screenshot, titles, drag to reorder and delete. Rows mirrored from the original gallery belong to the
 * Media tab: they can be described here, not hidden or deleted.
 */
export function ScreenshotsTab({ registry }) {
  const env = useRegistryEnv()
  const { t, r, c, pickField } = env
  const toast = useToast()
  const confirm = useConfirm()
  const refresh = useRefreshRegistry(registry.id)
  const hooks = useCrudHooks(`${registryPath(registry.id)}/screenshots`)
  const [page, setPage] = useState(1)
  const list = hooks.useList({ per_page: PER_PAGE, page, sort: 'order', dir: 'asc' })
  const failed = (err) => toast.error(actionErrorText(err, r, c))
  const create = hooks.useCreate({ onSuccess: refresh })
  const update = hooks.useUpdate({ onSuccess: refresh })
  const quick = hooks.useUpdate({
    silent: true,
    onSuccess: (record, variables) => {
      toast.success(variables.data.is_cover ? t.coverSaved : c.saved)
      refresh()
    },
    onError: failed,
  })
  const remove = hooks.useDelete({
    silent: true,
    onSuccess: () => {
      toast.success(c.deleted)
      refresh()
    },
    onError: failed,
  })
  const reorder = hooks.useReorder()
  const canWrite = registry.abilities.updatePublic
  const canReorder = canWrite && (list.meta?.last_page ?? 1) <= 1
  const [dialog, setDialog] = useState({ open: false, record: null })

  const uploadConfig = useMemo(
    () => ({
      fields: screenshotFields(env, { upload: true }),
      defaults: { platform: 'desktop', is_public: false },
      upload: { label: t.screenshotFile, hint: t.screenshotFileHint, accept: EXTENSIONS.map((ext) => `.${ext}`).join(','), extensions: EXTENSIONS, maxMB: 10 },
    }),
    [env, t],
  )
  const editConfig = useMemo(() => ({ fields: screenshotFields(env, { upload: false }) }), [env])

  const rows = list.rows
  const nameOf = (row) => pickField(row, 'title') || `${t.untitled} #${row.id}`
  const pendingOf = (row) => (quick.isPending && quick.variables?.id === row.id ? quick.variables.data : {})

  const save = async ({ values, fields, baseline, file }) => {
    if (dialog.record) {
      const data = changedPayload(fields, baseline, values)
      if (Object.keys(data).length) await update.mutateAsync({ id: dialog.record.id, data })
    } else {
      await create.mutateAsync(toFormData(valuesToPayload(fields, values), file))
    }
    setDialog({ open: false, record: null })
  }

  const onDelete = async (row) => {
    if (await confirm({ title: r.deleteTitle(t.screenshotLabel), message: r.deleteMessage(nameOf(row)), confirmLabel: c.delete })) remove.mutate(row.id)
  }

  const tile = (row, handle) => {
    const name = nameOf(row)
    const isPublic = pendingOf(row).is_public ?? row.is_public
    const isCover = pendingOf(row).is_cover ?? row.is_cover
    return (
      <article aria-label={name} className="overflow-hidden rounded-card border border-white/[.08] bg-white/[.03]">
        <div className="relative aspect-video bg-white/[.04]">
          <AuthImage src={row.thumbnail_url ?? row.url} alt={name} />
          <div className="absolute start-2 top-2 flex flex-wrap gap-1">
            <Badge tone={isPublic ? 'success' : 'neutral'}>{isPublic ? t.publicScreenshot : t.privateScreenshot}</Badge>
            {isCover ? (
              <Badge tone="gold">
                <Star size={11} aria-hidden="true" />
                {t.coverBadge}
              </Badge>
            ) : null}
            {row.legacy_gallery ? <Badge tone="info">{t.fromGallery}</Badge> : null}
          </div>
          {handle ? <div className="absolute end-1.5 top-1.5 rounded-lg bg-deep/70">{handle}</div> : null}
        </div>
        <div className="space-y-3 p-3">
          <div className="min-w-0">
            <p dir="auto" className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-muted">{r.screenshotPlatforms[row.platform] ?? row.platform}</p>
          </div>
          {row.legacy_gallery ? <p className="text-[11px] text-muted">{t.fromGalleryHint}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canWrite && !row.legacy_gallery ? (
              <Switch checked={Boolean(isPublic)} onChange={(next) => quick.mutate({ id: row.id, data: { is_public: next } })} label={t.publicScreenshot} aria-label={t.publicSwitch(name)} disabled={quick.isPending && quick.variables?.id === row.id} />
            ) : (
              <span />
            )}
            <div className="flex items-center gap-0.5">
              {canWrite && isPublic && !isCover ? <IconButton size="sm" icon={Star} label={t.setCoverOf(name)} onClick={() => quick.mutate({ id: row.id, data: { is_cover: true } })} /> : null}
              <IconButton size="sm" icon={Pencil} label={canWrite ? t.editScreenshot(name) : r.viewItem(name)} onClick={() => setDialog({ open: true, record: row })} />
              {canWrite && !row.legacy_gallery ? <IconButton size="sm" icon={Trash2} tone="danger" label={t.deleteScreenshot(name)} onClick={() => onDelete(row)} /> : null}
            </div>
          </div>
        </div>
      </article>
    )
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
    body = <EmptyState icon={ImageIcon} title={t.noScreenshots} description={canWrite ? t.noScreenshotsHint : undefined} />
  } else if (canReorder) {
    body = (
      <SortableList
        items={rows}
        layout="grid"
        ariaLabel={t.reorderScreenshots}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
        renderItem={(row, { handle, isDragging }) => <div className={cx(isDragging && 'opacity-80')}>{tile(row, handle)}</div>}
      />
    )
  } else {
    body = (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li key={row.id}>{tile(row, null)}</li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-label={t.screenshotsTitle} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{t.screenshotsTitle}</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">{t.screenshotsDescription}</p>
        </div>
        {canWrite ? (
          <Button size="sm" icon={Upload} onClick={() => setDialog({ open: true, record: null })}>
            {t.uploadScreenshot}
          </Button>
        ) : null}
      </div>
      {body}
      {list.meta && list.meta.last_page > 1 ? <Pagination meta={list.meta} onPageChange={setPage} /> : null}
      <RecordDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, record: null })}
        title={dialog.record ? (canWrite ? t.editScreenshot(nameOf(dialog.record)) : r.viewItem(nameOf(dialog.record))) : t.uploadScreenshot}
        config={dialog.record ? editConfig : uploadConfig}
        record={dialog.record}
        canWrite={canWrite}
        onSubmit={save}
        saving={create.isPending || update.isPending}
      />
    </section>
  )
}
