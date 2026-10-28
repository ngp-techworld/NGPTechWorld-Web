import { Images } from 'lucide-react'
import { registryPath } from '@/features/registry/kit'
import { useCrudHooks } from '@/lib/crud'
import { Alert, Button } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const COUNT_ONLY = { per_page: 1, page: 1, sort: 'order', dir: 'asc' }

/**
 * Shown on the Media tab when the project has registry screenshots but an empty original cover or gallery (an
 * imported project keeps its pictures as screenshots): the public page takes its images from the Screenshots tab, and
 * its cover falls back to the screenshot marked as the cover, so nothing needs uploading here again.
 */
export function MediaScreenshotsNote({ registryId, project, onOpen }) {
  const { t } = useRegistryEnv()
  const hooks = useCrudHooks(`${registryPath(registryId)}/screenshots`)
  const emptyMedia = !project.cover_image || !(project.gallery?.length > 0)
  const list = hooks.useList(COUNT_ONLY, { enabled: emptyMedia })
  if (!emptyMedia || !(list.meta?.total > 0)) return null

  return (
    <Alert
      tone="info"
      title={t.mediaScreenshotsTitle}
      action={
        <Button size="sm" variant="secondary" icon={Images} onClick={onOpen}>
          {t.openScreenshots}
        </Button>
      }
    >
      {t.mediaScreenshotsNote}
    </Alert>
  )
}
