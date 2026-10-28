import { ChevronDown, Wrench } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { Badge } from '@/ui'
import { useProfileEnv } from '../env'
import { Bullets, EnumBadge, Facts, Highlight, Part, ProfileSection, Prose, SearchCount, SubSection, useProfileSearch } from '../parts'

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }
const STATUS_RANK = { open: 0, in_progress: 1, done: 2 }
const rank = (map, value) => map[value] ?? Object.keys(map).length

/** Risks first by severity (critical first), then by status (open first), then in their own order. */
export const sortRisks = (rows) =>
  [...rows].sort((a, b) => rank(SEVERITY_RANK, a.severity) - rank(SEVERITY_RANK, b.severity) || rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) || (a.order ?? 0) - (b.order ?? 0))

const dateOf = (row) => row.occurred_at ?? row.created_at ?? ''

function Record({ record, showType }) {
  const { t, r, f } = useProfileEnv()
  const head = (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <EnumBadge value={record.severity} labels={r.severities} tones={TONES.severity} />
        {showType ? <EnumBadge value={record.type} labels={r.recordTypes} /> : null}
        <EnumBadge value={record.status} labels={r.recordStatuses} tones={TONES.recordStatus} />
        {record.occurred_at ? <span className="text-[11px] text-muted">{f.date(record.occurred_at)}</span> : null}
        {record.author_name ? <span className="text-[11px] text-muted">{`${t.author}: ${record.author_name}`}</span> : null}
      </div>
      <p dir="auto" className="text-sm font-semibold leading-relaxed text-ink">
        <Highlight text={record.title} />
      </p>
    </div>
  )
  if (!record.body) return <li className="rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5">{head}</li>
  return (
    <li className="rounded-xl border border-white/[.06] bg-white/[.02]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 rounded-xl px-3 py-2.5 hover:bg-white/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light [&::-webkit-details-marker]:hidden">
          <ChevronDown size={15} aria-hidden="true" className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-180" />
          {head}
        </summary>
        <div className="border-t border-white/[.06] px-3 py-3 ps-9">
          <Prose text={record.body} className="text-sm text-soft" />
        </div>
      </details>
    </li>
  )
}

function Monitoring({ group }) {
  const { t } = useProfileEnv()
  if (!group) return null
  const lists = [
    ['scheduled_jobs', t.scheduledJobs],
    ['queue_workers', t.queueWorkers, true],
    ['cron_jobs', t.cronJobs, true],
    ['procedures', t.procedures],
  ].filter(([key]) => group[key]?.length)
  const facts = [
    { label: t.healthCheck, value: group.health_check },
    { label: t.logging, value: group.logging },
    { label: t.errorMonitoring, value: group.error_monitoring },
    { label: t.serverMonitoring, value: group.server_monitoring },
    { label: t.uptimeMonitoring, value: group.uptime_monitoring },
    { label: t.backupMonitoring, value: group.backup_monitoring },
  ]
  if (!lists.length && !facts.some((item) => item.value)) return null
  return (
    <SubSection title={t.monitoringTitle}>
      <Facts items={facts} />
      {lists.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {lists.map(([key, label, mono]) => (
            <div key={key} className="min-w-0">
              <p className="text-xs font-semibold text-muted">{label}</p>
              <div className="mt-1">
                <Bullets items={group[key]} mono={mono} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SubSection>
  )
}

/** Risks sorted by severity, then the rest of the maintenance log (newest first), then how it is monitored. */
export function MaintenanceSection({ record, data }) {
  const { p, t } = useProfileEnv()
  const { matches } = useProfileSearch()
  const query = data['maintenance-records']
  const openRisks = query.rows.filter((row) => row.type === 'risk' && row.status !== 'done').length
  return (
    <ProfileSection id="maintenance" tier="internal" icon={Wrench} title={p.sections.maintenance} meta={openRisks ? <Badge tone="warning">{p.openRisks(openRisks)}</Badge> : null}>
      <Part query={query} label={t.recordsTitle} lines={4}>
        {(rows) => {
          if (!rows.length) return null
          const shown = rows.filter((row) => matches(row.title, row.body))
          const risks = sortRisks(shown.filter((row) => row.type === 'risk'))
          const others = shown.filter((row) => row.type !== 'risk').sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))))
          const totalRisks = rows.filter((row) => row.type === 'risk').length
          return (
            <>
              <SearchCount shown={shown.length} />
              {totalRisks ? (
                <SubSection title={p.risksTitle} count={totalRisks}>
                  <ul className="space-y-1.5" aria-label={p.risksTitle}>
                    {risks.map((row) => (
                      <Record key={row.id} record={row} />
                    ))}
                  </ul>
                </SubSection>
              ) : null}
              {rows.length > totalRisks ? (
                <SubSection title={p.otherRecords} count={rows.length - totalRisks}>
                  <ul className="space-y-1.5">
                    {others.map((row) => (
                      <Record key={row.id} record={row} showType />
                    ))}
                  </ul>
                </SubSection>
              ) : null}
              {!shown.length ? <p className="text-sm text-faint">{p.noMatches}</p> : null}
            </>
          )
        }}
      </Part>
      <Monitoring group={record.operations?.monitoring} />
    </ProfileSection>
  )
}
