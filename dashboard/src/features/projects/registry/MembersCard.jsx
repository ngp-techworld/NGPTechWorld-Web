import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { CollectionTab, MEMBER_ROLES, registryPath, toOptions, useRefreshRegistry } from '@/features/registry/kit'
import { api } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { useCrudHooks } from '@/lib/crud'
import { Alert, Badge } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const MEMBERS_LIST = { per_page: 100, page: 1, sort: 'created_at', dir: 'asc' }

/** The members of a project (`registry/projects/{id}/members`), shared by the Members card and the endpoint names. */
export function useProjectMembers(projectId, enabled = true) {
  const hooks = useCrudHooks(`${registryPath(projectId)}/members`)
  return hooks.useList(MEMBERS_LIST, { enabled }).rows
}

const ACCOUNTS = { per_page: 100 }

/**
 * Accounts that may become members: those with a registry role, from `GET registry/users` (API contract B2: super
 * admins and registry managers, behind the two-step sign-in gate). On a backend without it (404) a super admin falls
 * back to `GET /users`, filtered to the accounts that have a registry role.
 */
function useEligibleAccounts(enabled, isSuperAdmin) {
  return useQuery({
    queryKey: ['registry', 'users', ACCOUNTS],
    queryFn: async ({ signal }) => {
      try {
        return (await api.get('/registry/users', ACCOUNTS, { signal })).data ?? []
      } catch (err) {
        if (err.status !== 404 || !isSuperAdmin) throw err
        return (await api.get('/users', { per_page: 200, sort: 'name', dir: 'asc' }, { signal })).data ?? []
      }
    },
    enabled,
    retry: false,
    select: (accounts) => accounts.filter((account) => account.registry_role),
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
 * member is picked from the accounts with a registry role (`registry/users`); when that list is refused (403, e.g. the
 * two-step sign-in gate) the card says why and members can still be changed and removed.
 */
export function MembersCard({ registry }) {
  const env = useRegistryEnv()
  const { user } = useAuth()
  const refresh = useRefreshRegistry(registry.id)
  const canManage = registry.abilities.manageMembers
  const members = useProjectMembers(registry.id)
  const accounts = useEligibleAccounts(canManage, Boolean(user?.is_super_admin))
  const config = useMemo(() => membersConfig(env, user), [env, user])
  const eligible = (accounts.data ?? []).filter((account) => !members.some((member) => member.user_id === account.id))

  let notice = null
  if (canManage && accounts.isError) notice = <Alert tone="info">{`${env.t.membersAddUnavailable} ${errorText(accounts.error, env.c)}`}</Alert>
  else if (canManage && accounts.isSuccess && eligible.length === 0) notice = <Alert tone="info">{env.t.noEligibleAccounts}</Alert>

  return (
    <CollectionTab
      resource={`${registryPath(registry.id)}/members`}
      config={config}
      canWrite={canManage}
      canCreate={canManage && accounts.isSuccess && eligible.length > 0}
      ctx={{ accounts: eligible }}
      onChanged={refresh}
      notice={notice}
    />
  )
}
