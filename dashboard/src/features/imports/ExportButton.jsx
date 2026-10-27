import { useState } from 'react'
import { Download } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Button, useToast } from '@/ui'
import { downloadProjectPackage } from './hooks'
import strings from './strings'

/**
 * "Export the package" on the project page: `GET registry/projects/{id}/export`, downloaded with the bearer token and
 * saved as `<slug>-ngp-portfolio.zip`. Re-importing that ZIP shows "unchanged" everywhere.
 */
export function ExportPackageButton({ project, size = 'md', variant = 'secondary', className }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    setBusy(true)
    try {
      await downloadProjectPackage(project)
      toast.success(t.exportDone)
    } catch (err) {
      toast.error(errorText(err, c))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={variant} icon={Download} loading={busy} onClick={onClick} className={className}>
      {busy ? t.exporting : t.export}
    </Button>
  )
}

export default ExportPackageButton
