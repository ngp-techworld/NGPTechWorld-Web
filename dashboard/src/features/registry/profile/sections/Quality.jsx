import { Gauge } from 'lucide-react'
import { QUALITY_ATTRIBUTES } from '../../kit'
import { useProfileEnv } from '../env'
import { Part, ProfileSection } from '../parts'

const LISTS = ['implemented', 'verified', 'assumptions', 'recommendations']
const SHOWN = 3 // items of a list shown before the rest folds away
const LIST_TONES = { implemented: 'bg-info', verified: 'bg-success', assumptions: 'bg-warning', recommendations: 'bg-accent-light' }

function ItemList({ items }) {
  const { p } = useProfileEnv()
  const head = items.slice(0, SHOWN)
  const rest = items.slice(SHOWN)
  const li = (item, index) => (
    <li key={`${index}-${item}`} dir="auto" className="break-words">
      {item}
    </li>
  )
  return (
    <>
      <ul className="list-disc space-y-0.5 ps-4 text-xs text-soft">{head.map(li)}</ul>
      {rest.length ? (
        <details className="mt-0.5">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-accent-lighter hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light">{p.more(rest.length)}</summary>
          <ul className="mt-0.5 list-disc space-y-0.5 ps-4 text-xs text-soft">{rest.map(li)}</ul>
        </details>
      ) : null}
    </>
  )
}

/** The 16 non-functional attributes as compact cards: implemented, verified, assumptions, recommendations. */
export function QualitySection({ data }) {
  const { p, t, r } = useProfileEnv()
  const query = data['quality-attributes']
  return (
    <ProfileSection
      id="quality"
      tier="internal"
      icon={Gauge}
      title={p.sections.quality}
      meta={query.rows.length ? <span>{p.documented(new Set(query.rows.map((row) => row.attribute)).size, QUALITY_ATTRIBUTES.length)}</span> : null}
    >
      <Part query={query} label={t.nonfunctionalTitle} lines={4}>
        {(rows) => {
          const byAttribute = new Map(rows.map((row) => [row.attribute, row]))
          return (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {QUALITY_ATTRIBUTES.map((attribute) => {
                const record = byAttribute.get(attribute)
                const filled = record ? LISTS.filter((list) => record[list]?.length) : []
                return (
                  <li key={attribute} className="min-w-0 rounded-xl border border-white/[.07] bg-white/[.02] p-3" data-profile-block="">
                    <h3 className="text-sm font-bold text-ink">{r.qualityAttributes[attribute] ?? attribute}</h3>
                    {filled.length ? (
                      <dl className="mt-2 space-y-2">
                        {filled.map((list) => (
                          <div key={list}>
                            <dt className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
                              <span aria-hidden="true" className={`size-1.5 rounded-full ${LIST_TONES[list]}`} />
                              {t[list]} <span className="font-normal text-faint">({record[list].length})</span>
                            </dt>
                            <dd className="mt-0.5">
                              <ItemList items={record[list]} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-xs text-faint">{t.notDocumented}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        }}
      </Part>
    </ProfileSection>
  )
}
