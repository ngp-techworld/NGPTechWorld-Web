import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import { statusLabel } from '../../lib/portfolio'
import { toHttpUrl } from '../../lib/url'
import ProjectCover from '../ProjectCover'
import { ExternalIcon, PlatformGlyph } from './icons'

function Cell({ label, children }) {
  return (
    <div className="pf-spec__cell">
      <dt className="pf-spec__label">{label}</dt>
      <dd className="pf-spec__value">{children}</dd>
    </div>
  )
}

/** The demo's address as a person would say it: the host, without the scheme or a leading www. */
const hostOf = (url) => {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return url }
}

/**
 * Title, category, the one-line summary, the facts a buyer asks about first (industry, platforms,
 * status, client, year, the live demo) and the cover.
 *
 * The facts are a definition list with one cell per fact, and a fact with no value has no cell —
 * an anonymous client or an unknown year simply is not there, label and divider included.
 */
export default function ProjectHero({ project }) {
  const { t, pick } = useLang()
  const platforms = [...new Set(project.platforms ?? [])]
  const demo = toHttpUrl(project.public_demo_url)
  const hasClient = project.client != null && String(project.client).trim() !== ''
  const hasYear = project.year != null && String(project.year).trim() !== ''
  const short = pick(project, 'short')

  return (
    <header data-hero className="pf-detail-hero">
      <Link to="/portfolio" className="pf-back pf-focus">{t.dBack}</Link>

      <div>
        <Link to={`/portfolio?category=${encodeURIComponent(project.category)}`} className="pf-detail-hero__cat pf-focus">
          {t.catLabels[project.category] ?? project.category}
        </Link>
      </div>
      <h1 className="pf-detail-hero__title ngp-fluid">{pick(project, 'name')}</h1>
      {short && <p className="pf-detail-hero__lead">{short}</p>}

      <dl className="pf-spec">
        {project.industry && (
          <Cell label={t.pfIndustry}>
            <Link to={`/portfolio?industry=${encodeURIComponent(project.industry.key)}`} className="pf-focus">
              {pick(project.industry, 'name')}
            </Link>
          </Cell>
        )}
        {platforms.length > 0 && (
          <Cell label={t.pfPlatforms}>
            <span className="pf-spec__platforms">
              {platforms.map((p) => (
                <span key={p} className="pf-spec__platform">
                  <span className="text-[var(--text-faint)]"><PlatformGlyph platform={p} size={16} /></span>
                  {t.platformLabels[p] ?? p}
                </span>
              ))}
            </span>
          </Cell>
        )}
        <Cell label={t.pfStatus}>{statusLabel(project, t)}</Cell>
        {hasClient && <Cell label={t.pfClient}>{project.client}</Cell>}
        {hasYear && <Cell label={t.pfYear}><span className="font-poppins">{project.year}</span></Cell>}
        {demo && (
          <Cell label={t.pfDemo}>
            <a href={demo} target="_blank" rel="noopener noreferrer" className="pf-focus inline-flex items-center gap-1.5" dir="ltr">
              {hostOf(demo)}
              <ExternalIcon size={13} />
              <span className="sr-only"> ({t.pfNewTab})</span>
            </a>
          </Cell>
        )}
      </dl>

      <div className="pf-detail-cover">
        <ProjectCover project={project} height="100%" markHeight={96} eager />
      </div>
    </header>
  )
}
