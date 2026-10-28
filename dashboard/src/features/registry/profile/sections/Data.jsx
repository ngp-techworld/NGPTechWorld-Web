import { Database } from 'lucide-react'
import { useProfileEnv } from '../env'
import { Chips, Code, Facts, MissingHint, Part, ProfileSection, Prose, SubSection } from '../parts'

function Databases({ query }) {
  const { p, t, f } = useProfileEnv()
  return (
    <Part query={query} label={t.databasesTitle}>
      {(rows) =>
        rows.length ? (
          <SubSection title={t.databasesTitle} count={rows.length}>
            <ul className="space-y-3">
              {rows.map((db) => (
                <li key={db.id} className="min-w-0 space-y-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4" data-profile-block="">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <bdi dir="ltr" className="text-base font-bold text-ink">
                      {[db.engine, db.version].filter(Boolean).join(' ')}
                    </bdi>
                    {db.logical_name ? <Code value={db.logical_name} className="text-sm" /> : null}
                    {db.component ? <Code value={db.component} className="text-xs text-muted" /> : null}
                  </p>
                  <Facts
                    className="lg:grid-cols-3"
                    items={[
                      { label: t.orm, value: db.orm },
                      { label: t.migrationSystem, value: db.migration_system },
                      { label: t.migrationCount, value: db.migration_count === null || db.migration_count === undefined ? null : f.number(db.migration_count) },
                      { label: t.hosting, value: db.hosting, wide: true },
                    ]}
                  />
                  {db.tables?.length ? (
                    <details className="group rounded-lg bg-white/[.02]">
                      <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-semibold text-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light">
                        {p.tablesCount(db.tables.length)}
                      </summary>
                      <div className="px-3 pb-3">
                        <Chips values={db.tables} mono />
                      </div>
                    </details>
                  ) : null}
                  <Prose text={db.notes} className="text-xs text-muted" />
                </li>
              ))}
            </ul>
          </SubSection>
        ) : null
      }
    </Part>
  )
}

function Backups({ query, databases }) {
  const { t, f } = useProfileEnv()
  return (
    <Part query={query} label={t.backupsTitle}>
      {(rows) =>
        rows.length ? (
          <SubSection title={t.backupsTitle} count={rows.length}>
            <ul className="space-y-3">
              {rows.map((backup) => {
                const database = databases.find((item) => item.id === backup.database_id)
                return (
                  <li key={backup.id} className="min-w-0 space-y-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4" data-profile-block="">
                    <p dir="auto" className="font-bold text-ink">
                      {backup.scope || `#${backup.id}`}
                    </p>
                    <Facts
                      className="lg:grid-cols-3"
                      items={[
                        { label: t.database, value: database ? <bdi dir="ltr">{[database.engine, database.logical_name].filter(Boolean).join(' / ')}</bdi> : null },
                        { label: t.frequency, value: backup.frequency },
                        { label: t.retention, value: backup.retention },
                        { label: t.lastTestedAt, value: backup.last_tested_at ? f.date(backup.last_tested_at) : null },
                        { label: t.strategy, value: backup.strategy, wide: true },
                        { label: t.recoveryProcedure, value: backup.recovery_procedure, wide: true },
                        { label: t.monitoring, value: backup.monitoring, wide: true },
                      ]}
                    />
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

/** Databases (engine, version, ORM, migrations, tables folded away), backups, and where files and uploads go. */
export function DataSection({ record, data, missing }) {
  const { p, t } = useProfileEnv()
  const group = record.operations?.data ?? {}
  return (
    <ProfileSection id="data" tier="sensitive" icon={Database} title={p.sections.data}>
      {group.no_database ? <p className="text-sm text-soft">{p.noDatabase}</p> : null}
      <Databases query={data.databases} />
      <Backups query={data.backups} databases={data.databases.rows} />
      {group.storage_service || group.upload_handling ? (
        <SubSection title={p.storageTitle}>
          <Facts
            items={[
              { label: t.storageService, value: group.storage_service, wide: true },
              { label: t.uploadHandling, value: group.upload_handling, wide: true },
            ]}
          />
        </SubSection>
      ) : null}
      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
