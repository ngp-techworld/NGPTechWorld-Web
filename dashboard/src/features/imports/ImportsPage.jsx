import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, FolderInput, Plus, X } from 'lucide-react'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { errorText, isMfaRequired } from '@/lib/errors'
import { useListParams } from '@/lib/useListParams'
import { Alert, Badge, Button, DataTable, PageHeader, Pagination, Select } from '@/ui'
import { importBatches } from './hooks'
import { ImportStatusBadge, ImportsMfaNotice, STATUSES, useBatchName } from './parts'
import strings from './strings'
import { UploadCard } from './UploadCard'

// The API pages the history itself (`GET imports?page=&status=`), newest first.
const DEFAULTS = {}

function Counts({ row }) {
  const t = useStrings(strings)
  const f = useFormat()
  const parts = row.report_counts
    ? [
        ['created', row.report_counts.created],
        ['updated', row.report_counts.updated],
      ]
    : [
        ['new', row.counts?.new],
        ['changed', row.counts?.changed],
        ['errors', row.counts?.errors],
      ]
  return (
    <span className="flex flex-wrap gap-x-2 text-xs text-muted">
      {parts
        .filter(([key, value]) => value || key !== 'errors')
        .map(([key, value]) => (
          <span key={key} className={key === 'errors' ? 'font-semibold text-danger' : undefined}>
            <span className="font-poppins font-bold tabular-nums text-soft">{f.number(value ?? 0)}</span> {t.countsSummary[key]}
          </span>
        ))}
    </span>
  )
}

/** `/imports`: the upload step (open by default while there is no import yet) and the history of batches. */
export default function ImportsPage() {
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const navigate = useNavigate()
  const nameOf = useBatchName()
  const list = useListParams(DEFAULTS)
  const { rows, meta, isLoading, isFetching, isError, error, refetch } = importBatches.useList(list.params)
  const [uploadOpen, setUploadOpen] = useState(null) // null: decided by the history (open while it is empty)
  const mfa = isMfaRequired(error)
  const showUpload = !mfa && (uploadOpen ?? (!isLoading && !isError && rows.length === 0 && !list.hasFilters))

  const columns = [
    { key: 'status', header: t.colStatus, cell: (row) => <ImportStatusBadge status={row.status} /> },
    {
      key: 'project',
      header: t.colProject,
      cell: (row) => (
        <div className="min-w-0 max-w-xs">
          <p className="flex items-center gap-2 truncate font-semibold">
            <span className="truncate">{nameOf(row)}</span>
            {row.match?.kind === 'new' ? <Badge tone="accent">{t.newProjectBadge}</Badge> : null}
          </p>
          {row.package?.slug ? (
            <p className="truncate text-xs text-muted">
              <bdi dir="ltr" className="font-mono">
                {row.package.slug}
              </bdi>
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'original_name',
      header: t.colFile,
      hideBelow: 'md',
      cell: (row) => (
        <bdi dir="ltr" className="break-all font-mono text-[12px] text-soft">
          {row.original_name}
        </bdi>
      ),
    },
    { key: 'user', header: t.colUser, hideBelow: 'lg', cell: (row) => row.user?.name ?? null },
    { key: 'created_at', header: t.colDate, cell: (row) => <span className="whitespace-nowrap text-sm">{f.dateTime(row.created_at)}</span> },
    { key: 'counts', header: t.colCounts, hideBelow: 'sm', cell: (row) => <Counts row={row} /> },
  ]

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          mfa ? null : showUpload ? (
            <Button variant="secondary" icon={X} onClick={() => setUploadOpen(false)}>
              {t.closeUpload}
            </Button>
          ) : (
            <Button icon={Plus} onClick={() => setUploadOpen(true)}>
              {t.newImport}
            </Button>
          )
        }
      />
      {mfa ? <ImportsMfaNotice className="mb-5" /> : null}
      {showUpload ? (
        <div className="mb-6">
          <UploadCard />
        </div>
      ) : null}

      {mfa ? null : (
        <section aria-label={t.history} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">{t.history}</h2>
            <Select
              aria-label={t.filterStatus}
              value={list.params.status ?? ''}
              onChange={(event) => list.set({ status: event.target.value })}
              placeholder={`${t.filterStatus}: ${c.all}`}
              options={STATUSES.map((status) => ({ value: status, label: t.statuses[status] }))}
              wrapperClassName="w-full sm:w-56"
            />
          </div>
          {isError && rows.length === 0 ? (
            <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{c.retry}</Button>}>
              {errorText(error, c)}
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              loading={isLoading}
              busy={isFetching && !isLoading}
              onRowClick={(row) => navigate(`/imports/${row.id}`)}
              rowActions={(row) => [{ key: 'open', label: t.openBatch(nameOf(row)), icon: ArrowUpRight, to: `/imports/${row.id}` }]}
              caption={t.history}
              emptyIcon={FolderInput}
              emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
              emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
              minWidth={720}
            />
          )}
          <Pagination meta={meta} onPageChange={list.setPage} />
        </section>
      )}
    </>
  )
}
