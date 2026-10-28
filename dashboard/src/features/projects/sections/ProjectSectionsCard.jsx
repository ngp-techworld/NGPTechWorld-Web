import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/AuthProvider'
import { canAccessFeature } from '@/app/permissions'
import { useStrings } from '@/i18n'
import { api } from '@/lib/api'
import { projects } from '../hooks'
import { SectionLayoutEditor } from './SectionLayoutEditor'
import strings from './strings'

/**
 * The project's own section order (`section_layout`, saved alone with `PUT /projects/{id}`; null = follow the site
 * default). The site default comes from the site settings when this account may read them; otherwise the usual
 * order is shown, with a note that the settings may differ.
 */
export function ProjectSectionsCard({ project, canWrite }) {
  const t = useStrings(strings)
  const { user } = useAuth()
  const canReadSettings = canAccessFeature({ id: 'settings' }, user)
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => api.get('/settings', undefined, { signal }).then((res) => res.data),
    enabled: canReadSettings,
    retry: false,
  })
  const update = projects.useUpdate({ successMessage: t.saved })
  const known = canReadSettings && settings.isSuccess

  return (
    <SectionLayoutEditor
      title={t.projectTitle}
      description={t.projectDescription}
      field="section_layout"
      value={project.section_layout ?? null}
      defaultLayout={known ? (settings.data.portfolio_sections ?? null) : null}
      defaultHint={known ? t.useDefaultProjectHint : t.defaultUnknown}
      onSave={(layout) => update.mutateAsync({ id: project.id, data: { section_layout: layout } })}
      canWrite={canWrite}
      saving={update.isPending}
    />
  )
}
