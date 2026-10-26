import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import ProjectCover from '../ProjectCover'
import { Chevron } from './icons'

/**
 * The featured projects as a strip that scrolls sideways — big covers, the name set on the image.
 * It is the one place on the page where the work is shown at size, which is why it is not just
 * three more cards in a grid.
 */
export default function FeaturedStrip({ projects }) {
  const { t, pick, dir } = useLang()
  const track = useRef(null)
  const headingId = useId()

  if (!projects?.length) return null

  // "Next" moves along the reading direction. In a right-to-left container the browser counts
  // scrollLeft down from 0, so moving forward means a negative offset there.
  const step = (forward) => {
    const el = track.current
    if (!el) return
    const card = el.firstElementChild
    const distance = (card ? card.getBoundingClientRect().width : el.clientWidth * 0.8) + 16
    const sign = (forward ? 1 : -1) * (dir === 'rtl' ? -1 : 1)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy?.({ left: sign * distance, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section className="pf-strip" aria-labelledby={headingId}>
      <div className="pf-strip__head">
        <h2 id={headingId} className="pf-strip__title">{t.pfFeatured}</h2>
        {projects.length > 1 && (
          <div className="pf-strip__nav">
            <button type="button" onClick={() => step(false)} aria-label={t.pfPrev}><Chevron back /></button>
            <button type="button" onClick={() => step(true)} aria-label={t.pfNext}><Chevron /></button>
          </div>
        )}
      </div>

      <div ref={track} className="pf-strip__track">
        {projects.map((p) => (
          <Link key={p.id} to={`/portfolio/${p.slug}`} className="pf-feature-card pf-focus">
            <div className="pf-feature-card__media">
              <ProjectCover project={p} height="100%" />
            </div>
            <div className="pf-feature-card__scrim" />
            <div className="pf-feature-card__body">
              <div className="pf-feature-card__cat">{t.catLabels[p.category] ?? p.category}</div>
              <div className="pf-feature-card__name">{pick(p, 'name')}</div>
              {pick(p, 'short') && <div className="pf-feature-card__short">{pick(p, 'short')}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
