import { Plug } from 'lucide-react'
import { useProfileEnv } from '../env'
import { Chips, EnumBadge, Part, ProfileSection, Prose } from '../parts'

/** The external services the project talks to, and the names of the env vars each needs (never their values). */
export function IntegrationsSection({ data }) {
  const { p, t, r } = useProfileEnv()
  return (
    <ProfileSection id="integrations" tier="internal" icon={Plug} title={p.sections.integrations}>
      <Part query={data.integrations} label={t.integrationsTitle}>
        {(rows) =>
          rows.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <li key={row.id} className="min-w-0 space-y-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3" data-profile-block="">
                  <p className="flex flex-wrap items-start gap-2">
                    <EnumBadge value={row.type} labels={r.integrationTypes} tones={{}} />
                    <span dir="auto" className="min-w-0 flex-1 text-sm font-semibold text-ink">
                      {row.name}
                    </span>
                  </p>
                  {row.env_vars?.length ? (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted">{t.envVars}</p>
                      <Chips values={row.env_vars} mono />
                    </div>
                  ) : null}
                  <Prose text={row.notes} className="text-xs text-muted" />
                </li>
              ))}
            </ul>
          ) : null
        }
      </Part>
    </ProfileSection>
  )
}
