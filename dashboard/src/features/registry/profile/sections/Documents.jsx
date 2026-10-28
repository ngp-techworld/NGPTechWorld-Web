import { Download, FileStack } from 'lucide-react'
import { api, saveBlob } from '@/lib/api'
import { Button, useToast } from '@/ui'
import { apiPathOf } from '../../kit'
import { useProfileEnv } from '../env'
import { Code, EnumBadge, Part, ProfileSection } from '../parts'

/** The project's private documents, each downloaded with the bearer token (the stream refuses anyone else). */
export function DocumentsSection({ data }) {
  const { p, t, r, f } = useProfileEnv()
  const toast = useToast()
  const download = async (row) => {
    try {
      const { blob, filename } = await api.download(apiPathOf(row.download_url) ?? `/registry/files/documents/${row.id}`)
      saveBlob(blob, filename || row.original_name || row.title)
    } catch {
      toast.error(t.downloadFailed)
    }
  }
  return (
    <ProfileSection id="documents" tier="internal" icon={FileStack} title={p.sections.documents}>
      <Part query={data.documents} label={t.documentsTitle}>
        {(rows) =>
          rows.length ? (
            <ul className="divide-y divide-white/[.06] rounded-xl border border-white/[.07]">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span dir="auto" className="text-sm font-semibold text-ink">
                        {row.title}
                      </span>
                      <EnumBadge value={row.type} labels={r.documentTypes} />
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {row.original_name ? <Code value={row.original_name} className="text-xs" /> : null}
                      {row.size ? <span>{f.bytes(row.size)}</span> : null}
                      {row.created_at ? <span>{`${t.uploadedAt}: ${f.date(row.created_at)}`}</span> : null}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" icon={Download} onClick={() => download(row)} aria-label={t.downloadOf(row.title)} data-print-hide="">
                    {t.download}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null
        }
      </Part>
    </ProfileSection>
  )
}
