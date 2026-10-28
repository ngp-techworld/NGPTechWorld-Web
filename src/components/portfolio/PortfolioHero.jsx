import { useLang } from '../../i18n/LanguageContext'
import FeaturedStrip from './FeaturedStrip'

/** Wraps every run of digits in the sentence so the numbers can be set large in place. */
function IndexLine({ text }) {
  const parts = String(text).split(/(\d+)/)
  return (
    <p className="pf-index ngp-hero-item" style={{ '--i': 2 }}>
      {parts.map((part, i) => (/^\d+$/.test(part)
        ? <span key={i} className="pf-index__num">{part}</span>
        : part))}
    </p>
  )
}

/**
 * Heading, intro, the live count ("14 published projects across 3 fields") and the featured strip.
 * The count is only shown once the facets have answered with something to count.
 */
export default function PortfolioHero({ totals, featured }) {
  const { t } = useLang()
  const showIndex = totals && totals.projects > 0

  return (
    <header data-hero className="pf-hero">
      <h1 className="pf-hero__title ngp-fluid ngp-hero-item" style={{ '--i': 0 }}>{t.portfolioTitle}</h1>
      <p className="pf-hero__sub ngp-hero-item" style={{ '--i': 1 }}>{t.portfolioSub}</p>
      {showIndex && <IndexLine text={t.pfIndex(totals.projects, totals.categories)} />}
      <FeaturedStrip projects={featured} />
    </header>
  )
}
