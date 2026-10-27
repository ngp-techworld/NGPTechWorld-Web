import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FolderKanban, Link2, ListOrdered, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { useListParams } from '@/lib/useListParams'
import { Alert, Avatar, Badge, Button, Card, DataTable, PageHeader, Pagination, SearchInput, Select, SortableList, StatusBadge, Switch, useToast } from '@/ui'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { projects } from './hooks'
import { CATEGORIES, STATUSES } from './schema'
import strings from './strings'

const DEFAULTS = { per_page: 15, sort: 'order', dir: 'asc' }
const DEV_TONES = { idea: 'neutral', planning: 'info', in_development: 'warning', testing: 'warning', completed: 'success', maintenance: 'info', paused: 'neutral', archived: 'neutral' }
// The API sets `order` = position of every id it receives, so reordering needs the WHOLE list in one page.
const REORDER_LIMIT = 200

export default function ProjectList() {
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const { lang, pickField } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [deleting, setDeleting] = useState(null)

  const [reordering, setReordering] = useState(false)
  const list = useListParams(DEFAULTS)
  const query = projects.useList(reordering ? { per_page: REORDER_LIMIT, sort: 'order', dir: 'asc' } : list.params)
  const { rows, meta } = query
  // a featured change moves the registry's lists and counters too; an archived project cannot be featured (422)
  const update = projects.useUpdate({
    silent: true,
    onSuccess: () => {
      toast.success(c.saved)
      queryClient.invalidateQueries({ queryKey: ['crud', '/registry/projects'] })
      queryClient.invalidateQueries({ queryKey: ['registry', 'overview'] })
    },
    onError: (err) => toast.error(err?.status === 422 && err.errors?.featured ? t.featuredArchived : errorText(err, c)),
  })
  const reorder = projects.useReorder()

  const canReorder = !meta || meta.total <= REORDER_LIMIT
  const otherLang = lang === 'ar' ? 'en' : 'ar'

  // project statuses read "Completed" / "In progress" (the shared badge says "In progress" as "Processing")
  const statusBadges = useMemo(
    () => ({
      completed: { tone: 'success', label: t.projectStatuses.completed },
      in_progress: { tone: 'warning', label: t.projectStatuses.in_progress },
    }),
    [t],
  )

  // while the toggle request is running show the value the user asked for
  const featuredOf = (row) => (update.isPending && update.variables?.id === row.id ? update.variables.data.featured : row.featured)


  // `cover_url` is the cover the public page shows (the legacy cover, else the screenshot marked as cover — imported
  // projects keep their pictures as screenshots); older APIs only send `cover_image_url`; the avatar is the last resort
  const thumb = (row) => <Avatar src={row.cover_url || row.cover_image_url} name={pickField(row, 'name')} alt="" shape="rounded" />

  const columns = [
    {
      key: 'order',
      header: c.order,
      sortable: true,
      width: 88,
      hideBelow: 'sm',
      cell: (row, index) => f.number((meta?.from ?? 1) + index), // row number in the current view
    },
    {
      key: 'name',
      header: t.colProject,
      sortable: true,
      sortKey: `name_${lang}`,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {thumb(row)}
          <div className="min-w-0 max-w-[15rem]">
            <p className="truncate font-semibold" title={pickField(row, 'name')}>
              {pickField(row, 'name')}
            </p>
            <p className="truncate text-xs text-muted">
              <bdi dir={otherLang === 'ar' ? 'rtl' : 'ltr'} lang={otherLang}>
                {row[`name_${otherLang}`]}
              </bdi>
              {/* the client has its own column only on very wide screens */}
              {row.client ? (
                <span className="2xl:hidden">
                  {' · '}
                  <bdi>{row.client}</bdi>
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: t.colCategory, sortable: true, cell: (row) => <Badge tone="accent">{t.categories[row.category] ?? row.category}</Badge> },
    {
      key: 'client',
      header: t.colClient,
      sortable: true,
      // below 2xl the client is the second line of the project cell: at 1440 the English headers left no room for it
      hideBelow: '2xl',
      cell: (row) => (
        <span dir="auto" className="block max-w-[10rem] truncate" title={row.client ?? undefined}>
          {row.client}
        </span>
      ),
    },
    { key: 'year', header: t.colYear, sortable: true, hideBelow: 'md', cell: (row) => <span className="tabular-nums">{row.year}</span> },
    {
      key: 'status',
      header: c.status,
      sortable: true,
      // the registry's development status when the API sends it, else the original two-value status
      cell: (row) =>
        row.development_status ? (
          <Badge tone={DEV_TONES[row.development_status] ?? 'neutral'}>{t.developmentStatuses[row.development_status] ?? row.development_status}</Badge>
        ) : (
          <StatusBadge status={row.status} statuses={statusBadges} />
        ),
    },
    {
      key: 'publication_status',
      header: t.colPublication,
      hideBelow: 'sm',
      cell: (row) =>
        row.publication_status || row.archived_at ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.publication_status ? (
              <Badge tone={row.publication_status === 'published' ? 'success' : 'neutral'} dot>
                {t.publicationStatuses[row.publication_status] ?? row.publication_status}
              </Badge>
            ) : null}
            {row.archived_at ? <Badge tone="warning">{t.archivedBadge}</Badge> : null}
          </div>
        ) : null,
    },
    {
      key: 'featured',
      header: t.colFeatured,
      sortable: true,
      cell: (row) => (
        <Switch
          checked={Boolean(featuredOf(row))}
          onChange={(featured) => update.mutate({ id: row.id, data: { featured } })}
          aria-label={t.featuredToggle(pickField(row, 'name'))}
          // never offer featuring an archived project (the API refuses it); un-featuring stays possible
          disabled={Boolean(row.archived_at) && !row.featured}
          title={row.archived_at ? t.featuredArchived : undefined}
        />
      ),
    },
    {
      key: 'team_members_count',
      header: t.colTeam,
      // counts that the project page's tabs show too: only where the table has room for them (at 1440 the English
      // headers pushed the actions out of view)
      hideBelow: '2xl',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums text-muted" title={t.teamCount(row.team_members_count ?? 0)}>
          <Users size={14} aria-hidden="true" />
          {f.number(row.team_members_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'links_count',
      header: t.colLinks,
      hideBelow: '2xl',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums text-muted" title={t.linksCount(row.links_count ?? 0)}>
          <Link2 size={14} aria-hidden="true" />
          {f.number(row.links_count ?? 0)}
        </span>
      ),
    },
  ]

  const rowActions = (row) => [
    { key: 'edit', label: c.edit, icon: Pencil, to: `/projects/${row.id}` },
    // super admins only (ProjectPolicy::delete), always with the typed slug
    { key: 'delete', label: c.delete, icon: Trash2, tone: 'danger', hidden: !user?.is_super_admin, onClick: () => setDeleting(row) },
  ]

  const newButton = (
    <Button to="/projects/new" icon={Plus}>
      {t.new}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          reordering ? (
            <Button onClick={() => setReordering(false)}>{c.reorderDone}</Button>
          ) : (
            <>
              <Button variant="secondary" icon={ListOrdered} onClick={() => setReordering(true)} disabled={!canReorder || rows.length < 2} title={canReorder ? undefined : c.reorderTooMany(REORDER_LIMIT)}>
                {c.reorder}
              </Button>
              {newButton}
            </>
          )
        }
      />

      {query.isError && rows.length === 0 ? (
        <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => query.refetch()}>{c.retry}</Button>}>
          {errorText(query.error, c)}
        </Alert>
      ) : reordering ? (
        <Card>
          <p className="mb-4 text-sm text-muted">{t.reorderIntro}</p>
          {meta?.total > REORDER_LIMIT ? (
            <Alert tone="warning" className="mb-4">
              {c.reorderTooMany(REORDER_LIMIT)}
            </Alert>
          ) : null}
          <SortableList
            items={rows}
            ariaLabel={t.title}
            onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
            renderItem={(row, { handle, isDragging, index }) => (
              <div className={`flex items-center gap-3 rounded-xl border bg-white/[.03] px-3 py-2 ${isDragging ? 'border-accent-light' : 'border-white/[.08]'}`}>
                {handle}
                <span className="w-7 text-center text-sm font-bold tabular-nums text-muted">{f.number(index + 1)}</span>
                {thumb(row)}
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{pickField(row, 'name')}</p>
                <Badge tone="accent" className="hidden sm:inline-flex">
                  {t.categories[row.category] ?? row.category}
                </Badge>
                <StatusBadge status={row.status} statuses={statusBadges} className="hidden sm:inline-flex" />
              </div>
            )}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={list.params.search ?? ''} onChange={(search) => list.set({ search })} placeholder={t.searchPlaceholder} />
            <Select
              aria-label={t.categoryFilter}
              value={list.params.category ?? ''}
              onChange={(event) => list.set({ category: event.target.value })}
              options={[{ value: '', label: `${t.categoryFilter}: ${c.all}` }, ...CATEGORIES.map((value) => ({ value, label: t.categories[value] }))]}
              wrapperClassName="w-full sm:w-52"
            />
            <Select
              aria-label={c.status}
              value={list.params.status ?? ''}
              onChange={(event) => list.set({ status: event.target.value })}
              options={[{ value: '', label: `${c.status}: ${c.all}` }, ...STATUSES.map((value) => ({ value, label: t.projectStatuses[value] }))]}
              wrapperClassName="w-full sm:w-52"
            />
            <Select
              aria-label={t.featuredFilter}
              value={list.params.featured ?? ''}
              onChange={(event) => list.set({ featured: event.target.value })}
              options={[
                { value: '', label: `${t.featuredFilter}: ${c.all}` },
                { value: '1', label: t.featuredOnly },
                { value: '0', label: t.notFeatured },
              ]}
              wrapperClassName="w-full sm:w-52"
            />
            {list.hasFilters ? (
              <Button variant="ghost" size="sm" onClick={list.reset}>
                {c.reset}
              </Button>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            loading={query.isLoading}
            busy={query.isFetching && !query.isLoading}
            sort={list.sort}
            onSortChange={list.setSort}
            rowActions={rowActions}
            caption={t.title}
            emptyIcon={FolderKanban}
            emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
            emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
            emptyAction={list.hasFilters ? null : newButton}
          />

          <Pagination meta={meta} onPageChange={list.setPage} onPerPageChange={list.setPerPage} />
        </div>
      )}
      <DeleteProjectDialog project={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}
