import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import { useSpotlight } from '../../lib/useSpotlight'
import { toHttpUrl } from '../../lib/url'
import { toEmbedUrl } from '../../lib/video'
import Icon from '../Icon'
import TeamCard from '../TeamCard'
import PfSection from './PfSection'
import PortfolioCard from './PortfolioCard'
import { ExternalIcon } from './icons'

/** The project video: an embedded player for YouTube / Vimeo, otherwise a link out. As before. */
export function ProjectVideo({ project }) {
  const { t } = useLang()
  const href = toHttpUrl(project.video_url)
  if (!href) return null
  const embed = toEmbedUrl(project.video_url)

  return (
    <PfSection title={t.dVideo}>
      {embed ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--line-soft)]" style={{ aspectRatio: '16/9' }}>
          <iframe className="h-full w-full" src={embed} title={t.dVideo} allowFullScreen loading="lazy" />
        </div>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className="pf-btn pf-btn--ghost">{t.dVideoOpen}</a>
      )}
    </PfSection>
  )
}

export function ProjectTeam({ project }) {
  const { t } = useLang()
  const team = project.team ?? []
  if (team.length === 0) return null
  return (
    <PfSection title={t.dTeam}>
      <div className="grid gap-[18px] md:grid-cols-2">
        {team.map((m, i) => <TeamCard key={i} member={m} />)}
      </div>
    </PfSection>
  )
}

export function ProjectLinks({ project }) {
  const { t } = useLang()
  // Only plain http(s) links reach the page — the same rule as the social links.
  const links = (project.links ?? []).map((l) => ({ ...l, href: toHttpUrl(l.url) })).filter((l) => l.href)
  if (links.length === 0) return null
  return (
    <PfSection title={t.dLinks}>
      <div className="flex flex-wrap gap-3">
        {links.map((l, i) => (
          <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className="pf-btn pf-btn--ghost">
            <Icon path='<path d="M7 17 17 7M9 7h8v8"/>' size={16} stroke="var(--brand-300)" />
            {t.socialMeta[l.type] || l.type}
            <span className="sr-only"> ({t.pfNewTab})</span>
          </a>
        ))}
      </div>
    </PfSection>
  )
}

/** The live demo, offered once more where the visitor has finished reading. */
export function DemoBand({ project }) {
  const { t } = useLang()
  const demo = toHttpUrl(project.public_demo_url)
  if (!demo) return null
  return (
    <section className="pf-section" aria-labelledby="pf-demo-title">
      <div className="pf-band">
        <div>
          <h2 id="pf-demo-title" className="pf-band__title ngp-fluid">{t.pfDemoTitle}</h2>
          <p className="pf-band__sub">{t.pfDemoSub}</p>
        </div>
        <a href={demo} target="_blank" rel="noopener noreferrer" className="pf-btn pf-btn--primary">
          {t.pfDemoBtn}
          <ExternalIcon size={15} />
          <span className="sr-only"> ({t.pfNewTab})</span>
        </a>
      </div>
    </section>
  )
}

export function RelatedProjects({ project }) {
  const { t } = useLang()
  const related = project.related ?? []
  if (related.length === 0) return null
  return (
    <PfSection title={t.pfRelated}>
      <ul className="pf-grid !mt-0">
        {related.map((p) => <li key={p.id} className="h-full"><PortfolioCard project={p} /></li>)}
      </ul>
    </PfSection>
  )
}

/** The closing call to action. The link carries the slug so the contact form can name the project. */
export function ProjectContactCTA({ project }) {
  const { t } = useLang()
  const spot = useSpotlight()
  return (
    <section className="pf-section">
      <div ref={spot} className="ngp-card ngp-card--flat relative overflow-hidden px-6 py-[clamp(36px,6vw,60px)] text-center">
        <span className="ngp-bracket ngp-bracket--tl" />
        <span className="ngp-bracket ngp-bracket--br" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--brand-glow), transparent 70%)' }}
        />
        <div className="relative">
          <h2 className="ngp-fluid mx-auto mb-3 max-w-[640px] text-[clamp(23px,4vw,34px)] font-bold leading-[1.25] text-[var(--text-strong)]">
            {t.pfContactTitle}
          </h2>
          <p className="mx-auto mb-7 max-w-[520px] text-[clamp(14.5px,2vw,16.5px)] leading-[1.7] text-[var(--text-muted)]">
            {t.pfContactSub}
          </p>
          <Link to={`/contact?project=${encodeURIComponent(project.slug)}`} className="pf-btn pf-btn--primary">
            {t.pfContactBtn}
          </Link>
        </div>
      </div>
    </section>
  )
}
