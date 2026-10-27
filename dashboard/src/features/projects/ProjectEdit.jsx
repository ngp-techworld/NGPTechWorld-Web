import { Suspense, lazy } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { MfaNotice } from '@/app/MfaNotice'
import { canAccessFeature } from '@/app/permissions'
import { registryPath, registryProjects, useRefreshRegistry } from '@/features/registry/kit/hooks'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from '@/ui'
import { projects } from './hooks'
import strings from './strings'

// the page itself (every tab, the registry kit) is loaded with the first project opened
const ProjectPage = lazy(() => import('./ProjectPage').then((module) => ({ default: module.ProjectPage })))

/**
 * How the page is shown when the registry record is missing, from why it is missing. Only a 404 means "this backend
 * has no registry" (the original page, editable as the original admin endpoints allow); the two-step sign-in gate keeps
 * the public tabs from the original record; any other failure is shown with Retry and nothing is editable — the page
 * never invents abilities the server did not grant.
 */
function fallbackFor(error, user) {
  const editsContent = canAccessFeature({ id: 'projects' }, user) // the original endpoints' own rule (ProjectPolicy)
  if (error?.status === 404) return { mode: 'legacy', abilities: { view: true, updatePublic: editsContent } }
  if (isMfaRequired(error)) return { mode: 'mfa', abilities: { view: true, updatePublic: editsContent } }
  return { mode: 'error', abilities: { view: true } }
}

/**
 * Loads the project twice, in parallel: the original admin record (`GET /projects/{id}`: the form, the team and link
 * counts) and the registry record (`GET /registry/projects/{id}`: abilities, operations groups, completeness).
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
  const fallback = record ? null : fallbackFor(registry.error, user)
  const mode = record ? 'registry' : fallback.mode
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
      {mode === 'legacy' ? (
        <Alert tone="info" className="mb-5">
          {t.registryUnavailable}
        </Alert>
      ) : null}
      {mode === 'mfa' || record?.mfa_enrollment_required ? <MfaNotice className="mb-5" /> : null}
      {mode === 'error' ? (
        <Alert
          tone="danger"
          className="mb-5"
          title={t.registryFailed}
          action={
            <Button size="sm" variant="secondary" onClick={() => registry.refetch()} loading={registry.isFetching}>
              {c.retry}
            </Button>
          }
        >
          {errorText(registry.error, c)}
        </Alert>
      ) : null}
      <ProjectPage
        key={`${project.id}-${mode}`}
        project={project}
        registry={record}
        fallbackAbilities={fallback?.abilities}
        onSubmit={onSubmit}
        saving={update.isPending}
      />
    </Suspense>
  )
}
