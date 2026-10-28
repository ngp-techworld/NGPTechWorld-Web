import { Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { useListParams } from '@/lib/useListParams'
import { Alert, Avatar, Badge, Button, Card, DataTable, PageHeader, Pagination, SearchInput, useConfirm, useToast } from '@/ui'
import { deleteErrorText } from './errors'
import { users } from './hooks'
import strings from './strings'

const DEFAULTS = { per_page: 15, sort: 'name', dir: 'asc' }

export default function UserList() {
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const confirm = useConfirm()
  const toast = useToast()
  const { user: me } = useAuth()
  const { dir } = useLanguage()

  const list = useListParams(DEFAULTS)
  const query = users.useList(list.params)
  const { rows, meta } = query
  // The API only sorts by columns the backend allows (id/name/email/created_at) — role is not one of them.
  // The API refuses to delete yourself or the last admin with a 422 message: show it (localized) instead of the
  // generic "fix the highlighted fields" text of the crud hook.
  const remove = users.useDelete({
    silent: true,
    onSuccess: () => toast.success(c.deleted),
    onError: (err) => toast.error(deleteErrorText(err, t, c)),
  })

  const isMe = (row) => me?.id === row.id

  const onDelete = async (row) => {
    const ok = await confirm({ title: t.deleteTitle, message: t.deleteMessage(row.name), confirmLabel: c.delete })
    if (ok) remove.mutate(row.id)
  }

  const columns = [
    {
      key: 'name',
      header: t.name,
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <span dir="auto" className="truncate font-semibold">
            {row.name}
          </span>
          {isMe(row) ? <Badge tone="gold">{t.you}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'email',
      header: t.email,
      sortable: true,
      cell: (row) => (
        <bdi dir="ltr" className="text-muted">
          {row.email}
        </bdi>
      ),
    },
    {
      key: 'role',
      header: t.roleColumn,
      hideBelow: 'sm',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.is_super_admin ? 'gold' : 'neutral'}>{row.is_super_admin ? t.roleSuperAdmin : t.roleAdmin}</Badge>
          {row.registry_role ? (
            <Badge tone="accent">
              <span className="sr-only">{t.registryRoleColumn}: </span>
              {t.registryRoles[row.registry_role] ?? row.registry_role}
            </Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'created_at', header: c.createdAt, sortable: true, hideBelow: 'md', cell: (row) => f.date(row.created_at) },
  ]

  // your own row has no delete button: the API would refuse it (422) anyway
  const rowActions = (row) => [
    { key: 'edit', label: c.edit, icon: Pencil, to: `/users/${row.id}` },
    { key: 'delete', label: c.delete, icon: Trash2, tone: 'danger', hidden: isMe(row), onClick: () => onDelete(row), disabled: remove.isPending },
  ]

  const newButton = (
    <Button to="/users/new" icon={Plus}>
      {t.new}
    </Button>
  )

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={newButton} />

      {/* the top bar's "My account" link lands here, so the account page is one click away */}
      {me ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={me.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-faint">{t.yourAccount}</p>
              <p className="truncate text-base font-bold text-ink">
                <span dir="auto" className="inline-block max-w-full truncate align-bottom">
                  {me.name}
                </span>
              </p>
              <p className="truncate text-sm text-muted">
                <bdi dir="ltr">{me.email}</bdi>
              </p>
              <p className="mt-1 text-xs text-muted">{t.yourAccountHint}</p>
            </div>
            <Button to="/account" variant="secondary" icon={UserRound}>
              {t.myAccount}
            </Button>
          </div>
        </Card>
      ) : null}

      {query.isError && rows.length === 0 ? (
        <Alert
          tone="danger"
          title={c.loadFailed}
          action={
            <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
              {c.retry}
            </Button>
          }
        >
          {errorText(query.error, c)}
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput dir={dir} value={list.params.search ?? ''} onChange={(search) => list.set({ search })} placeholder={t.searchPlaceholder} />
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
            emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle}
            emptyDescription={list.hasFilters ? c.noResultsHint : t.emptyHint}
            emptyAction={list.hasFilters ? null : newButton}
          />

          <Pagination meta={meta} onPageChange={list.setPage} onPerPageChange={list.setPerPage} />
        </div>
      )}
    </>
  )
}
