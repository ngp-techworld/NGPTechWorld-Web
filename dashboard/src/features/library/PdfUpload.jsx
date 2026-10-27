import { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileText, FileUp, RefreshCw } from 'lucide-react'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { api, isUnreadableResponse } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { cx } from '@/lib/cx'
import { Button, Spinner, useFieldContext } from '@/ui'
import strings from './strings'

export const MAX_PDF_MB = 50

/** "3.4 MB" / "820 KB". */
export function fileSizeText(bytes, f) {
  if (!bytes && bytes !== 0) return ''
  return bytes >= 1024 * 1024 ? `${f.number(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB` : `${f.number(Math.max(1, Math.round(bytes / 1024)))} KB`
}

/**
 * The book's PDF. Uploads to POST /uploads (folder `books/files`) and stores the returned relative path in the
 * form; `url` / `size` describe the saved file of a record loaded from the API. Checked (type, ≤ 50 MB) first.
 */
export function PdfUpload({ value = null, url, size, onChange, onUploadingChange, invalid }) {
  const c = useCommon()
  const t = useStrings(strings)
  const f = useFormat()
  const field = useFieldContext()
  const inputRef = useRef(null)
  const mounted = useRef(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState(null) // { path, url, size, name } of a file uploaded in this session

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const current = value ? (uploaded?.path === value ? uploaded : { path: value, url, size, name: null }) : null

  const upload = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError(t.pdfBadType)
    if (file.size > MAX_PDF_MB * 1024 * 1024) return setError(c.fileTooLarge(MAX_PDF_MB))
    setError('')
    setUploading(true)
    onUploadingChange?.(true)
    try {
      const result = await api.upload(file, 'books/files')
      if (mounted.current) setUploaded({ ...result, size: result.size ?? file.size, name: file.name })
      onChange?.(result.path)
    } catch (err) {
      const serverMessage = err?.status === 422 ? err.errors?.file?.[0] : null
      // an unreadable 2xx answer has no path to keep: the file must be uploaded again
      if (mounted.current) setError(serverMessage || (isUnreadableResponse(err) ? t.pdfUploadFailed : errorText(err, c)) || t.pdfUploadFailed)
    } finally {
      if (mounted.current) setUploading(false)
      onUploadingChange?.(false)
    }
  }

  const pick = () => inputRef.current?.click()

  return (
    <div className="min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        tabIndex={-1}
        data-testid="pdf-input"
        onChange={(event) => {
          upload(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div
        className={cx(
          'flex flex-wrap items-center gap-3 rounded-xl border bg-white/[.03] p-4',
          invalid ?? field?.invalid ? 'border-danger/60' : 'border-white/[.14]',
          !current && 'border-dashed',
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          upload(event.dataTransfer?.files?.[0])
        }}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/25 text-accent-lighter">
          {uploading ? <Spinner size={20} /> : <FileText size={20} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          {uploading ? (
            <p className="text-sm font-medium text-ink" role="status">{c.uploading}</p>
          ) : current ? (
            <>
              <p className="truncate text-sm font-semibold text-ink" dir="auto">{current.name ?? t.pdfSaved}</p>
              {current.size ? <p className="text-xs text-muted">{fileSizeText(current.size, f)}</p> : null}
            </>
          ) : (
            <p className="text-sm text-muted">{t.pdfEmpty(MAX_PDF_MB)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {current?.url ? (
            <Button size="sm" variant="ghost" icon={ExternalLink} href={current.url} target="_blank" rel="noreferrer">
              {t.pdfOpen}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" icon={current ? RefreshCw : FileUp} onClick={pick} disabled={uploading} id={field?.id} aria-describedby={field?.describedBy}>
            {current ? t.pdfReplace : t.pdfChoose}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
