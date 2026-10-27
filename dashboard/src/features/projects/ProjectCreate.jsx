import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canAccessFeature, canCreateProjects } from '@/app/permissions'
import { overviewKey, registryProjects } from '@/features/registry/kit/hooks'
import { useStrings } from '@/i18n'
import { Button, EmptyState, PageHeader } from '@/ui'
import { ProjectForm } from './ProjectForm'
import { projects } from './hooks'
import strings from './strings'

export default function ProjectCreate() {
  const t = useStrings(strings)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = projects.useCreate()
  const { user } = useAuth()
  // a registry manager without the `projects` section creates from the registry list and goes back there
  const listTo = canAccessFeature({ id: 'projects' }, user) ? '/projects' : '/registry/projects'

  // the route also exists for registry viewers and developers (it belongs to the registry feature): the API would
  // refuse their save, so say it up front
  if (!canCreateProjects(user)) {
    return <EmptyState icon={Lock} title={t.cannotCreateTitle} description={t.cannotCreate} action={<Button to={listTo}>{t.title}</Button>} />
  }

  const onSubmit = async (payload) => {
    const project = await create.mutateAsync(payload)
    // the response already has the full show() shape: seed the edit page so it opens without a loading flash
    queryClient.setQueryData(projects.keys.one(project.id), project)
    queryClient.invalidateQueries({ queryKey: registryProjects.keys.lists })
    queryClient.invalidateQueries({ queryKey: overviewKey })
    // team members and links can only be added to a saved project: continue there
    navigate(`/projects/${project.id}?tab=team`)
  }

  return (
    <>
      <PageHeader title={t.createTitle} backTo={listTo} backLabel={t.title} />
      <ProjectForm onSubmit={onSubmit} saving={create.isPending} listTo={listTo} />
    </>
  )
}
