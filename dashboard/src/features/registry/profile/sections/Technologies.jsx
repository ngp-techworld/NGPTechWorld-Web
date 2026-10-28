import { Cpu } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { TECH_CATEGORIES } from '../../kit'
import { useProfileEnv } from '../env'
import { Code, EnumBadge, MissingHint, Part, ProfileSection, SubSection } from '../parts'

/** The technologies grouped by their catalog category, each with its version, usage and component. */
export function TechnologiesSection({ data, missing }) {
  const { p, t, r } = useProfileEnv()
  return (
    <ProfileSection id="technologies" tier="public" icon={Cpu} title={p.sections.technologies}>
      <Part query={data.technologies} label={t.technologiesTitle} lines={3}>
        {(rows) => {
          if (!rows.length) return null
          const categoryOf = (row) => row.technology?.category ?? 'other'
          const categories = [...TECH_CATEGORIES, ...new Set(rows.map(categoryOf).filter((key) => !TECH_CATEGORIES.includes(key)))]
          return (
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {categories.map((category) => {
                const group = rows.filter((row) => categoryOf(row) === category)
                if (!group.length) return null
                return (
                  <SubSection key={category} title={r.techCategories[category] ?? category} count={group.length}>
                    <ul className="space-y-1.5">
                      {group.map((row) => (
                        <li key={row.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/[.025] px-3 py-2 text-sm">
                          <bdi dir="ltr" className="font-semibold text-ink">
                            {row.technology?.name ?? `#${row.technology_id}`}
                          </bdi>
                          {row.version ? (
                            <bdi dir="ltr" className="text-xs text-soft">
                              {row.version}
                            </bdi>
                          ) : null}
                          <span className="ms-auto flex flex-wrap items-center gap-1.5">
                            {row.component ? <Code value={row.component} className="text-[11px] text-muted" /> : null}
                            <EnumBadge value={row.usage} labels={r.techUsages} tones={TONES.usage} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SubSection>
                )
              })}
            </div>
          )
        }}
      </Part>
      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
