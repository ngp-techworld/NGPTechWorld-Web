import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, BookOpenText, Boxes, LayoutGrid, Plus, Rows3, Star, UserCheck } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canCreateProjects } from '@/app/permissions'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { storage } from '@/lib/storage'
import { useListParams } from '@/lib/useListParams'
import { Alert, Avatar, Badge, Button, Checkbox, DataTable, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, focusRing } from '@/ui'
import { CATEGORIES, COMPLETENESS_GROUPS, DEVELOPMENT_STATUSES, PUBLICATION_STATUSES, STATUS_GROUPS, publicationLabels, registryProjects, registryStrings, toOptions } from './kit'
import profileStrings from './profile/strings'
import strings from './strings'

// The API pages this list itself (no sort parameter): 25 a page, at most 100. `archived`: '' (not archived, the
// API's default), '1' (archived only) or 'all' (both, API contract B8).
const DEFAULTS = { per_page: 25 }

export const DEV_TONES = { idea: 'neutral', planning: 'info', in_development: 'warning', testing: 'warning', completed: 'success', maintenance: 'info', paused: 'neutral', archived: 'neutral' }

export function CompletenessBar({ completeness, label }) {
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

// Table or cards: a per-browser preference, not part of the URL (the list's URL parameters go to the API as they are).
const VIEW_KEY = 'ngp_registry_list_view'
function useListView() {
  const [view, setView] = useState(() => (storage.get(VIEW_KEY) === 'cards' ? 'cards' : 'table'))
  const choose = (next) => {
    storage.set(VIEW_KEY, next)
    setView(next)
  }
  return [view, choose]
}

/** The projects as cards (cover, names, statuses, completeness, membership), each opening the project profile. */
function ProjectCards({ rows, loading, busy, emptyTitle, emptyDescription }) {
  const t = useStrings(strings)
  const r = useStrings(registryStrings)
  const ps = useStrings(profileStrings)
  const { lang, pickField } = useLanguage()
  const otherLang = lang === 'ar' ? 'en' : 'ar'
  if (loading && !rows.length) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[300px] rounded-card" />
        ))}
      </div>
    )
  }
  if (!rows.length) return <EmptyState icon={Boxes} title={emptyTitle} description={emptyDescription} className="rounded-card border border-white/[.08] bg-white/[.025]" />
  return (
    <ul aria-label={t.listTitle} className={cx('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', busy && 'opacity-60')}>
      {rows.map((row) => {
        const name = pickField(row, 'name')
        return (
          <li key={row.id} className="min-w-0">
            <Link
              to={`/projects/${row.id}/profile`}
              aria-label={ps.profileOf(name)}
              className={cx('group flex h-full flex-col overflow-hidden rounded-card border border-white/[.08] bg-white/[.03] shadow-card transition-colors hover:border-accent-light/50', focusRing)}
            >
              <span className="relative block aspect-[16/9] bg-white/[.04]">
                {row.cover_image_url ? (
                  <img src={row.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-accent-lighter/60">
                    {name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
                {row.featured ? (
                  <span className="absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-deep/80 text-gold" title={t.featured}>
                    <Star size={14} aria-hidden="true" />
                    <span className="sr-only">{t.featured}</span>
                  </span>
                ) : null}
              </span>
              <span className="flex flex-1 flex-col gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{name}</span>
                  <span className="block truncate text-xs text-muted">
                    <bdi dir={otherLang === 'ar' ? 'rtl' : 'ltr'} lang={otherLang}>
                      {row[`name_${otherLang}`]}
                    </bdi>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={DEV_TONES[row.development_status] ?? 'neutral'}>{r.developmentStatuses[row.development_status] ?? row.development_status}</Badge>
                  <Badge tone={row.publication_status === 'published' ? 'success' : 'neutral'} dot>
                    {r.publicationStatuses[row.publication_status] ?? row.publication_status}
                  </Badge>
                  {row.archived_at ? <Badge tone="warning">{r.developmentStatuses.archived}</Badge> : null}
                  {row.is_member ? (
                    <Badge tone="gold">
                      <UserCheck size={12} aria-hidden="true" />
                      {t.member}
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-auto block">
                  <CompletenessBar completeness={row.completeness} label={t.completenessOf(row.completeness?.score ?? 0)} />
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
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
  const ps = useStrings(profileStrings)
  const [view, setView] = useListView()
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
          <Select
            aria-label={t.archived}
            value={params.archived ?? ''}
            onChange={(event) => list.set({ archived: event.target.value })}
            options={['', '1', 'all'].map((value) => ({ value, label: t.archivedOptions[value] }))}
            wrapperClassName="w-full sm:w-60"
          />
          <div role="group" aria-label={ps.viewLabel} className="ms-auto inline-flex rounded-xl border border-white/[.12] p-0.5">
            {[
              ['table', Rows3, ps.viewTable],
              ['cards', LayoutGrid, ps.viewCards],
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cx('inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors', focusRing, view === key ? 'bg-accent text-white' : 'text-muted hover:text-ink')}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isError && rows.length === 0 ? (
        <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{c.retry}</Button>}>
          {errorText(error, c)}
        </Alert>
      ) : view === 'cards' ? (
        <ProjectCards
          rows={rows}
          loading={isLoading}
          busy={isFetching && !isLoading}
          emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
          emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          busy={isFetching && !isLoading}
          onRowClick={(row) => navigate(`/projects/${row.id}`)}
          rowActions={(row) => [
            { key: 'profile', label: ps.profileOf(pickField(row, 'name')), icon: BookOpenText, to: `/projects/${row.id}/profile` },
            { key: 'open', label: t.open(pickField(row, 'name')), icon: ArrowUpRight, to: `/projects/${row.id}` },
          ]}
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
