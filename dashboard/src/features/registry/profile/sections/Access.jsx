import { KeyRound, LockKeyhole } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { Badge } from '@/ui'
import { useProfileEnv } from '../env'
import { Chips, DoneMark, EnumBadge, Facts, Highlight, Part, ProfileSection, Prose, SearchCount, SubSection, VaultRef, useProfileSearch } from '../parts'

const SECRET_ORDER = { to_create: 0, unknown: 1, exists: 2 }

/** The fixed reminder of the section: there are no passwords here, only where to find them. */
function VaultNote() {
  const { p } = useProfileEnv()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/[.07] px-4 py-3">
      <LockKeyhole size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-gold-light">{p.vaultNote}</p>
        <p className="mt-0.5 text-soft">{p.vaultNoteDetail}</p>
      </div>
    </div>
  )
}

function AccountRoles({ roles }) {
  const { t, r } = useProfileEnv()
  const list = (Array.isArray(roles) ? roles : []).filter((item) => item?.role)
  if (!list.length) return null
  return (
    <SubSection title={t.accountRoles} count={list.length}>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((role) => (
          <li key={role.role} className="min-w-0 space-y-1.5 rounded-xl border border-white/[.07] bg-white/[.02] p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span dir="auto" className="text-sm font-bold text-ink">
                {role.role}
              </span>
              <EnumBadge value={role.kind} labels={r.accountKinds} />
            </p>
            <Prose text={role.description} className="text-xs text-soft" />
            {role.permissions_summary ? (
              <p className="text-xs text-muted">
                <span className="font-semibold">{t.rolePermissions}: </span>
                <span dir="auto">{role.permissions_summary}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SubSection>
  )
}

/** Who signs in where: identifiers, roles, MFA and the vault reference of each account (copyable). No passwords. */
function AccountsTable({ query }) {
  const { p, t, r, f } = useProfileEnv()
  const { matches } = useProfileSearch()
  return (
    <Part query={query} label={p.accountsTable}>
      {(rows) => {
        if (!rows.length) return null
        const shown = rows.filter((row) => matches(row.purpose, row.identifier, row.role, row.owner, row.vault_ref, r.environments[row.environment], r.accountKinds[row.kind]))
        return (
          <SubSection title={p.accountsTable} count={rows.length} actions={<SearchCount shown={shown.length} />}>
            <div className="overflow-x-auto rounded-xl border border-white/[.07]">
              <table className="w-full min-w-[880px] border-collapse text-sm" aria-label={p.accountsTable}>
                <thead>
                  <tr className="border-b border-white/[.08] bg-white/[.03] text-start text-xs font-bold text-muted">
                    <th scope="col" className="px-3 py-2.5 text-start">{t.purpose}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.role}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.environment}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.owner}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.mfaStatus}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.lastVerifiedAt}</th>
                    <th scope="col" className="px-3 py-2.5 text-start">{t.vaultRef}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.06]">
                  {shown.map((row) => (
                    <tr key={row.id} className="align-top" data-account-row="">
                      <td className="px-3 py-2.5">
                        <p dir="auto" className="font-semibold text-ink">
                          <Highlight text={row.purpose} />
                        </p>
                        {row.identifier ? (
                          <p className="text-xs text-muted">
                            <bdi dir="ltr">
                              <Highlight text={row.identifier} />
                            </bdi>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {row.role ? (
                            <span dir="auto" className="text-soft">
                              <Highlight text={row.role} />
                            </span>
                          ) : null}
                          <EnumBadge value={row.kind} labels={r.accountKinds} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <EnumBadge value={row.environment} labels={r.environments} />
                      </td>
                      <td className="px-3 py-2.5 text-soft" dir="auto">
                        {row.owner ?? <span className="text-faint">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <EnumBadge value={row.mfa_status} labels={r.accountMfaStatuses} tones={TONES.mfa} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-soft">{row.last_verified_at ? f.date(row.last_verified_at) : <span className="text-faint">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <VaultRef value={row.vault_ref} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length ? <p className="px-3 py-4 text-sm text-faint">{p.noMatches}</p> : null}
            </div>
          </SubSection>
        )
      }}
    </Part>
  )
}

/** The secrets the project needs in the vault, as a checklist: what still has to be created first. */
function VaultChecklist({ query }) {
  const { p, t, r } = useProfileEnv()
  const { matches } = useProfileSearch()
  return (
    <Part query={query} label={p.vaultChecklist}>
      {(rows) => {
        if (!rows.length) return null
        const toCreate = rows.filter((row) => row.status === 'to_create').length
        const shown = rows
          .filter((row) => matches(row.ref, row.purpose, row.related_env_vars, row.provider))
          .sort((a, b) => (SECRET_ORDER[a.status] ?? 1) - (SECRET_ORDER[b.status] ?? 1))
        return (
          <SubSection
            title={p.vaultChecklist}
            count={rows.length}
            actions={
              <>
                <SearchCount shown={shown.length} />
                <Badge tone={toCreate ? 'warning' : 'success'}>{t.toCreateCount(toCreate)}</Badge>
              </>
            }
          >
            <ul className="divide-y divide-white/[.06] rounded-xl border border-white/[.07]">
              {shown.map((row) => (
                <li key={row.id} className="flex gap-3 px-3 py-3">
                  <DoneMark done={row.status === 'exists'} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <VaultRef value={row.ref} />
                      <EnumBadge value={row.status} labels={r.secretStatuses} tones={TONES.secret} />
                      <EnumBadge value={row.environment} labels={r.environments} />
                      {row.provider ? <span className="text-xs text-muted">{row.provider}</span> : null}
                    </div>
                    {row.purpose ? (
                      <p dir="auto" className="text-sm text-soft">
                        <Highlight text={row.purpose} />
                      </p>
                    ) : null}
                    {row.related_env_vars?.length ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{t.relatedEnvVars}:</span>
                        <Chips values={row.related_env_vars} mono />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {!shown.length ? <p className="text-sm text-faint">{p.noMatches}</p> : null}
          </SubSection>
        )
      }}
    </Part>
  )
}

/**
 * حسابات الدخول (sensitive): how people sign in (the auth group and its roles), every account with the vault
 * reference of its password, and the vault references still to create. The registry holds `vault://` references
 * only, by design, so nothing here is a password.
 */
export function AccessSection({ record, data }) {
  const { p, t, r } = useProfileEnv()
  const auth = record.operations?.auth ?? {}
  return (
    <ProfileSection id="access" tier="sensitive" icon={KeyRound} title={p.sections.access}>
      <VaultNote />
      <Facts
        items={[
          { label: t.authMethod, value: auth.auth_method, wide: true },
          { label: t.mfa, value: auth.mfa ? <EnumBadge value={auth.mfa} labels={r.mfaLevels} tones={{ required: 'success', optional: 'info', none: 'warning' }} /> : null },
          { label: t.provisioning, value: auth.provisioning },
          { label: t.recovery, value: auth.recovery },
        ]}
      />
      <AccountRoles roles={auth.account_roles} />
      <AccountsTable query={data.accounts} />
      <VaultChecklist query={data['secret-refs']} />
    </ProfileSection>
  )
}
