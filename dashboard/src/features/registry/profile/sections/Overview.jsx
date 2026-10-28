import { FileText } from 'lucide-react'
import { Badge } from '@/ui'
import { useProfileEnv } from '../env'
import { Facts, MissingHint, ProfileSection, Prose, SubSection } from '../parts'

/** Highlights stored as `{ ar, en }` (or nonfunctional ones as `{ key, title: {ar,en}, description: {ar,en} }`). */
function HighlightList({ items, title }) {
  const { pick } = useProfileEnv()
  const list = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!list.length) return null
  return (
    <SubSection title={title} count={list.length}>
      <ul className="space-y-2">
        {list.map((item, index) => {
          const heading = item.title ? pick(item.title) : null
          const body = item.title ? pick(item.description ?? {}) : pick(item)
          return (
            <li key={item.key ?? index} className="flex gap-3 text-sm">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
              <span className="min-w-0">
                {heading ? <span dir="auto" className="block font-semibold text-ink">{heading}</span> : null}
                {body ? <span dir="auto" className="block text-soft">{body}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </SubSection>
  )
}

/** Description, the business problem and its solution, who it is for, platforms, industry, category, highlights. */
export function OverviewSection({ record, industries, missing }) {
  const { p, t, r, pickField } = useProfileEnv()
  const industry = industries.find((item) => item.id === record.industry_id)
  const platforms = Array.isArray(record.platforms) ? record.platforms : []
  const pair = (left, right) =>
    left.value || right.value ? (
      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((item) =>
          item.value ? (
            <div key={item.label} className="rounded-xl border border-white/[.07] bg-white/[.02] p-4">
              <h3 className="text-xs font-bold text-muted">{item.label}</h3>
              <Prose text={item.value} className="mt-1.5 text-sm leading-relaxed text-ink" />
            </div>
          ) : null,
        )}
      </div>
    ) : null

  return (
    <ProfileSection id="overview" tier="public" icon={FileText} title={p.sections.overview}>
      {pickField(record, 'short') ? <Prose text={pickField(record, 'short')} className="max-w-prose text-[15px] font-semibold leading-relaxed text-soft" /> : null}
      {pickField(record, 'description') ? <Prose text={pickField(record, 'description')} className="max-w-prose text-sm leading-7 text-ink" /> : null}

      {pair({ label: t.businessProblem, value: pickField(record, 'business_problem') }, { label: t.solution, value: pickField(record, 'solution') })}
      {pair({ label: t.targetCustomers, value: pickField(record, 'target_customers') }, { label: t.targetUsers, value: pickField(record, 'target_users') })}

      <Facts
        className="lg:grid-cols-4"
        items={[
          { label: p.category, value: record.category ? <Badge tone="accent">{r.categories[record.category] ?? record.category}</Badge> : null },
          { label: t.industry, value: industry ? pickField(industry, 'name') : null },
          {
            label: t.platforms,
            value: platforms.length ? (
              <span className="flex flex-wrap gap-1">
                {platforms.map((platform) => (
                  <Badge key={platform}>{r.platforms[platform] ?? platform}</Badge>
                ))}
              </span>
            ) : null,
          },
          { label: p.client, value: record.client },
          { label: p.year, value: record.year ? String(record.year) : null },
        ]}
      />

      <HighlightList title={t.highlights} items={record.highlights} />
      <HighlightList title={t.technicalHighlights} items={record.technical_highlights} />
      <HighlightList title={t.nonfunctionalHighlights} items={record.nonfunctional_highlights} />

      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
