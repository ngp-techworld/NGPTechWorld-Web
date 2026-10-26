import { Activity, CheckCircle2, FileWarning, FolderKanban, Globe, Hammer, ImageOff, List, Lock, Plus, ServerCrash, Wrench } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canCreateProjects } from '@/app/permissions'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Alert, Button, PageHeader, Skeleton, StatCard } from '@/ui'
import { STATUS_GROUPS, useRegistryOverview } from './kit'
import strings from './strings'

/** Query string of a list filter, commas kept readable (`?development_status=in_development,testing`). */
export function listLink(filters = {}) {
  const query = Object.entries(filters)
    .map(([key, value]) => `${key}=${String(value).split(',').map(encodeURIComponent).join(',')}`)
    .join('&')
  return query ? `/registry/projects?${query}` : '/registry/projects'
}

/** The 10 counters of `GET /registry/overview` (spec §3.7), each opening the list filtered the same way. */
export const OVERVIEW_CARDS = [
  { key: 'total', icon: FolderKanban, tone: 'accent', filters: {} },
  { key: 'active', icon: Activity, tone: 'info', filters: { development_status: STATUS_GROUPS.active.join(',') } },
  { key: 'completed', icon: CheckCircle2, tone: 'success', filters: { development_status: 'completed' } },
  { key: 'under_development', icon: Hammer, tone: 'warning', filters: { development_status: STATUS_GROUPS.under_development.join(',') } },
  { key: 'maintenance', icon: Wrench, tone: 'info', filters: { development_status: 'maintenance' } },
  { key: 'public', icon: Globe, tone: 'success', filters: { publication_status: 'published' } },
  { key: 'internal_only', icon: Lock, tone: 'gold', filters: { publication_status: 'draft' } },
  { key: 'missing_documentation', icon: FileWarning, tone: 'danger', filters: { incomplete: 'documentation' } },
  { key: 'missing_screenshots', icon: ImageOff, tone: 'danger', filters: { incomplete: 'screenshots' } },
  { key: 'missing_operations', icon: ServerCrash, tone: 'danger', filters: { incomplete: 'operations' } },
]

export default function RegistryOverview() {
  const t = useStrings(strings)
  const c = useCommon()
  const f = useFormat()
  const { user } = useAuth()
  const { data, isLoading, isError, error, refetch } = useRegistryOverview()

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button variant="secondary" icon={List} to="/registry/projects">
              {t.allProjects}
            </Button>
            {canCreateProjects(user) ? (
              <Button icon={Plus} to="/projects/new">
                {t.newProject}
              </Button>
            ) : null}
          </>
        }
      />
      {isError && !data ? (
        <Alert tone="danger" title={t.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{c.retry}</Button>}>
          {errorText(error, c)}
        </Alert>
      ) : (
        <section aria-label={t.overviewTitle} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {OVERVIEW_CARDS.map((card) =>
            isLoading ? (
              <Skeleton key={card.key} className="h-[126px] rounded-card" />
            ) : (
              <StatCard key={card.key} label={t.cards[card.key]} value={f.number(data?.[card.key] ?? 0)} icon={card.icon} tone={card.tone} hint={t.hints[card.key]} to={listLink(card.filters)} />
            ),
          )}
        </section>
      )}
    </>
  )
}
