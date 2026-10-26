import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Boxes, Plus, Star, UserCheck } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canCreateProjects } from '@/app/permissions'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { useListParams } from '@/lib/useListParams'
import { Alert, Avatar, Badge, Button, Checkbox, DataTable, PageHeader, Pagination, SearchInput, Select } from '@/ui'
import { CATEGORIES, COMPLETENESS_GROUPS, DEVELOPMENT_STATUSES, PUBLICATION_STATUSES, STATUS_GROUPS, publicationLabels, registryProjects, registryStrings, toOptions } from './kit'
import strings from './strings'

// The API pages this list itself (no sort parameter): 25 a page, at most 100.
const DEFAULTS = { per_page: 25 }

const DEV_TONES = { idea: 'neutral', planning: 'info', in_development: 'warning', testing: 'warning', completed: 'success', maintenance: 'info', paused: 'neutral', archived: 'neutral' }

function CompletenessBar({ completeness, label }) {
  const score = completeness?.score ?? 0
  return (
    <div className="flex min-w-[120px] items-center gap-2" title={label}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[.08]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className={cx('h-full rounded-full', score >= 80 ? 'bg-success' : score >= 50 ? 'bg-gold' : 'bg-warning')} style={{ width: `${score}%` }} />
      </div>
      <span className="w-10 text-end font-poppins text-xs font-bold tabular-nums text-soft">{score}%</span>
    </div>
  )
}

/**
 * The registry list (`GET /registry/projects`): filters in the URL (search, development status — one or a group —,
 * publication, category, incomplete group, archived, mine), with the development status, publication, completeness
 * score and membership of each project. A row opens the project page.
 */
export default function RegistryProjectList() {
  const t = useStrings(strings)
  const r = useStrings(registryStrings)
  const c = useCommon()
  const { lang, pickField } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const list = useListParams(DEFAULTS)
  const { rows, meta, isLoading, isFetching, isError, error, refetch } = registryProjects.useList(list.params)
  const otherLang = lang === 'ar' ? 'en' : 'ar'
  const params = list.params

  const groupOptions = Object.values(STATUS_GROUPS).map((statuses) => ({ value: statuses.join(','), label: t.statusGroups[statuses.join(',')] }))
  const developmentOptions = [...groupOptions, ...toOptions(DEVELOPMENT_STATUSES, r.developmentStatuses)]
  // a filter value that came from a link but is none of the options (another combination) is still shown
  if (params.development_status && !developmentOptions.some((option) => option.value === params.development_status)) {
    developmentOptions.unshift({ value: params.development_status, label: params.development_status.split(',').map((status) => r.developmentStatuses[status] ?? status).join(' · ') })
  }

  const columns = [
    {
      key: 'name',
      header: t.colProject,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={row.cover_image_url} name={pickField(row, 'name')} alt="" shape="rounded" />
          <div className="min-w-0 max-w-xs">
            <p className="truncate font-semibold">{pickField(row, 'name')}</p>
            <p className="truncate text-xs text-muted">
              <bdi dir={otherLang === 'ar' ? 'rtl' : 'ltr'} lang={otherLang}>
                {row[`name_${otherLang}`]}
              </bdi>
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: t.colCategory, hideBelow: 'md', cell: (row) => (row.category ? <Badge tone="accent">{r.categories[row.category] ?? row.category}</Badge> : null) },
    { key: 'development_status', header: t.colDevelopment, cell: (row) => <Badge tone={DEV_TONES[row.development_status] ?? 'neutral'}>{r.developmentStatuses[row.development_status] ?? row.development_status}</Badge> },
    {
      key: 'publication_status',
      header: t.colPublication,
      cell: (row) => {
        const notReady = row.publication_status === 'published' && row.publication && !row.publication.ready
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={row.publication_status === 'published' ? 'success' : 'neutral'} dot>
              {r.publicationStatuses[row.publication_status] ?? row.publication_status}
            </Badge>
            {row.featured ? (
              <span className="inline-flex text-gold" title={t.featured}>
                <Star size={14} aria-hidden="true" />
                <span className="sr-only">{t.featured}</span>
              </span>
            ) : null}
            {row.archived_at ? <Badge tone="warning">{r.developmentStatuses.archived}</Badge> : null}
            {notReady ? (
              <span title={`${t.notReady}: ${publicationLabels(row.publication.missing, r).join(' · ')}`} className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle size={14} aria-hidden="true" />
                <span className="sr-only">{t.notReady}</span>
              </span>
            ) : null}
          </div>
        )
      },
    },
    { key: 'completeness', header: t.colCompleteness, hideBelow: 'sm', cell: (row) => <CompletenessBar completeness={row.completeness} label={t.completenessOf(row.completeness?.score ?? 0)} /> },
    {
      key: 'is_member',
      header: t.colMember,
      hideBelow: 'lg',
      cell: (row) =>
        row.is_member ? (
          <Badge tone="gold">
            <UserCheck size={12} aria-hidden="true" />
            {t.member}
          </Badge>
        ) : null,
    },
  ]

  const filterSelect = (name, label, options) => (
    <Select aria-label={label} value={params[name] ?? ''} onChange={(event) => list.set({ [name]: event.target.value })} placeholder={r.filterAll(label)} options={options} wrapperClassName="w-full sm:w-56" />
  )

  return (
    <>
      <PageHeader
        title={t.listTitle}
        description={t.listDescription}
        backTo="/registry"
        backLabel={t.title}
        actions={
          canCreateProjects(user) ? (
            <Button icon={Plus} to="/projects/new">
              {t.newProject}
            </Button>
          ) : null
        }
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={params.search ?? ''} onChange={(search) => list.set({ search })} placeholder={t.searchPlaceholder} className="min-w-[220px] flex-1" />
          {filterSelect('development_status', t.filterDevelopment, developmentOptions)}
          {filterSelect('publication_status', t.filterPublication, toOptions(PUBLICATION_STATUSES, r.publicationStatuses))}
          {filterSelect('category', t.filterCategory, toOptions(CATEGORIES, r.categories))}
          {filterSelect('incomplete', t.filterIncomplete, toOptions(COMPLETENESS_GROUPS, r.completenessGroups))}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Checkbox label={t.mine} checked={params.mine === '1'} onChange={(checked) => list.set({ mine: checked ? '1' : '' })} />
          <Checkbox label={t.archived} checked={params.archived === '1'} onChange={(checked) => list.set({ archived: checked ? '1' : '' })} />
        </div>
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
          onRowClick={(row) => navigate(`/projects/${row.id}`)}
          rowActions={(row) => [{ key: 'open', label: t.open(pickField(row, 'name')), icon: ArrowUpRight, to: `/projects/${row.id}` }]}
          caption={t.listTitle}
          emptyIcon={Boxes}
          emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
          emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
          minWidth={720}
        />
      )}
      <Pagination meta={meta} onPageChange={list.setPage} onPerPageChange={list.setPerPage} perPageOptions={[25, 50, 100]} className="mt-4" />
    </>
  )
}
