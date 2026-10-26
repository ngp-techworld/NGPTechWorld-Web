import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { CollectionTab, MEMBER_ROLES, registryPath, toOptions, useRefreshRegistry } from '@/features/registry/kit'
import { api } from '@/lib/api'
import { useCrudHooks } from '@/lib/crud'
import { Alert, Badge } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const MEMBERS_LIST = { per_page: 100, page: 1, sort: 'created_at', dir: 'asc' }

/** The members of a project (`registry/projects/{id}/members`), shared by the Members card and the endpoint names. */
export function useProjectMembers(projectId, enabled = true) {
  const hooks = useCrudHooks(`${registryPath(projectId)}/members`)
  return hooks.useList(MEMBERS_LIST, { enabled }).rows
}

/**
 * Accounts that may become members: those with a registry role. Only a super admin can list accounts
 * (`GET /users` is super-admin-only), so for anyone else this is empty and the add button is not offered.
 */
function useEligibleAccounts(enabled) {
  return useQuery({
    queryKey: ['crud', '/users', 'list', { per_page: 200, sort: 'name', dir: 'asc' }],
    queryFn: ({ signal }) => api.get('/users', { per_page: 200, sort: 'name', dir: 'asc' }, { signal }),
    enabled,
    select: (envelope) => (envelope?.data ?? []).filter((account) => account.registry_role),
  })
}

const membersConfig = ({ t, r }, me) => ({
  title: t.membersTitle,
  description: t.membersDescription,
  itemLabel: t.memberLabel,
  icon: Users,
  emptyTitle: t.noMembers,
  emptyHint: t.noMembersHint,
  sort: { sort: 'created_at', dir: 'asc' },
  defaults: { member_role: 'developer' },
  rowName: (row) => row.user?.name ?? `#${row.user_id}`,
  fields: (ctx, record) => [
    record
      ? null
      : {
          name: 'user_id',
          type: 'select',
          label: t.memberAccount,
          hint: t.memberAccountHint,
          required: true,
          numeric: true,
          options: (ctx?.accounts ?? []).map((account) => ({
            value: String(account.id),
            label: `${account.name} · ${account.email} · ${r.registryRoles[account.registry_role] ?? account.registry_role}`,
          })),
        },
    { name: 'member_role', type: 'select', label: t.memberRole, nullable: false, options: toOptions(MEMBER_ROLES, r.memberRoles) },
    { name: 'responsibilities', type: 'textarea', label: t.memberResponsibilities, max: 2000 },
  ].filter(Boolean),
  columns: () => [
    {
      key: 'user',
      header: t.memberAccount,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold">
            {row.user?.name ?? `#${row.user_id}`} {row.user_id === me?.id ? <Badge tone="gold">{t.memberYou}</Badge> : null}
          </p>
          {row.user?.email ? (
            <p className="text-xs text-muted">
              <bdi dir="ltr">{row.user.email}</bdi>
            </p>
          ) : null}
        </div>
      ),
    },
    { key: 'member_role', header: t.memberRole, cell: (row) => <Badge tone="accent">{r.memberRoles[row.member_role] ?? row.member_role}</Badge> },
    { key: 'registry_role', header: t.memberRegistryRole, hideBelow: 'sm', cell: (row) => (row.user?.registry_role ? r.registryRoles[row.user.registry_role] : null) },
    { key: 'responsibilities', header: t.memberResponsibilities, hideBelow: 'md', cell: (row) => (row.responsibilities ? <span dir="auto" className="line-clamp-2 max-w-sm text-sm text-soft">{row.responsibilities}</span> : null) },
  ],
})

/**
 * Who works on the project. Every registry role sees the list (viewInternal); only `manageMembers` changes it. A new
 * member is picked from the accounts with a registry role — a list only super admins can read, so other managers can
 * change and remove members but not add one (see the notice; an API request is recorded for this).
 */
export function MembersCard({ registry }) {
  const env = useRegistryEnv()
  const { user } = useAuth()
  const refresh = useRefreshRegistry(registry.id)
  const canManage = registry.abilities.manageMembers
  const canList = canManage && Boolean(user?.is_super_admin)
  const members = useProjectMembers(registry.id)
  const accounts = useEligibleAccounts(canList)
  const config = useMemo(() => membersConfig(env, user), [env, user])
  const eligible = (accounts.data ?? []).filter((account) => !members.some((member) => member.user_id === account.id))

  let notice = null
  if (canManage && !canList) notice = <Alert tone="info">{env.t.membersAddSuperOnly}</Alert>
  else if (canList && accounts.isSuccess && eligible.length === 0) notice = <Alert tone="info">{env.t.noEligibleAccounts}</Alert>

  return (
    <CollectionTab
      resource={`${registryPath(registry.id)}/members`}
      config={config}
      canWrite={canManage}
      canCreate={canList && eligible.length > 0}
      ctx={{ accounts: eligible }}
      onChanged={refresh}
      notice={notice}
    />
  )
}
