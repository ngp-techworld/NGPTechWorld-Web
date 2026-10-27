import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, CheckCircle2, CircleAlert, Eye, EyeOff, Star, StarOff, Trash2 } from 'lucide-react'
import { COMPLETENESS_GROUPS, actionErrorText, publicationLabels, useProjectAction } from '@/features/registry/kit'
import { cx } from '@/lib/cx'
import { Alert, Badge, Button, Card, useConfirm, useToast } from '@/ui'
import { DeleteProjectDialog } from '../DeleteProjectDialog'
import { useRegistryEnv } from './useRegistryEnv'

function MissingList({ keys, labels }) {
  return (
    <ul className="mt-1 list-inside list-disc space-y-0.5">
      {keys.map((key) => (
        <li key={key}>{labels[key] ?? key}</li>
      ))}
    </ul>
  )
}

function Completeness({ completeness }) {
  const { t, r } = useRegistryEnv()
  const score = completeness?.score ?? 0
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-soft">{t.completenessTitle}</span>
          <span className="font-poppins font-bold tabular-nums text-ink">{t.completenessScore(score)}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[.08]" role="progressbar" aria-label={t.completenessTitle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
          <div className={cx('h-full rounded-full', score >= 80 ? 'bg-success' : score >= 50 ? 'bg-gold' : 'bg-warning')} style={{ width: `${score}%` }} />
        </div>
      </div>
      <ul className="space-y-2">
        {COMPLETENESS_GROUPS.map((group) => {
          const entry = completeness?.[group]
          if (!entry) return null
          return (
            <li key={group} className="text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink">
                {entry.complete ? <CheckCircle2 size={15} aria-hidden="true" className="text-success" /> : <CircleAlert size={15} aria-hidden="true" className="text-warning" />}
                {r.completenessGroups[group]}
                <span className="text-xs font-normal text-muted">{entry.complete ? t.completeGroup : t.missingCount(entry.missing.length)}</span>
              </p>
              {!entry.complete ? (
                <div className="ps-6 text-xs text-muted">
                  <MissingList keys={entry.missing} labels={r.completenessChecks} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Publication of a project: its status (draft / published, featured, archived), what it still needs to be published
 * (`publication`, when the API sends it) and its completeness, plus the actions the caller may take — publish /
 * unpublish and feature / unfeature (`publish`), archive / restore, and delete for super admins. A refused publish
 * (422 `errors.publication`) is listed in words.
 */
export function PublicationCard({ registry }) {
  const { t, r, c, f } = useRegistryEnv()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const action = useProjectAction(registry.id)
  const [refused, setRefused] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { abilities, publication } = registry
  const published = registry.publication_status === 'published'
  const archived = Boolean(registry.archived_at)

  const run = async (name, success, question) => {
    if (question && !(await confirm({ ...question, tone: 'primary' }))) return
    setRefused(null)
    try {
      await action.mutateAsync(name)
      toast.success(success)
    } catch (err) {
      if (err.status === 422 && Array.isArray(err.errors?.publication)) setRefused(err.errors.publication)
      else toast.error(actionErrorText(err, r, c))
    }
  }
  const busy = action.isPending
  const missing = publication && !publication.ready ? publication.missing ?? [] : []

  return (
    <Card title={t.publicationTitle} description={t.publicationDescription} aria-label={t.publicationTitle}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={published ? 'success' : 'neutral'} dot>
            <span className="sr-only">{t.statusLabel}: </span>
            {r.publicationStatuses[registry.publication_status] ?? registry.publication_status}
          </Badge>
          {registry.featured ? (
            <Badge tone="gold">
              <Star size={11} aria-hidden="true" />
              {t.featuredBadge}
            </Badge>
          ) : null}
          {archived ? <Badge tone="warning">{t.archivedBadge}</Badge> : null}
          <span className="text-xs text-muted">
            {archived ? t.archivedOn(f.date(registry.archived_at)) : published && registry.published_at ? t.publishedOn(f.date(registry.published_at)) : null}
          </span>
        </div>

        {refused ? (
          <Alert tone="danger" title={t.publishFailed}>
            <MissingList keys={refused} labels={r.publicationMissing} />
          </Alert>
        ) : published && missing.length ? (
          <Alert tone="warning" title={t.publishedNotReady}>
            <MissingList keys={missing} labels={r.publicationMissing} />
          </Alert>
        ) : !published && !archived && missing.length ? (
          <Alert tone="info" title={t.missingForPublication}>
            <MissingList keys={missing} labels={r.publicationMissing} />
          </Alert>
        ) : !published && !archived && publication?.ready ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 size={15} aria-hidden="true" />
            {t.readyToPublish}
          </p>
        ) : null}

        {abilities.publish || abilities.archive || abilities.restore || abilities.delete ? (
          <div className="flex flex-wrap gap-2">
            {abilities.publish && !archived ? (
              published ? (
                <Button size="sm" variant="secondary" icon={EyeOff} disabled={busy} onClick={() => run('unpublish', t.unpublished, { title: t.unpublishTitle, message: t.unpublishMessage, confirmLabel: t.unpublish })}>
                  {t.unpublish}
                </Button>
              ) : (
                <Button size="sm" icon={Eye} disabled={busy} onClick={() => run('publish', t.published)}>
                  {t.publish}
                </Button>
              )
            ) : null}
            {abilities.publish && !archived ? (
              registry.featured ? (
                <Button size="sm" variant="secondary" icon={StarOff} disabled={busy} onClick={() => run('unfeature', t.unfeatured)}>
                  {t.unfeature}
                </Button>
              ) : (
                <Button size="sm" variant="gold" icon={Star} disabled={busy} onClick={() => run('feature', t.featured)}>
                  {t.feature}
                </Button>
              )
            ) : null}
            {abilities.archive && !archived ? (
              <Button size="sm" variant="ghost" icon={Archive} disabled={busy} onClick={() => run('archive', t.archived, { title: t.archiveTitle, message: t.archiveMessage, confirmLabel: t.archive })}>
                {t.archive}
              </Button>
            ) : null}
            {abilities.restore && archived ? (
              <Button size="sm" variant="secondary" icon={ArchiveRestore} disabled={busy} onClick={() => run('restore', t.restored)}>
                {t.restore}
              </Button>
            ) : null}
            {abilities.delete ? (
              <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => setDeleting(true)} className="ms-auto">
                {t.deleteProject}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-white/[.07] pt-4">
          <Completeness completeness={registry.completeness} />
        </div>
      </div>
      {abilities.delete ? (
        <DeleteProjectDialog project={deleting ? registry : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/registry/projects', { replace: true })} />
      ) : null}
    </Card>
  )
}
