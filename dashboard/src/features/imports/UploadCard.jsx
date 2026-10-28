import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileArchive, FolderOpen, FolderUp } from 'lucide-react'
import { useFormat, useStrings } from '@/i18n'
import { isUnreadableResponse } from '@/lib/api'
import { withLtr } from '@/lib/bidi'
import { cx } from '@/lib/cx'
import { Alert, Button, Card } from '@/ui'
import { importBatches, uploadPackage } from './hooks'
import { MAX_ZIP_BYTES, PackageInputError, checkZip, entriesFromFileList, planFolder, readDrop, readDroppedEntries } from './packaging'
import { Disclosure, RequestError } from './parts'
import strings from './strings'

const BUSY = ['reading', 'zipping', 'uploading', 'processing']
const SKIPPED_SHOWN = 20
// what the folder step was doing when something that is not ours failed
const FALLBACK_CODES = { reading: 'read_failed', zipping: 'zip_failed' }

function InputError({ error }) {
  const t = useStrings(strings)
  const f = useFormat()
  const { code, details = {} } = error
  const texts = {
    too_many_files: () => t.inputErrors.too_many_files(details.count, details.max),
    too_many_scanned: () => t.inputErrors.too_many_scanned(details.max),
    too_large: () => t.inputErrors.too_large(f.bytes(details.bytes), f.bytes(details.max)),
    zip_too_large: () => t.inputErrors.zip_too_large(f.bytes(details.bytes), f.bytes(details.max ?? MAX_ZIP_BYTES)),
  }
  return <Alert tone="danger">{texts[code]?.() ?? t.inputErrors[code] ?? t.inputErrors.read_failed}</Alert>
}

function Progress({ label, ratio }) {
  const t = useStrings(strings)
  const percent = ratio === null || ratio === undefined ? null : Math.round(ratio * 100)
  return (
    <div className="w-full max-w-md space-y-1.5">
      <p className="text-sm font-semibold text-soft" aria-live="polite">
        {percent === null ? label : t.progressOf(label, percent)}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="h-2 overflow-hidden rounded-full bg-white/[.08]"
      >
        <div className={cx('h-full rounded-full bg-accent-light transition-[width]', percent === null && 'w-1/3 animate-pulse')} style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
    </div>
  )
}

function SkippedFiles({ paths }) {
  const t = useStrings(strings)
  if (!paths?.length) return null
  return (
    <Alert tone="info">
      <Disclosure title={t.skippedFiles(paths.length)}>
        <ul className="space-y-0.5" aria-label={t.skippedList}>
          {paths.slice(0, SKIPPED_SHOWN).map((path) => (
            <li key={path}>
              <bdi dir="ltr" className="font-mono text-[12px]">
                {path}
              </bdi>
            </li>
          ))}
          {paths.length > SKIPPED_SHOWN ? <li className="text-xs text-muted">{t.skippedMore(paths.length - SKIPPED_SHOWN)}</li> : null}
        </ul>
      </Disclosure>
    </Alert>
  )
}

/**
 * The upload step: a drop zone for a package folder (walked with `webkitGetAsEntry`) or a ZIP, plus "choose a folder"
 * (`webkitdirectory`) and "choose a ZIP" buttons. A folder is planned (accepted files only, limits) and zipped in the
 * browser (fflate, loaded on first use); a ZIP is sent as it is. Both upload with progress, then open the batch.
 */
export function UploadCard() {
  const t = useStrings(strings)
  const f = useFormat()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [state, setState] = useState({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const controller = useRef(null)
  const folderInput = useRef(null)
  const zipInput = useRef(null)
  const busy = BUSY.includes(state.phase)

  useEffect(() => () => controller.current?.abort(), [])

  async function run(source) {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    let step = 'reading'
    let skipped = []
    try {
      let file
      if (source.kind === 'zip') {
        file = checkZip(source.file)
      } else {
        setState({ phase: 'reading' })
        const entries = source.kind === 'entries' ? await readDroppedEntries(source.entries) : entriesFromFileList(source.files)
        const plan = planFolder(entries)
        skipped = plan.skipped
        step = 'zipping'
        setState({ phase: 'zipping', progress: 0, skipped })
        const { zipPackage } = await import('./zipPackage')
        file = await zipPackage(plan.files, { name: plan.name, signal: abort.signal, onProgress: (progress) => setState((current) => ({ ...current, progress })) })
        if (file.size > MAX_ZIP_BYTES) throw new PackageInputError('zip_too_large', { bytes: file.size, max: MAX_ZIP_BYTES })
      }
      step = 'uploading'
      setState({ phase: 'uploading', progress: 0, skipped, file: { name: file.name, size: file.size } })
      const batch = await uploadPackage(file, {
        signal: abort.signal,
        onProgress: ({ loaded, total }) =>
          setState((current) => ({ ...current, phase: total && loaded >= total ? 'processing' : 'uploading', progress: total ? loaded / total : null })),
      })
      queryClient.setQueryData(importBatches.keys.one(batch.id), batch)
      queryClient.invalidateQueries({ queryKey: importBatches.keys.lists })
      navigate(`/imports/${batch.id}`, { state: { skipped: skipped.length } })
    } catch (err) {
      if (controller.current !== abort) return // a newer pick replaced this one
      if (err?.name === 'AbortError') {
        setState({ phase: 'idle', stopped: true })
        return
      }
      // answered 2xx but unreadable: the batch was most likely created, so the history below shows it
      if (isUnreadableResponse(err)) queryClient.invalidateQueries({ queryKey: importBatches.keys.lists })
      // anything that is neither ours nor the API's: the step's own message, or the generic one while uploading
      const known = err instanceof PackageInputError || err?.name === 'ApiError'
      const error = known ? err : FALLBACK_CODES[step] ? new PackageInputError(FALLBACK_CODES[step]) : { status: null, message: '' }
      setState({ phase: 'error', error, skipped: err?.details?.skipped ?? skipped })
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    let source
    try {
      source = readDrop(event.dataTransfer) // synchronously: the browser empties dataTransfer after the event
    } catch (err) {
      setState({ phase: 'error', error: err instanceof PackageInputError ? err : new PackageInputError('read_failed') })
      return
    }
    run(source)
  }

  const onDragOver = (event) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
    if (!busy) setDragging(true)
  }

  const pickFolder = (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length) run({ kind: 'files', files })
  }
  const pickZip = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) run({ kind: 'zip', file })
  }

  const phaseLabel = { reading: t.reading, zipping: t.zipping, uploading: t.uploading, processing: t.processing }[state.phase]

  return (
    <Card title={t.uploadTitle} description={t.uploadDescription} aria-label={t.uploadTitle}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          data-testid="drop-zone"
          role="group"
          aria-label={t.dropTitle}
          aria-busy={busy || undefined}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-panel border-2 border-dashed px-5 py-8 text-center transition-colors',
            dragging ? 'border-accent-light bg-accent/15' : 'border-white/15 bg-white/[.02]',
          )}
        >
          <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-full bg-accent/25 text-accent-lighter">
            <FolderUp size={26} />
          </span>
          <p className="text-base font-bold text-ink">{dragging ? t.dropActive : t.dropTitle}</p>
          {busy ? (
            <>
              <Progress label={phaseLabel} ratio={state.phase === 'reading' || state.phase === 'processing' ? null : state.progress} />
              {state.file ? (
                <p className="text-xs text-muted">
                  <bdi dir="ltr">{t.packageReady(state.file.name, f.bytes(state.file.size))}</bdi>
                </p>
              ) : null}
              {state.phase !== 'processing' ? (
                <Button size="sm" variant="ghost" onClick={() => controller.current?.abort()}>
                  {t.cancelUpload}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-muted">{t.dropOr}</span>
                <Button variant="primary" icon={FolderOpen} onClick={() => folderInput.current?.click()}>
                  {t.chooseFolder}
                </Button>
                <Button variant="secondary" icon={FileArchive} onClick={() => zipInput.current?.click()}>
                  {t.chooseZip}
                </Button>
              </div>
              <p className="max-w-lg text-xs text-muted">{t.acceptedTypes}</p>
            </>
          )}
          <input ref={folderInput} type="file" className="hidden" data-testid="folder-input" webkitdirectory="" directory="" multiple onChange={pickFolder} tabIndex={-1} />
          <input ref={zipInput} type="file" className="hidden" data-testid="zip-input" accept=".zip,application/zip,application/x-zip-compressed" onChange={pickZip} tabIndex={-1} />
        </div>

        <aside className="rounded-xl border border-white/[.07] bg-white/[.03] p-4" aria-label={t.howTitle}>
          <h3 className="text-sm font-bold text-ink">{t.howTitle}</h3>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-soft">
            {t.howSteps.map((step) => (
              <li key={step}>
                <bdi>{withLtr(step, t.howPaths, 'whitespace-nowrap font-mono text-[13px]')}</bdi>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div className="mt-4 space-y-3 empty:hidden">
        {state.phase === 'error' && state.error instanceof PackageInputError ? <InputError error={state.error} /> : null}
        {state.phase === 'error' && !(state.error instanceof PackageInputError) ? <RequestError error={state.error} /> : null}
        {state.stopped ? <Alert tone="info">{t.uploadStopped}</Alert> : null}
        <SkippedFiles paths={state.skipped} />
      </div>
    </Card>
  )
}
