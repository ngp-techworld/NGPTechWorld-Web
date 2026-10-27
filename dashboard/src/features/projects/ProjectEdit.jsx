import { Suspense, lazy } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canAccessFeature } from '@/app/permissions'
import { registryPath, registryProjects, useRefreshRegistry } from '@/features/registry/kit/hooks'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from '@/ui'
import { projects } from './hooks'
import strings from './strings'

// the page itself (every tab, the registry kit) is loaded with the first project opened
const ProjectPage = lazy(() => import('./ProjectPage').then((module) => ({ default: module.ProjectPage })))

/**
 * Loads the project twice, in parallel: the original admin record (`GET /projects/{id}`: the form, the team and link
 * counts) and the registry record (`GET /registry/projects/{id}`: abilities, operations groups, completeness). When the
 * registry cannot be read (an older backend) the page still works with its original public tabs.
 */
export default function ProjectEdit() {
  const { id } = useParams()
  const t = useStrings(strings)
  const c = useCommon()
  const { pickField } = useLanguage()
  const { user } = useAuth()
  const { data: project, isLoading, isError, error, refetch } = projects.useOne(id)
  const registry = registryProjects.useOne(id)
  const refreshRegistry = useRefreshRegistry(id)
  const queryClient = useQueryClient()
  const update = projects.useUpdate({
    onSuccess: () => {
      refreshRegistry()
      // the API mirrors the gallery into the screenshots (LegacyGallery::sync): a saved gallery changes that list too
      queryClient.invalidateQueries({ queryKey: ['crud', `${registryPath(id)}/screenshots`] })
    },
  })

  // back to a list this admin can open: the original list, or the registry list for registry-only accounts
  const backTo = canAccessFeature({ id: 'projects' }, user) ? '/projects' : '/registry/projects'

  if (isLoading || registry.isLoading) return <PageSpinner />

  // `!project`: a failed background refetch keeps the old data on screen (and the form mounted) instead of an error page
  if (!project && isError) {
    return error.status === 404 ? (
      <EmptyState icon={SearchX} title={t.notFoundTitle} description={c.itemNotFound} action={<Button to={backTo}>{t.title}</Button>} />
    ) : (
      <Alert
        tone="danger"
        title={c.loadFailed}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              refetch()
              registry.refetch()
            }}
          >
            {c.retry}
          </Button>
        }
      >
        {errorText(error, c)}
      </Alert>
    )
  }
  if (!project) return null

  const record = registry.data ?? null
  // resolves with the saved project so the form can re-base itself on it
  const onSubmit = (payload) => update.mutateAsync({ id: project.id, data: payload })

  // one boundary for the header and the page, so they appear together once the page code has loaded
  return (
    <Suspense fallback={<PageSpinner />}>
      <PageHeader
        title={pickField(project, 'name') || t.editTitle}
        description={
          <bdi dir="ltr" className="font-mono text-[13px]">
            {project.slug}
          </bdi>
        }
        backTo={backTo}
        backLabel={t.title}
      />
      {!record ? (
        <Alert tone="info" className="mb-5">
          {t.registryUnavailable}
        </Alert>
      ) : null}
      <ProjectPage key={`${project.id}-${record ? 'registry' : 'legacy'}`} project={project} registry={record} onSubmit={onSubmit} saving={update.isPending} />
    </Suspense>
  )
}
