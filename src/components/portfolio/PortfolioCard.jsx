import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import { useSpotlight } from '../../lib/useSpotlight'
import { pickPair } from '../../lib/portfolio'
import { toHttpUrl } from '../../lib/url'
import ProjectCover from '../ProjectCover'
import PlatformIcons from './PlatformIcons'
import { Chevron, ExternalIcon, HexDot } from './icons'

const MAX_CHIPS = 4

/**
 * One project on /portfolio and in "related projects". Takes both API shapes: the portfolio card
 * (with `highlight` and `public_demo_url`) and the plain list item, which has neither.
 *
 * The title is the card's only link to the detail page, stretched over the whole card by CSS. That
 * keeps the demo button a real, separate link: an <a> wrapped around the card could not contain it.
 */
export default function PortfolioCard({ project, headingLevel = 3 }) {
  const { t, pick, contentLang } = useLang()
  const spot = useSpotlight()
  const H = `h${headingLevel}`

  const name = pick(project, 'name')
  const short = pick(project, 'short')
  const highlight = pickPair(project.highlight, contentLang)
  const demo = toHttpUrl(project.public_demo_url)
  const chips = (project.technologies ?? []).slice(0, MAX_CHIPS)

  return (
    <article ref={spot} className="ngp-card pf-card group">
      <span className="ngp-bracket ngp-bracket--tl" />
      <span className="ngp-bracket ngp-bracket--br" />

      <div className="pf-card__cover">
        <div className="pf-card__cover-inner">
          <ProjectCover project={project} height="100%" />
        </div>
      </div>

      <div className="pf-card__body">
        <div className="pf-card__meta">
          <span className="pf-card__cat">{t.catLabels[project.category] ?? project.category}</span>
          <PlatformIcons platforms={project.platforms} size={16} />
        </div>

        <H className="pf-card__title">
          <Link to={`/portfolio/${project.slug}`} className="pf-card__link">{name}</Link>
        </H>

        {short && <p className="pf-card__short">{short}</p>}

        {highlight && (
          <p className="pf-card__highlight"><HexDot />{highlight}</p>
        )}

        {chips.length > 0 && (
          <ul className="pf-chips" aria-label={t.pfTechnology}>
            {chips.map((tech) => <li key={tech.slug} className="pf-chip" title={tech.name}>{tech.name}</li>)}
          </ul>
        )}

        <div className="pf-card__foot">
          {/* The stretched title link already takes the visitor there; this is the visible cue. */}
          <span className="pf-card__cue" aria-hidden="true">{t.pfDetails}<Chevron size={15} /></span>
          {demo && (
            <a href={demo} target="_blank" rel="noopener noreferrer" className="pf-card__demo">
              {t.pfDemo}
              <ExternalIcon size={13} />
              <span className="sr-only"> ({t.pfNewTab})</span>
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
