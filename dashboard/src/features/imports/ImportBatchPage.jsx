import { useLocation, useParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from '@/ui'
import { BATCH_QUERY_OPTIONS, importBatches } from './hooks'
import { ImportStatusBadge, ImportsMfaNotice, useBatchName } from './parts'
import { PreviewView } from './PreviewView'
import { ClosedView, ReportView } from './ReportView'
import strings from './strings'

/**
 * `/imports/:id` (`GET imports/{id}`): the preview while `previewed`, the report once `applied`, and the state of a
 * `failed`, `cancelled` or `expired` batch. Apply, refresh and cancel write their answer into the cached batch, so the
 * page follows the new status by itself.
 */
export default function ImportBatchPage() {
  const { id } = useParams()
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const location = useLocation()
  const nameOf = useBatchName()
  const { data: batch, isLoading, isError, error, refetch, isFetching } = importBatches.useOne(id, BATCH_QUERY_OPTIONS)
  const skippedOnUpload = location.state?.skipped ?? 0

  if (isLoading) return <PageSpinner />
  if (!batch && isError) {
    if (error?.status === 404) {
      return <EmptyState icon={SearchX} title={t.notFoundTitle} description={t.notFoundHint} action={<Button to="/imports">{t.backToHistory}</Button>} />
    }
    return (
      <>
        <PageHeader title={t.title} backTo="/imports" backLabel={t.backToHistory} />
        {isMfaRequired(error) ? (
          <ImportsMfaNotice />
        ) : (
          <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => refetch()} loading={isFetching}>{c.retry}</Button>}>
            {errorText(error, c)}
          </Alert>
        )}
      </>
    )
  }
  if (!batch) return null

  const description = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ImportStatusBadge status={batch.status} />
      <bdi dir="ltr" className="font-mono text-[13px]">
        {batch.original_name}
      </bdi>
      <span>{t.uploadedBy(batch.user?.name ?? '—', f.dateTime(batch.created_at))}</span>
      {batch.status === 'previewed' && batch.expires_at ? <span>{t.expiresAt(f.relative(batch.expires_at))}</span> : null}
    </span>
  )

  return (
    <>
      <PageHeader title={t.batchTitle(nameOf(batch))} description={description} backTo="/imports" backLabel={t.backToHistory} />
      {skippedOnUpload && batch.status === 'previewed' ? (
        <Alert tone="info" className="mb-5">
          {t.skippedOnUpload(skippedOnUpload)}
        </Alert>
      ) : null}
      {batch.status === 'previewed' ? (
        <PreviewView batch={batch} onReload={() => refetch()} />
      ) : batch.status === 'applied' ? (
        <ReportView batch={batch} />
      ) : (
        <ClosedView batch={batch} />
      )}
    </>
  )
}
