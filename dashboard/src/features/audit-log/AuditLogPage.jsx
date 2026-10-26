import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, ScrollText, X } from 'lucide-react'
import { AUDIT_ACTIONS, AUDIT_SUBJECTS, registryProjects, toOptions } from '@/features/registry/kit'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { createCrudHooks } from '@/lib/crud'
import { errorText } from '@/lib/errors'
import { useListParams } from '@/lib/useListParams'
import { Alert, Badge, Button, DataTable, Field, Input, Modal, PageHeader, Pagination, Select } from '@/ui'
import strings from './strings'

export const auditLogs = createCrudHooks('/registry/audit-logs')
const users = createCrudHooks('/users')

// The API pages newest first (no sort parameter); 50 a page by default, at most 200.
const DEFAULTS = { per_page: 50 }
const ACTION_TONES = { created: 'success', updated: 'info', deleted: 'danger', published: 'success', unpublished: 'warning', archived: 'warning', restored: 'info', member_added: 'accent', member_removed: 'warning', viewed_sensitive: 'gold' }

const show = (value) => {
  if (value === null || value === undefined) return <span className="text-faint">—</span>
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return (
    <bdi dir="auto" className="whitespace-pre-wrap break-all font-mono text-[12px] text-soft">
      {text}
    </bdi>
  )
}

function DetailsDialog({ entry, onClose }) {
  const t = useStrings(strings)
  const c = useCommon()
  const changes = entry?.changes && typeof entry.changes === 'object' ? Object.entries(entry.changes) : []
  return (
    <Modal open={Boolean(entry)} onClose={onClose} title={t.detailsTitle} size="xl" footer={<Button variant="secondary" onClick={onClose}>{c.close}</Button>}>
      {entry ? (
        <div className="space-y-4 pb-2">
          {changes.length ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[.08] text-start text-xs font-bold uppercase text-muted">
                  <th scope="col" className="py-2 pe-3 text-start">{t.field}</th>
                  <th scope="col" className="py-2 pe-3 text-start">{t.before}</th>
                  <th scope="col" className="py-2 text-start">{t.after}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.06]">
                {changes.map(([field, pair]) => {
                  const [before, after] = Array.isArray(pair) ? pair : [null, pair]
                  return (
                    <tr key={field} className="align-top">
                      <th scope="row" className="py-2 pe-3 text-start font-mono text-[12px] font-semibold text-ink">
                        <bdi dir="ltr">{field}</bdi>
                      </th>
                      <td className="py-2 pe-3">{show(before)}</td>
                      <td className="py-2">{show(after)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">{t.noChanges}</p>
          )}
          {entry.user_agent ? (
            <p className="text-xs text-muted">
              {t.userAgent}: <bdi dir="ltr">{entry.user_agent}</bdi>
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

/** The registry audit trail (`GET /registry/audit-logs`), super admins only, filtered in the URL. */
export default function AuditLogPage() {
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const { pickField } = useLanguage()
  const list = useListParams(DEFAULTS)
  const { rows, meta, isLoading, isFetching, isError, error, refetch } = auditLogs.useList(list.params)
  const projectOptions = registryProjects.useList({ per_page: 100 }).rows.map((project) => ({ value: String(project.id), label: pickField(project, 'name') }))
  const userOptions = users.useList({ per_page: 200, sort: 'name', dir: 'asc' }).rows.map((user) => ({ value: String(user.id), label: user.name }))
  const [details, setDetails] = useState(null)
  const params = list.params
  const projectName = (id) => projectOptions.find((option) => option.value === String(id))?.label ?? t.projectN(id)

  const columns = [
    { key: 'created_at', header: t.colDate, cell: (row) => <span className="whitespace-nowrap text-sm">{f.dateTime(row.created_at)}</span> },
    { key: 'user', header: t.colUser, cell: (row) => row.user?.name ?? <span className="text-muted">{t.system}</span> },
    { key: 'action', header: t.colAction, cell: (row) => <Badge tone={ACTION_TONES[row.action] ?? 'neutral'}>{t.actions[row.action] ?? row.action}</Badge> },
    {
      key: 'subject',
      header: t.colSubject,
      hideBelow: 'sm',
      cell: (row) => (row.subject_type ? `${t.subjects[row.subject_type] ?? row.subject_type}${row.subject_id ? ` #${row.subject_id}` : ''}` : null),
    },
    {
      key: 'project_id',
      header: t.colProject,
      hideBelow: 'md',
      cell: (row) =>
        row.project_id ? (
          <Link to={`/projects/${row.project_id}`} className="text-accent-lighter hover:underline" onClick={(event) => event.stopPropagation()}>
            {projectName(row.project_id)}
          </Link>
        ) : null,
    },
    { key: 'ip', header: t.colIp, hideBelow: 'lg', cell: (row) => (row.ip ? <bdi dir="ltr" className="font-mono text-[12px]">{row.ip}</bdi> : null) },
  ]

  const filterSelect = (name, label, options) => (
    <Select aria-label={label} value={params[name] ?? ''} onChange={(event) => list.set({ [name]: event.target.value })} placeholder={`${label}: ${c.all}`} options={options} wrapperClassName="w-full sm:w-52" />
  )

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {filterSelect('project_id', t.filterProject, projectOptions)}
        {filterSelect('user_id', t.filterUser, userOptions)}
        {filterSelect('action', t.filterAction, toOptions(AUDIT_ACTIONS, t.actions))}
        {filterSelect('subject', t.filterSubject, toOptions(AUDIT_SUBJECTS, t.subjects))}
        <Field label={t.from} className="w-full sm:w-40">
          <Input type="date" dir="ltr" value={params.from ?? ''} onChange={(event) => list.set({ from: event.target.value })} />
        </Field>
        <Field label={t.to} className="w-full sm:w-40">
          <Input type="date" dir="ltr" value={params.to ?? ''} onChange={(event) => list.set({ to: event.target.value })} />
        </Field>
        {list.hasFilters ? (
          <Button variant="ghost" icon={X} onClick={list.reset}>
            {t.clearFilters}
          </Button>
        ) : null}
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
          rowActions={(row) => [{ key: 'details', label: t.detailsOf(row.id), icon: Eye, onClick: () => setDetails(row) }]}
          onRowClick={setDetails}
          caption={t.title}
          emptyIcon={ScrollText}
          emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
          emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
          minWidth={720}
        />
      )}
      <Pagination meta={meta} onPageChange={list.setPage} onPerPageChange={list.setPerPage} perPageOptions={[50, 100, 200]} className="mt-4" />
      <DetailsDialog entry={details} onClose={() => setDetails(null)} />
    </>
  )
}
