import { AppWindow, BookOpen, Globe, LayoutDashboard, Link2, MonitorPlay, Server, Smartphone, Star } from 'lucide-react'
import { Completeness } from '@/features/projects/registry/PublicationCard'
import { cx } from '@/lib/cx'
import { Badge } from '@/ui'
import { DEV_TONES } from '../../RegistryProjectList'
import { AuthImage } from '../../kit'
import { useProfileEnv } from '../env'
import { EnumBadge, ExternalLink, Part, PartSkeleton, TierBadge, isWebUrl } from '../parts'

const DEPLOYMENT_TONES = { production: 'success', staging: 'info', internal: 'accent', not_deployed: 'neutral', unknown: 'neutral' }

/** The endpoint kinds worth a quick link, in the order they are shown. */
const QUICK_KINDS = ['public_site', 'production', 'admin', 'api', 'api_docs', 'store_android', 'store_ios', 'demo']
const KIND_ICONS = { public_site: Globe, production: Globe, admin: LayoutDashboard, api: Server, api_docs: BookOpen, store_android: Smartphone, store_ios: Smartphone, demo: MonitorPlay }
// a store page or the public site is one address whatever the environment; the others are the production ones
const ANY_ENVIRONMENT = ['public_site', 'store_android', 'store_ios', 'demo']
const MAX_QUICK_LINKS = 8

/** The production addresses among the endpoints, one per URL, by kind. */
export function quickLinks(endpoints, publicDemoUrl) {
  const seen = new Set()
  const links = []
  const add = (link) => {
    const key = link.url.trim().replace(/\/+$/, '').toLowerCase()
    if (!isWebUrl(link.url) || seen.has(key)) return
    seen.add(key)
    links.push(link)
  }
  QUICK_KINDS.forEach((kind) => {
    endpoints
      .filter((endpoint) => endpoint.kind === kind && (ANY_ENVIRONMENT.includes(kind) || !endpoint.environment || endpoint.environment === 'production'))
      .forEach((endpoint) => add({ id: `endpoint-${endpoint.id}`, kind, url: endpoint.url, visibility: endpoint.visibility, verification: endpoint.verification_status }))
  })
  if (publicDemoUrl) add({ id: 'public-demo', kind: 'public_demo', url: publicDemoUrl, visibility: 'public', verification: null })
  return links.slice(0, MAX_QUICK_LINKS)
}

const hostOf = (url) => {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
  } catch {
    return url
  }
}

function QuickLink({ link }) {
  const { p, r } = useProfileEnv()
  const Icon = KIND_ICONS[link.kind] ?? (link.kind === 'public_demo' ? AppWindow : Link2)
  const label = link.kind === 'public_demo' ? p.publicDemo : (r.endpointKinds[link.kind] ?? link.kind)
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2.5">
      <span aria-hidden="true" className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-lighter">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <ExternalLink href={link.url} className="max-w-full text-sm">
          <bdi dir="ltr" className="truncate font-mono text-[12.5px]">
            {hostOf(link.url)}
          </bdi>
        </ExternalLink>
        <div className="flex flex-wrap gap-1">
          <EnumBadge value={link.visibility} labels={r.visibilities} tones={{ public: 'success', private: 'neutral' }} />
          <EnumBadge value={link.verification} labels={r.urlVerifications} tones={{ confirmed: 'success', unverified: 'warning' }} />
        </div>
      </div>
    </li>
  )
}

/**
 * The top of the dossier: the cover (the project's own, else the screenshot marked as the cover, else the first
 * public one), both names and the slug, every status badge, the completeness with what is missing, the quick links
 * of the production addresses (from the endpoints, a sensitive collection, plus the public demo link) and the dates.
 */
export function SummarySection({ record, data }) {
  const { p, t, r, f, pickField, lang } = useProfileEnv()
  const screenshots = data.screenshots
  const cover =
    record.cover_image_url ??
    (() => {
      const rows = screenshots.rows
      const chosen = rows.find((row) => row.is_cover) ?? rows.find((row) => row.is_public)
      return chosen ? (chosen.url ?? chosen.thumbnail_url) : null
    })()
  const otherLang = lang === 'ar' ? 'en' : 'ar'
  const name = pickField(record, 'name')
  const otherName = record[`name_${otherLang}`]
  const endpoints = data.endpoints
  const links = quickLinks(endpoints.enabled ? endpoints.rows : [], record.public_demo_url)
  // without the endpoints (a sensitive collection) only the public demo link can be shown
  const showLinks = endpoints.enabled || links.length > 0

  return (
    <section aria-labelledby="profile-title" id="profile-summary" data-tier="public" data-profile-card="" tabIndex={-1} className="scroll-mt-24 overflow-hidden lg:scroll-mt-40 rounded-panel border border-white/[.09] bg-white/[.035] shadow-card focus:outline-none">
      <div className="grid gap-0 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] bg-white/[.04] md:aspect-auto md:min-h-[240px]">
          {cover ? (
            <AuthImage src={cover} alt="" className="absolute inset-0" />
          ) : screenshots.isLoading ? (
            <div className="absolute inset-0 animate-pulse bg-white/[.06]" aria-hidden="true" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-faint">{p.noCover}</span>
          )}
        </div>

        <div className="min-w-0 space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 id="profile-title" className="text-2xl font-extrabold leading-tight text-ink sm:text-[30px]">
                {name}
              </h1>
              {otherName && otherName !== name ? (
                <p className="text-base font-semibold text-soft">
                  <bdi dir={otherLang === 'ar' ? 'rtl' : 'ltr'} lang={otherLang}>
                    {otherName}
                  </bdi>
                </p>
              ) : null}
              <p className="text-xs text-muted">
                {p.slug}:{' '}
                <bdi dir="ltr" className="font-mono text-soft">
                  {record.slug}
                </bdi>
              </p>
            </div>
            <TierBadge tier="public" />
          </div>

          <ul aria-label={p.statuses} className="flex flex-wrap items-center gap-1.5">
            <li>
              <EnumBadge value={record.development_status} labels={r.developmentStatuses} tones={DEV_TONES} />
            </li>
            <li>
              <EnumBadge value={record.deployment_status} labels={r.deploymentStatuses} tones={DEPLOYMENT_TONES} />
            </li>
            <li>
              <Badge tone={record.publication_status === 'published' ? 'success' : 'neutral'} dot>
                {r.publicationStatuses[record.publication_status] ?? record.publication_status}
              </Badge>
            </li>
            {record.featured ? (
              <li>
                <Badge tone="gold">
                  <Star size={11} aria-hidden="true" />
                  {t.featuredBadge}
                </Badge>
              </li>
            ) : null}
            {record.archived_at ? (
              <li>
                <Badge tone="warning">{r.developmentStatuses.archived}</Badge>
              </li>
            ) : null}
          </ul>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted">{p.lastImport}</dt>
              <dd className="mt-0.5 text-soft">{record.last_imported_at ? f.dateTime(record.last_imported_at) : <span className="text-faint">{p.neverImported}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">{p.lastUpdate}</dt>
              <dd className="mt-0.5 text-soft">{f.dateTime(record.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className={cx('grid gap-6 border-t border-white/[.07] p-5 sm:p-6', showLinks && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]')}>
        {showLinks ? (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold text-soft">{p.quickLinks}</h2>
              {endpoints.enabled ? <TierBadge tier="sensitive" /> : null}
            </div>
            {endpoints.isLoading ? (
              <PartSkeleton lines={2} />
            ) : endpoints.isError ? (
              <Part query={endpoints} label={t.endpointsTitle}>
                {() => null}
              </Part>
            ) : links.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {links.map((link) => (
                  <QuickLink key={link.id} link={link} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">{p.nothingYet}</p>
            )}
          </div>
        ) : null}
        <div className="min-w-0">
          <Completeness completeness={record.completeness} />
        </div>
      </div>
    </section>
  )
}
