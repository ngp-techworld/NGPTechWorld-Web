import { useId } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import { filled, pickPair, TECH_CATEGORIES } from '../../lib/portfolio'
import PfSection from './PfSection'
import { HexDot } from './icons'

/**
 * The content sections of a project page. Each one renders nothing at all when it has nothing to
 * say — the registry fills these in over time, and a heading over an empty box reads as broken.
 */

/** Description, with the highlights and the audience beside it when there are any. */
export function ProjectOverview({ project }) {
  const { t, pick, contentLang } = useLang()
  const description = pick(project, 'description')
  const highlights = (project.highlights ?? []).map((h) => pickPair(h, contentLang)).filter(filled)
  const customers = pick(project, 'target_customers')
  const users = pick(project, 'target_users')
  const audience = [[t.pfCustomers, customers], [t.pfUsers, users]].filter(([, text]) => filled(text))
  const hasAside = highlights.length > 0 || audience.length > 0

  if (!filled(description) && !hasAside) return null

  return (
    <PfSection title={t.dAbout}>
      <div className={'pf-overview ' + (hasAside && filled(description) ? 'pf-overview--aside' : '')}>
        {filled(description) && <p className="pf-prose">{description}</p>}
        {hasAside && (
          <div className="pf-aside">
            {highlights.length > 0 && (
              <div>
                <h3 className="pf-aside__title">{t.pfAtAGlance}</h3>
                <ul className="pf-ticks">
                  {highlights.map((text, i) => <li key={i}><HexDot />{text}</li>)}
                </ul>
              </div>
            )}
            {audience.length > 0 && (
              <div>
                <h3 className="pf-aside__title">{t.pfAudience}</h3>
                <dl className="grid gap-3">
                  {audience.map(([label, text]) => (
                    <div key={label}>
                      <dt className="text-[12.5px] text-[var(--text-faint)]">{label}</dt>
                      <dd className="pf-aside__text">{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </PfSection>
  )
}

/** The circuit trace between the problem and the solution: across on a wide screen, down on a phone. */
function Trace() {
  return (
    <div className="pf-trace" aria-hidden="true">
      <svg className="pf-trace__h" viewBox="0 0 72 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h22" opacity=".55" />
        <circle cx="34" cy="12" r="5" />
        <circle cx="34" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <path d="M44 12h22M62 7.5l5 4.5-5 4.5" />
      </svg>
      <svg className="pf-trace__v" viewBox="0 0 24 56" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v16" opacity=".55" />
        <circle cx="12" cy="26" r="5" />
        <circle cx="12" cy="26" r="1.6" fill="currentColor" stroke="none" />
        <path d="M12 36v16M7.5 48l4.5 5 4.5-5" />
      </svg>
    </div>
  )
}

function Panel({ title, text, solution = false }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={'pf-ps__panel ' + (solution ? 'pf-ps__panel--solution' : '')}>
      <h2 id={id} className="pf-ps__label ngp-fluid">{title}</h2>
      <p className="pf-ps__text">{text}</p>
    </section>
  )
}

/** Problem → solution, side by side with the trace between them; either one alone if that is all there is. */
export function ProblemSolution({ project }) {
  const { t, pick } = useLang()
  const problem = pick(project, 'business_problem')
  const solution = pick(project, 'solution')
  const both = filled(problem) && filled(solution)
  if (!filled(problem) && !filled(solution)) return null

  return (
    <div className={'pf-section pf-ps ' + (both ? 'pf-ps--both' : '')}>
      {filled(problem) && <Panel title={t.pfProblem} text={problem} />}
      {both && <Trace />}
      {filled(solution) && <Panel title={t.pfSolution} text={solution} solution />}
    </div>
  )
}

/** Features under the module they belong to, in the modules' order; the rest under "General". */
export function ProjectFeatures({ project }) {
  const { t, pick } = useLang()
  const features = (project.features ?? []).filter((f) => filled(pick(f, 'name')))
  if (features.length === 0) return null

  const modules = project.modules ?? []
  const known = new Set(modules.map((m) => m.key))
  const groups = [
    ...modules.map((m) => ({ key: m.key, name: pick(m, 'name'), items: features.filter((f) => f.module === m.key) })),
    { key: '__general', name: t.pfFeaturesOther, items: features.filter((f) => !f.module || !known.has(f.module)) },
  ].filter((g) => g.items.length > 0)

  return (
    <PfSection title={t.pfFeatures} count={features.length}>
      <div>
        {groups.map((g) => (
          <div key={g.key} className="pf-group">
            <h3 className="pf-group__name ngp-fluid">{g.name}</h3>
            <ul className="pf-features">
              {g.items.map((f) => (
                <li key={f.key} className="pf-feature">
                  <HexDot />
                  <div>
                    <div className="pf-feature__name">{pick(f, 'name')}</div>
                    {filled(pick(f, 'description')) && <p className="pf-feature__desc">{pick(f, 'description')}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PfSection>
  )
}

/** The functional modules as a map of the product, each with what it is for. */
export function ProjectModules({ project }) {
  const { t, pick } = useLang()
  const modules = (project.modules ?? []).filter((m) => filled(pick(m, 'name')))
  if (modules.length === 0) return null

  return (
    <PfSection title={t.pfModules} count={modules.length}>
      <ul className="pf-modules">
        {modules.map((m) => (
          <li key={m.key} className="pf-module">
            <h3 className="pf-module__name ngp-fluid"><HexDot />{pick(m, 'name')}</h3>
            {filled(pick(m, 'description')) && <p className="pf-module__desc">{pick(m, 'description')}</p>}
          </li>
        ))}
      </ul>
    </PfSection>
  )
}

/** Engineering highlights and the quality attributes, in two columns when both exist. */
export function ProjectHighlights({ project }) {
  const { t, contentLang } = useLang()
  const technical = (project.technical_highlights ?? []).map((h) => pickPair(h, contentLang)).filter(filled)
  const quality = (project.nonfunctional_highlights ?? [])
    .map((q) => ({ key: q.key, title: pickPair(q.title, contentLang), description: pickPair(q.description, contentLang) }))
    .filter((q) => filled(q.title))
  if (technical.length === 0 && quality.length === 0) return null

  const both = technical.length > 0 && quality.length > 0

  return (
    <div className={'pf-section pf-two ' + (both ? 'pf-two--both' : '')}>
      {technical.length > 0 && (
        <PfSection title={t.pfTechHighlights} className="!mt-0">
          <ul className="pf-ticks">
            {technical.map((text, i) => <li key={i}><HexDot />{text}</li>)}
          </ul>
        </PfSection>
      )}
      {quality.length > 0 && (
        <PfSection title={t.pfQuality} className="!mt-0">
          <ul className="pf-quality">
            {quality.map((q) => (
              <li key={q.key}>
                <div className="pf-quality__title">{q.title}</div>
                {filled(q.description) && <p className="pf-quality__desc">{q.description}</p>}
              </li>
            ))}
          </ul>
        </PfSection>
      )}
    </div>
  )
}

/** The stack, one row per technology category, each technology linking to the projects that use it. */
export function TechStack({ project }) {
  const { t } = useLang()
  const techs = project.technologies ?? []
  if (techs.length === 0) return null

  const order = (cat) => {
    const i = TECH_CATEGORIES.indexOf(cat)
    return i === -1 ? TECH_CATEGORIES.length : i
  }
  const byCategory = new Map()
  for (const tech of techs) {
    const cat = TECH_CATEGORIES.includes(tech.category) ? tech.category : 'other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat).push(tech)
  }
  const rows = [...byCategory.entries()].sort(([a], [b]) => order(a) - order(b))

  return (
    <PfSection title={t.pfStack} count={techs.length}>
      <dl className="pf-stack">
        {rows.map(([cat, list]) => (
          <div key={cat} className="pf-stack__row">
            <dt className="pf-stack__cat">{t.techCategories[cat] ?? cat}</dt>
            <dd className="flex flex-wrap gap-2">
              {list.map((tech) => (
                <Link key={tech.slug} to={`/portfolio?tech=${encodeURIComponent(tech.slug)}`} className="pf-chip">{tech.name}</Link>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </PfSection>
  )
}
