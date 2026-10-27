import { ArrowUpRight, CircleSlash, Clock, Plus, XCircle } from 'lucide-react'
import { publicationLabels, registryStrings } from '@/features/registry/kit'
import { useFormat, useLanguage, useStrings } from '@/i18n'
import { Alert, Badge, Button, Card } from '@/ui'
import { CountTile, useWarningText } from './parts'
import strings from './strings'

const REPORT_COUNTS = ['created', 'updated', 'unchanged', 'skipped_empty', 'only_in_db', 'kept_by_user']

function NamesFromPreview({ items, render }) {
  if (!items?.length) return null
  return <div className="mt-2 flex flex-wrap gap-1.5">{items.map(render)}</div>
}

/**
 * An `applied` batch: the counts of `report`, the files and catalog entries created, the sections it skipped, its
 * warnings and the publication re-check (what a published project now lacks), with a link to the project.
 */
export function ReportView({ batch }) {
  const t = useStrings(strings)
  const r = useStrings(registryStrings)
  const f = useFormat()
  const { pick } = useLanguage()
  const warningText = useWarningText()
  const report = batch.report ?? {}
  const files = report.files ?? {}
  const catalog = report.catalog_created ?? {}
  const skipped = Array.isArray(report.sections_skipped) ? report.sections_skipped : []
  const warnings = Array.isArray(report.warnings) ? report.warnings : []
  const publication = report.publication
  const missing = publication && !publication.ready ? publicationLabels(publication.missing, r) : []
  const published = batch.match?.project?.publication_status === 'published'
  const projectId = report.project?.id ?? batch.match?.project?.id
  // the preview is kept after apply for the history: it names what the counts count
  const catalogNew = batch.preview?.catalog_new ?? {}
  const shots = batch.preview?.screenshots ?? {}

  return (
    <div className="space-y-5">
      <Card
        title={t.reportTitle}
        description={batch.applied_at ? t.appliedOn(f.dateTime(batch.applied_at), batch.user?.name ?? '—') : undefined}
        aria-label={t.reportTitle}
        actions={
          projectId ? (
            <Button icon={ArrowUpRight} to={`/projects/${projectId}`}>
              {t.goToProject}
            </Button>
          ) : null
        }
      >
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {REPORT_COUNTS.map((key) => (
            <CountTile key={key} label={t.reportCounts[key]} value={report[key]} tone={key === 'created' ? 'success' : undefined} />
          ))}
        </dl>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div aria-label={t.filesTitle} role="group">
            <h3 className="text-sm font-bold text-soft">{t.filesTitle}</h3>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <CountTile label={t.filesStored} value={files.stored} tone="success" />
              <CountTile label={t.filesSkipped} value={files.skipped} />
              <CountTile label={t.filesRejected} value={files.rejected} tone="danger" />
            </dl>
            <NamesFromPreview
              items={[...(shots.new ?? []), ...(shots.replaced ?? [])]}
              render={(shot, index) => (
                <bdi key={`${shot.file}-${index}`} dir="ltr" className="rounded-md bg-white/[.05] px-2 py-0.5 font-mono text-[11px] text-soft">
                  {shot.file}
                </bdi>
              )}
            />
          </div>
          <div aria-label={t.catalogCreatedTitle} role="group">
            <h3 className="text-sm font-bold text-soft">{t.catalogCreatedTitle}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <CountTile label={t.catalogTechnologies} value={catalog.technologies} />
              <CountTile label={t.catalogIndustries} value={catalog.industries} />
            </dl>
            <NamesFromPreview
              items={[...(catalogNew.technologies ?? []).map((tech) => tech.name), ...(catalogNew.industries ?? []).map((industry) => pick(industry.name_ar, industry.name_en))]}
              render={(name, index) => (
                <Badge key={`${name}-${index}`} tone="accent">
                  <bdi>{name}</bdi>
                </Badge>
              )}
            />
          </div>
        </div>
      </Card>

      {missing.length ? (
        <Alert tone="warning" title={published ? t.publicationNotReady : t.publicationMissing}>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {missing.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </Alert>
      ) : publication?.ready ? (
        <Alert tone="success">{t.publicationReady}</Alert>
      ) : null}

      {skipped.length ? (
        <Alert tone="info" title={t.sectionsSkippedTitle}>
          <ul className="flex flex-wrap gap-1.5">
            {skipped.map((key) => (
              <li key={key}>
                <Badge tone="neutral">{t.sections[key] ?? key}</Badge>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {warnings.length ? (
        <Alert tone="warning" title={t.warningsTitle}>
          <ul className="list-inside list-disc space-y-0.5">
            {warnings.map((warning, index) => (
              <li key={`${warning?.code ?? ''}-${index}`} dir="auto">
                {warningText(warning)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  )
}

const errorLine = (error) => (typeof error === 'string' ? error : [error?.path, error?.message ?? error?.code].filter(Boolean).join(' — '))

/** `failed`, `cancelled` and `expired`: what happened, and a way to start again. */
export function ClosedView({ batch }) {
  const t = useStrings(strings)
  const states = {
    failed: { icon: XCircle, tone: 'text-danger', title: t.failedTitle, hint: t.failedHint },
    cancelled: { icon: CircleSlash, tone: 'text-muted', title: t.cancelledTitle, hint: t.cancelledHint },
    expired: { icon: Clock, tone: 'text-warning', title: t.expiredTitle, hint: t.expiredHint },
  }
  const state = states[batch.status] ?? states.failed
  const Icon = state.icon
  const errors = batch.status === 'failed' && Array.isArray(batch.report?.errors) ? batch.report.errors : []
  return (
    <Card aria-label={state.title}>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Icon size={36} aria-hidden="true" className={state.tone} />
        <h2 className="text-lg font-bold text-ink">{state.title}</h2>
        <p className="max-w-xl text-sm text-muted">{state.hint}</p>
        {errors.length ? (
          <Alert tone="danger" className="w-full max-w-2xl text-start">
            <ul className="list-inside list-disc space-y-0.5">
              {errors.map((error, index) => (
                <li key={index} dir="auto">
                  {errorLine(error)}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <Button icon={Plus} to="/imports">
          {t.anotherImport}
        </Button>
      </div>
    </Card>
  )
}
