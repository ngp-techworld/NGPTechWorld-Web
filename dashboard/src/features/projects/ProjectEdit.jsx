import { useParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canAccessFeature } from '@/app/permissions'
import { registryProjects, useRefreshRegistry } from '@/features/registry/kit'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from '@/ui'
import { ProjectPage } from './ProjectPage'
import { projects } from './hooks'
import registryTabStrings from './registry/strings'
import strings from './strings'

/**
 * Loads the project twice, in parallel: the original admin record (`GET /projects/{id}`: the form, the team and link
 * counts) and the registry record (`GET /registry/projects/{id}`: abilities, operations groups, completeness). When the
 * registry cannot be read (an older backend) the page still works with its original public tabs.
 */
export default function ProjectEdit() {
  const { id } = useParams()
  const t = useStrings(strings)
  const rt = useStrings(registryTabStrings)
  const c = useCommon()
  const { pickField } = useLanguage()
  const { user } = useAuth()
  const { data: project, isLoading, isError, error, refetch } = projects.useOne(id)
  const registry = registryProjects.useOne(id)
  const refreshRegistry = useRefreshRegistry(id)
  const update = projects.useUpdate({ onSuccess: () => refreshRegistry() })

  if (isLoading || registry.isLoading) return <PageSpinner />

  // `!project`: a failed background refetch keeps the old data on screen (and the form mounted) instead of an error page
  if (!project && isError) {
    return error.status === 404 ? (
      <EmptyState icon={SearchX} title={t.notFoundTitle} description={c.itemNotFound} action={<Button to="/projects">{t.title}</Button>} />
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
  // back to a list this admin can open: the original list, or the registry list for registry-only accounts
  const backTo = canAccessFeature({ id: 'projects' }, user) ? '/projects' : '/registry/projects'

  return (
    <>
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
          {rt.registryUnavailable}
        </Alert>
      ) : null}
      <ProjectPage key={`${project.id}-${record ? 'registry' : 'legacy'}`} project={project} registry={record} onSubmit={onSubmit} saving={update.isPending} />
    </>
  )
}
