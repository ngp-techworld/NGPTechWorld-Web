import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { CollectionTab, MEMBER_ROLES, registryPath, toOptions, useRefreshRegistry } from '@/features/registry/kit'
import { useCrudHooks } from '@/lib/crud'
import { isMfaRequired } from '@/lib/errors'
import { Alert, Badge } from '@/ui'
import { AccountPicker, useAccountSearch } from './AccountPicker'
import { useRegistryEnv } from './useRegistryEnv'

const MEMBERS_LIST = { per_page: 100, page: 1, sort: 'created_at', dir: 'asc' }

/** The members of a project (`registry/projects/{id}/members`), shared by the Members card and the endpoint names. */
export function useProjectMembers(projectId, enabled = true) {
  const hooks = useCrudHooks(`${registryPath(projectId)}/members`)
  return hooks.useList(MEMBERS_LIST, { enabled }).rows
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
  // removing yourself ends your access to this project's sensitive tabs (and to managing its members)
  deleteMessage: (row) => (row.user_id === me?.id ? t.removeYourselfMessage : t.removeMemberMessage(row.user?.name ?? `#${row.user_id}`)),
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
          span: 'full',
          // search-as-you-type: the accounts are many and the API gives at most 50 a page
          control: (props) => <AccountPicker {...props} memberIds={ctx?.memberIds} isSuperAdmin={ctx?.isSuperAdmin} />,
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
            <bdi>{row.user?.name ?? `#${row.user_id}`}</bdi> {row.user_id === me?.id ? <Badge tone="gold">{t.memberYou}</Badge> : null}
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
 * member is picked by searching the accounts with a registry role (`registry/users`, 20 at a time). The empty search
 * is read when the card opens: when it is refused (403: not a manager, or the two-step sign-in gate) the card says
 * why and offers no Add button, and members can still be changed and removed; when no account has a registry role
 * yet, the card says how to give one.
 */
export function MembersCard({ registry }) {
  const env = useRegistryEnv()
  const { user } = useAuth()
  const refresh = useRefreshRegistry(registry.id)
  const canManage = registry.abilities.manageMembers
  const members = useProjectMembers(registry.id)
  const isSuperAdmin = Boolean(user?.is_super_admin)
  const accounts = useAccountSearch('', { enabled: canManage, isSuperAdmin })
  const config = useMemo(() => membersConfig(env, user), [env, user])
  const memberKey = members.map((member) => member.user_id).join(',')
  const ctx = useMemo(() => ({ memberIds: new Set(memberKey ? memberKey.split(',').map(Number) : []), isSuperAdmin }), [memberKey, isSuperAdmin])

  const forbidden = accounts.error?.status === 403
  const nobody = accounts.isSuccess && accounts.data.total === 0 && !accounts.data.partial
  let notice = null
  if (canManage && forbidden) notice = <Alert tone="info">{`${env.t.membersAddUnavailable} ${isMfaRequired(accounts.error) ? env.c.mfaRequired : env.t.membersPickerForbidden}`}</Alert>
  else if (canManage && nobody) notice = <Alert tone="info">{env.t.noEligibleAccounts}</Alert>

  return (
    <CollectionTab
      resource={`${registryPath(registry.id)}/members`}
      config={config}
      canWrite={canManage}
      // offered even while nobody has a registry role yet: the picker says so too, and finds them once they do
      canCreate={canManage && !forbidden}
      ctx={ctx}
      onChanged={refresh}
      notice={notice}
    />
  )
}
