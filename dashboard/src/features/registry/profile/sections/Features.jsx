import { useState } from 'react'
import { ChevronDown, ListChecks } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { cx } from '@/lib/cx'
import { Badge } from '@/ui'
import { FEATURE_STATUSES, PUBLIC_FEATURE_STATUSES } from '../../kit'
import { useProfileEnv } from '../env'
import { Bullets, Code, EnumBadge, Highlight, MissingHint, Part, ProfileSection, Prose, SearchCount, SubSection, useProfileSearch } from '../parts'

const hasDetails = (feature) =>
  Boolean(feature.description_ar || feature.description_en || feature.business_description || feature.user_roles?.length || feature.main_workflow?.length || feature.evidence?.length || feature.tests)

function FeatureDetails({ feature }) {
  const { p, t, pickField, join } = useProfileEnv()
  const tests = feature.tests
  return (
    <div className="space-y-3 border-t border-white/[.06] px-3 pb-3 pt-3 text-sm">
      <Prose text={pickField(feature, 'description')} className="text-soft" />
      {feature.business_description ? (
        <div>
          <p className="text-xs font-bold text-muted">{t.businessDescription}</p>
          <Prose text={feature.business_description} className="mt-0.5 text-soft" />
        </div>
      ) : null}
      {feature.user_roles?.length ? (
        <p className="text-xs text-muted">
          {p.userRoles}: <span className="text-soft" dir="auto">{join(feature.user_roles)}</span>
        </p>
      ) : null}
      {feature.main_workflow?.length ? (
        <div>
          <p className="text-xs font-bold text-muted">{t.mainWorkflow}</p>
          <div className="mt-1">
            <Bullets items={feature.main_workflow} ordered />
          </div>
        </div>
      ) : null}
      {feature.evidence?.length ? (
        <div>
          <p className="text-xs font-bold text-muted">{t.evidence}</p>
          <div className="mt-1">
            <Bullets items={feature.evidence} mono />
          </div>
        </div>
      ) : null}
      {tests ? (
        <div>
          <p className="text-xs font-bold text-muted">
            {t.testsSection}: <span className="font-normal text-soft">{t.testsSummary(Boolean(tests.exist), tests.passed)}</span>
          </p>
          {tests.paths?.length ? (
            <div className="mt-1">
              <Bullets items={tests.paths} mono />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FeatureRow({ feature }) {
  const { p, t, r, pickField } = useProfileEnv()
  const onSite = feature.is_public && PUBLIC_FEATURE_STATUSES.includes(feature.status)
  const head = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <span dir="auto" className="min-w-0 font-semibold text-ink">
        <Highlight text={pickField(feature, 'name')} />
      </span>
      <Code value={feature.key} className="text-[11px] text-faint" />
      <span className="ms-auto flex flex-wrap items-center gap-1.5">
        <EnumBadge value={feature.status} labels={r.featureStatuses} tones={TONES.featureStatus} />
        <Badge tone={feature.is_public ? 'success' : 'neutral'}>{feature.is_public ? p.publicFeature : p.internalFeature}</Badge>
        {feature.is_public && !onSite ? <span className="text-[11px] text-warning">{t.notOnSite}</span> : null}
      </span>
    </div>
  )
  if (!hasDetails(feature)) return <li className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5">{head}</li>
  return (
    <li className="rounded-xl border border-white/[.06] bg-white/[.02]">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-white/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light [&::-webkit-details-marker]:hidden">
          <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          <span className="sr-only">{p.details}: </span>
          {head}
        </summary>
        <FeatureDetails feature={feature} />
      </details>
    </li>
  )
}

/** Features grouped by module, with counts by status (each a filter), searchable, details folded away. */
export function FeaturesSection({ data, missing }) {
  const { p, t, r, f, pickField } = useProfileEnv()
  const { matches } = useProfileSearch()
  const [status, setStatus] = useState(null)
  const modules = data.modules
  const features = data.features

  return (
    <ProfileSection id="features" tier="public" icon={ListChecks} title={p.sections.features} meta={features.rows.length ? <span>{f.number(features.rows.length)}</span> : null}>
      <Part query={modules} label={t.modulesTitle} lines={1}>
        {() => null}
      </Part>
      <Part query={features} label={t.featuresTitle} lines={5}>
        {(rows) => {
          if (!rows.length) return null
          const counts = Object.fromEntries(FEATURE_STATUSES.map((key) => [key, rows.filter((row) => row.status === key).length]))
          const shown = rows.filter((row) => (!status || row.status === status) && matches(row.name_ar, row.name_en, row.key, row.description_ar, row.description_en, row.business_description))
          const groups = [...modules.rows.map((module) => ({ key: `m-${module.id}`, module })), { key: 'none', module: null }]
            .map((group) => ({ ...group, features: shown.filter((row) => (group.module ? row.module_id === group.module.id : !modules.rows.some((module) => module.id === row.module_id))) }))
            .filter((group) => group.features.length)
          return (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted">{p.byStatus}</h3>
                <ul className="flex flex-wrap gap-2">
                  {FEATURE_STATUSES.filter((key) => counts[key]).map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        aria-pressed={status === key}
                        onClick={() => setStatus(status === key ? null : key)}
                        className={cx(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light',
                          status === key ? 'border-accent-light bg-accent/30 text-white' : 'border-white/[.1] text-soft hover:bg-white/[.06]',
                        )}
                      >
                        {r.featureStatuses[key]}
                        <span className="tabular-nums text-muted">{f.number(counts[key])}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <SearchCount shown={shown.length} />
              {groups.map((group) => (
                <SubSection key={group.key} title={group.module ? pickField(group.module, 'name') : p.noModule} count={group.features.length}>
                  {group.module && pickField(group.module, 'description') ? <Prose text={pickField(group.module, 'description')} className="-mt-1 text-xs text-muted" /> : null}
                  <ul className="space-y-1.5">
                    {group.features.map((feature) => (
                      <FeatureRow key={feature.id} feature={feature} />
                    ))}
                  </ul>
                </SubSection>
              ))}
              {!shown.length ? <p className="text-sm text-faint">{p.noMatches}</p> : null}
            </>
          )
        }}
      </Part>
      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
