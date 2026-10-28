import { useMemo, useState } from 'react'
import { Image as ImageIcon, ListOrdered, Lock, Pencil, Star, Trash2, Upload } from 'lucide-react'
import {
  AuthImage,
  apiPathOf,
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
import { isUnreadableResponse } from '@/lib/api'
import { useCrudHooks } from '@/lib/crud'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { Alert, Badge, Button, EmptyState, IconButton, Pagination, SortableList, Spinner, Switch, useConfirm, useToast } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
// 48 a page: each private thumbnail is one request to the file stream, which allows 60 a minute.
const PER_PAGE = 48
// Reordering sends every id (the API sets `order` = position of each id it gets), so it needs the whole list in one
// request: up to the list's page-size cap (AdminCrudController: per_page <= 200). While everything fits one page the
// tiles are dragged in place; past that, a reorder mode loads them all as small tiles (private ones without a preview,
// to stay under the stream's limit).
export const REORDER_LIMIT = 200
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' // grid-cols-1 = minmax(0, 1fr): long titles truncate

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
 * public screenshot, titles, drag to reorder (in place while one page holds them all, else in a reorder mode that
 * loads up to 200) and delete. Rows mirrored from the original gallery belong to the Media tab: they can be described
 * here, not hidden or deleted.
 */
export function ScreenshotsTab({ registry }) {
  const env = useRegistryEnv()
  const { t, r, c, pickField } = env
  const toast = useToast()
  const confirm = useConfirm()
  const refresh = useRefreshRegistry(registry.id)
  const hooks = useCrudHooks(`${registryPath(registry.id)}/screenshots`)
  const [page, setPage] = useState(1)
  const [reordering, setReordering] = useState(false)
  const list = hooks.useList(reordering ? { per_page: REORDER_LIMIT, page: 1, sort: 'order', dir: 'asc' } : { per_page: PER_PAGE, page, sort: 'order', dir: 'asc' })
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
  const total = list.meta?.total ?? list.rows.length
  // drag in place while one page holds them all; otherwise through the reorder mode, which loads them all
  const canReorder = canWrite && !reordering && (list.meta?.last_page ?? 1) <= 1
  const needsReorderMode = canWrite && !reordering && (list.meta?.last_page ?? 1) > 1
  // the whole list has arrived (not the previous page, kept on screen while the big one loads)
  const allLoaded = reordering && !list.isPlaceholderData && list.isSuccess && list.rows.length === total
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
    try {
      if (dialog.record) {
        const data = changedPayload(fields, baseline, values)
        if (Object.keys(data).length) await update.mutateAsync({ id: dialog.record.id, data })
      } else {
        await create.mutateAsync(toFormData(valuesToPayload(fields, values), file))
      }
    } catch (err) {
      // 2xx with an unreadable answer: the upload was most likely stored. The list is refreshed (crud) and a warning
      // toasted; closing keeps a second Save from storing it twice.
      if (!isUnreadableResponse(err)) throw err
      refresh()
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
      <article aria-label={name} className="min-w-0 overflow-hidden rounded-card border border-white/[.08] bg-white/[.03]">
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

  // a small tile of the reorder mode: public previews only (a private one would cost a stream request each)
  const reorderTile = (row, handle, index) => {
    const name = nameOf(row)
    const src = row.thumbnail_url ?? row.url
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-white/[.03]">
        <div className="relative aspect-video bg-white/[.04]">
          {src && !apiPathOf(src) ? (
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-faint" title={t.privateScreenshot}>
              <Lock size={18} aria-hidden="true" />
            </span>
          )}
          <span className="absolute start-1.5 top-1.5 rounded-md bg-deep/75 px-1.5 text-[11px] font-bold tabular-nums text-ink">{index + 1}</span>
          <div className="absolute end-1 top-1 rounded-lg bg-deep/70">{handle}</div>
        </div>
        <p dir="auto" className="truncate px-2 py-1.5 text-xs font-semibold text-ink" title={name}>
          {name}
        </p>
      </div>
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
  } else if (reordering) {
    body = allLoaded ? (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t.reorderModeHint(total)}</p>
        <SortableList
          items={rows}
          layout="grid"
          ariaLabel={t.reorderScreenshots}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
          itemClassName="min-w-0"
          onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
          renderItem={(row, { handle, isDragging, index }) => <div className={cx(isDragging && 'opacity-80')}>{reorderTile(row, handle, index)}</div>}
        />
      </div>
    ) : (
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
        className={GRID}
        itemClassName="min-w-0"
        onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
        renderItem={(row, { handle, isDragging }) => <div className={cx('min-w-0', isDragging && 'opacity-80')}>{tile(row, handle)}</div>}
      />
    )
  } else {
    body = (
      <ul className={GRID}>
        {rows.map((row) => (
          <li key={row.id} className="min-w-0">
            {tile(row, null)}
          </li>
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
        <div className="flex flex-wrap items-center gap-2">
          {reordering ? (
            <Button size="sm" onClick={() => setReordering(false)}>
              {c.reorderDone}
            </Button>
          ) : needsReorderMode ? (
            <Button
              size="sm"
              variant="secondary"
              icon={ListOrdered}
              onClick={() => setReordering(true)}
              disabled={total > REORDER_LIMIT}
              title={total > REORDER_LIMIT ? c.reorderTooMany(REORDER_LIMIT) : undefined}
            >
              {c.reorder}
            </Button>
          ) : null}
          {canWrite && !reordering ? (
            <Button size="sm" icon={Upload} onClick={() => setDialog({ open: true, record: null })}>
              {t.uploadScreenshot}
            </Button>
          ) : null}
        </div>
      </div>
      {needsReorderMode && total > REORDER_LIMIT ? <p className="text-xs text-muted">{c.reorderTooMany(REORDER_LIMIT)}</p> : null}
      {body}
      {!reordering && list.meta && list.meta.last_page > 1 ? <Pagination meta={list.meta} onPageChange={setPage} /> : null}
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
