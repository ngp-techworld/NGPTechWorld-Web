import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useLang } from '../i18n/LanguageContext'
import PageTitle from '../components/PageTitle'
import { Skeleton } from '../components/fx/Skeleton'
import ProjectHero from '../components/portfolio/ProjectHero'
import ScreenshotGallery from '../components/portfolio/ScreenshotGallery'
import {
  ProblemSolution, ProjectFeatures, ProjectHighlights, ProjectModules, ProjectOverview, TechStack,
} from '../components/portfolio/ProjectSections'
import {
  DemoBand, ProjectContactCTA, ProjectLinks, ProjectTeam, ProjectVideo, RelatedProjects,
} from '../components/portfolio/ProjectExtras'

/** Holds the hero's shape while the project loads, so the page does not jump when it arrives. */
function DetailSkeleton() {
  return (
    <div className="pf-detail-hero" aria-hidden="true">
      <Skeleton className="h-[14px] w-32" />
      <Skeleton className="mt-8 h-[14px] w-24" />
      <Skeleton className="mt-4 h-[46px] w-2/3" />
      <Skeleton className="mt-5 h-[16px] w-1/2" />
      <Skeleton className="mt-8 h-[64px] w-full" />
      <Skeleton className="mt-8 w-full !rounded-[24px]" style={{ aspectRatio: '16 / 9' }} />
    </div>
  )
}

/**
 * /portfolio/:slug — one published project, from the overview down to the stack, the screenshots
 * and the people who built it. Sections without content are left out (see ProjectSections).
 */
export default function ProjectDetail() {
  const { slug } = useParams()
  const { t, pick } = useLang()
  const [state, setState] = useState({ status: 'loading', project: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setState({ status: 'loading', project: null })
    api.getProject(slug)
      .then((project) => { if (live) setState(project ? { status: 'ready', project } : { status: 'missing', project: null }) })
      // A 404 is a project that does not exist (or is no longer published); anything else is a
      // failure worth retrying rather than a reason to tell the visitor the project is gone.
      .catch((err) => { if (live) setState({ status: err?.status === 404 ? 'missing' : 'error', project: null }) })
    return () => { live = false }
  }, [slug, attempt])

  if (state.status === 'missing') {
    return (
      <div className="view-enter mx-auto max-w-narrow px-[26px] py-24 text-center">
        <PageTitle title={t.pfNotFound} />
        <h1 className="ngp-fluid text-[clamp(26px,4vw,34px)] font-bold text-[var(--text-strong)]">{t.pfNotFound}</h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-[1.7] text-[var(--text-muted)]">{t.pfNotFoundHint}</p>
        <Link to="/portfolio" className="pf-btn pf-btn--ghost mt-7">{t.navPortfolio}</Link>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-site px-[26px] pb-[90px]">
        <div role="status" className="pf-state mt-16">
          <p className="pf-state__title">{t.loadError}</p>
          <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setAttempt((n) => n + 1)}>{t.pfRetry}</button>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return <div className="mx-auto max-w-site px-[26px] pb-[90px]"><DetailSkeleton /></div>
  }

  const { project } = state

  return (
    <article key={project.slug} className="view-enter mx-auto max-w-site px-[26px] pb-[90px]">
      <PageTitle title={pick(project, 'name')} description={pick(project, 'short')} />
      <ProjectHero project={project} />
      <ProjectOverview project={project} />
      <ProblemSolution project={project} />
      <ProjectFeatures project={project} />
      <ProjectModules project={project} />
      <ProjectHighlights project={project} />
      <TechStack project={project} />
      <ScreenshotGallery project={project} />
      <ProjectVideo project={project} />
      <ProjectTeam project={project} />
      <ProjectLinks project={project} />
      <DemoBand project={project} />
      <RelatedProjects project={project} />
      <ProjectContactCTA project={project} />
    </article>
  )
}
