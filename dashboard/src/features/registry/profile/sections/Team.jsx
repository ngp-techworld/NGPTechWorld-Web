import { Users } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { Avatar, Badge } from '@/ui'
import { useProfileEnv } from '../env'
import { Code, EnumBadge, Facts, MissingHint, Part, ProfileSection, Prose, SubSection } from '../parts'

const SUPPORT_TONES = { active: 'success', limited: 'warning', ended: 'neutral' }

function Developers({ developers }) {
  const { p, t, r } = useProfileEnv()
  const list = (Array.isArray(developers) ? developers : []).filter((item) => item?.name)
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => (Number(b.commits) || 0) - (Number(a.commits) || 0))
  const most = Math.max(1, ...sorted.map((item) => Number(item.commits) || 0))
  return (
    <SubSection title={t.assignedDevelopers} count={list.length}>
      <ul className="space-y-2.5">
        {sorted.map((developer) => {
          const commits = Number(developer.commits) || 0
          return (
            <li key={developer.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
              <p className="min-w-0 truncate text-sm font-semibold text-ink" dir="auto">
                {developer.name}
                {developer.source ? <span className="ms-2 text-xs font-normal text-muted">{r.developerSources[developer.source] ?? developer.source}</span> : null}
              </p>
              <p className="text-xs tabular-nums text-soft">{developer.commits === null || developer.commits === undefined ? '—' : p.commits(commits)}</p>
              {commits ? (
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent-light/70" style={{ width: `${Math.max(4, (commits / most) * 100)}%` }} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </SubSection>
  )
}

function Members({ query }) {
  const { t, r } = useProfileEnv()
  return (
    <Part query={query} label={t.membersTitle} lines={2}>
      {(rows) =>
        rows.length ? (
          <SubSection title={t.membersTitle} count={rows.length}>
            <ul className="grid gap-3 md:grid-cols-2">
              {rows.map((member) => {
                const name = member.user?.name ?? `#${member.user_id}`
                return (
                  <li key={member.id} className="flex min-w-0 gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        <span dir="auto">{name}</span>
                        <Badge tone="accent">{r.memberRoles[member.member_role] ?? member.member_role}</Badge>
                        {member.user?.registry_role ? <span className="text-xs font-normal text-muted">{r.registryRoles[member.user.registry_role]}</span> : null}
                      </p>
                      {member.user?.email ? <Code value={member.user.email} className="text-xs text-muted" /> : null}
                      <Prose text={member.responsibilities} className="text-xs text-soft" />
                    </div>
                  </li>
                )
              })}
            </ul>
          </SubSection>
        ) : null
      }
    </Part>
  )
}

/**
 * Who owns, leads and supports the project (the internal administration group), its members with their roles, the
 * developers the import found in the Git history with their commits, its components and its key dates.
 */
export function TeamSection({ record, data, missing }) {
  const { p, t, r, f } = useProfileEnv()
  const admin = record.operations?.administration ?? {}
  const components = (Array.isArray(admin.components) ? admin.components : []).filter((item) => item?.key)
  return (
    <ProfileSection id="team" tier="internal" icon={Users} title={p.sections.team}>
      <SubSection title={p.people}>
        <Facts
          items={[
            { label: t.ownerName, value: admin.owner_name },
            { label: t.technicalLeadName, value: admin.technical_lead_name },
            { label: t.projectManagerName, value: admin.project_manager_name },
            { label: t.customerName, value: admin.customer_name },
            { label: t.responsibleAdminName, value: admin.responsible_admin_name },
            { label: t.responsibleTeam, value: admin.responsible_team },
            { label: t.ngpRole, value: admin.ngp_role },
            { label: t.developmentStage, value: admin.development_stage },
            { label: t.priority, value: admin.priority ? <EnumBadge value={admin.priority} labels={r.priorities} tones={TONES.severity} /> : null },
            { label: t.supportStatus, value: admin.support_status ? <EnumBadge value={admin.support_status} labels={r.supportStatuses} tones={SUPPORT_TONES} /> : null },
            { label: t.maintenanceResponsibility, value: admin.maintenance_responsibility, wide: true },
          ]}
        />
      </SubSection>

      <Facts
        className="lg:grid-cols-3"
        items={[
          { label: t.initialDevelopmentDate, value: admin.initial_development_date ? f.date(admin.initial_development_date) : null },
          { label: t.lastMeaningfulUpdate, value: admin.last_meaningful_update ? f.date(admin.last_meaningful_update) : null },
          { label: t.lastMaintenanceDate, value: admin.last_maintenance_date ? f.date(admin.last_maintenance_date) : null },
        ]}
      />

      <Members query={data.members} />
      <Developers developers={admin.assigned_developers} />

      {components.length ? (
        <SubSection title={t.components} count={components.length}>
          <ul className="grid gap-3 md:grid-cols-2">
            {components.map((component) => (
              <li key={component.key} className="min-w-0 space-y-1 rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Code value={component.key} className="text-sm font-semibold text-ink" />
                  {component.type ? <Badge>{component.type}</Badge> : null}
                </p>
                {component.path ? <Code value={component.path} className="text-xs text-muted" /> : null}
                <Prose text={component.stack} className="text-xs text-soft" />
              </li>
            ))}
          </ul>
        </SubSection>
      ) : null}

      <MissingHint keys={missing} />
    </ProfileSection>
  )
}

/** Does the administration group hold anything? */
export const hasAdministration = (record) => Object.values(record.operations?.administration ?? {}).some((value) => value !== null && value !== '' && !(Array.isArray(value) && !value.length))
