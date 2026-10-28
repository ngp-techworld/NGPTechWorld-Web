import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, FilePlus2, GitMerge, Info, PackagePlus, RefreshCw, XCircle } from 'lucide-react'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Badge, Button, Card, Modal, useConfirm, useToast } from '@/ui'
import { useApplyImport, useCancelImport, useRefreshImport } from './hooks'
import { FieldLabelsProvider, splitPath, useFieldLabels } from './labels'
import { CountTile, ImportsMfaNotice, useBatchName, useWarningText } from './parts'
import { SectionPanel } from './SectionPanel'
import strings from './strings'
import { ValueView } from './ValueView'

/** The order of the sections in the preview (contract "Section keys"); an unknown key goes last. */
export const SECTION_ORDER = [
  'project', 'modules', 'features', 'technologies', 'quality', 'administration', 'monitoring', 'verification', 'maintenance',
  'integrations', 'auth', 'accounts', 'secret_refs', 'environments', 'endpoints', 'servers', 'deployment', 'repositories',
  'commands', 'env_vars', 'data', 'databases', 'backups',
]
const COUNT_KEYS = ['new', 'changed', 'unchanged', 'skipped_empty', 'only_in_db', 'errors']

export const orderSections = (sections) => {
  const rank = (key) => {
    const index = SECTION_ORDER.indexOf(key)
    return index === -1 ? SECTION_ORDER.length : index
  }
  return [...(Array.isArray(sections) ? sections : [])].sort((a, b) => rank(a.key) - rank(b.key))
}

/**
 * The `decisions` body of apply: every changed field of the sections the caller may write, with the chosen value
 * (`keep` or `replace`). Read-only sections are left out: apply skips them.
 */
export function buildDecisions(sections, choiceOf) {
  return Object.fromEntries(
    sections
      .filter((section) => section.access !== 'read_only')
      .flatMap((section) => (section.changed ?? []).map((item) => [item.path, choiceOf(item)])),
  )
}

function MatchBanner({ batch }) {
  const t = useStrings(strings)
  const nameOf = useBatchName()
  const { match } = batch
  const name = nameOf(batch)
  if (match?.kind === 'new' || !match?.project) {
    return (
      <Alert tone="info" title={t.matchNew}>
        {t.matchNewHint(name)}
      </Alert>
    )
  }
  const action = (
    <Button size="sm" variant="secondary" icon={ArrowUpRight} to={`/projects/${match.project.id}`}>
      {t.openProject}
    </Button>
  )
  if (match.kind === 'slug') {
    return (
      <Alert tone="warning" title={t.matchSlug} action={action}>
        {t.matchSlugHint(name)}
      </Alert>
    )
  }
  return (
    <Alert tone="success" title={t.matchUid(name)} action={action}>
      {t.matchUidHint}
    </Alert>
  )
}

function PackageInfo({ batch }) {
  const t = useStrings(strings)
  const f = useFormat()
  const warningText = useWarningText()
  // the slug banner already says what W_MATCHED_BY_SLUG says
  const warnings = (batch.warnings ?? []).filter((warning) => !(batch.match?.kind === 'slug' && warning?.code === 'W_MATCHED_BY_SLUG'))
  const info = batch.info ?? {}
  const alternatives = Array.isArray(info.alternative_names) ? info.alternative_names : []
  const facts = [
    info.category_suggestion ? [t.categorySuggestion, <ValueView key="c" value={info.category_suggestion} />] : null,
    alternatives.length ? [t.alternativeNames, <ValueView key="a" value={alternatives} />] : null,
    batch.package?.generator ? [t.generator, <bdi key="g" dir="ltr" className="font-mono text-[12px]">{batch.package.generator}</bdi>] : null,
    batch.package?.generated_at ? [t.generatedAt, f.dateTime(batch.package.generated_at)] : null,
  ].filter(Boolean)

  return (
    <>
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
      {facts.length || batch.package?.has_operational === false ? (
        <div className="rounded-xl border border-white/[.07] bg-white/[.03] px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-soft">
            <Info size={15} aria-hidden="true" />
            {t.infoTitle}
          </p>
          {facts.length ? (
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {batch.package?.has_operational === false ? <p className="mt-2 text-muted">{t.noOperational}</p> : null}
        </div>
      ) : null}
    </>
  )
}

function ScreenshotList({ items }) {
  const t = useStrings(strings)
  const { pick } = useLanguage()
  return (
    <ul className="mt-1 space-y-1">
      {items.map((shot, index) => (
        <li key={`${shot.file}-${index}`} className="flex flex-wrap items-center gap-2 text-[13px]">
          <bdi dir="ltr" className="break-all font-mono text-[12px] text-soft">
            {shot.file}
          </bdi>
          <Badge tone={shot.public ? 'success' : 'neutral'}>{shot.public ? t.publicScreenshot : t.privateScreenshot}</Badge>
          {shot.title ? <span dir="auto" className="text-muted">{pick(shot.title)}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function Summary({ preview }) {
  const t = useStrings(strings)
  const { pick } = useLanguage()
  const counts = preview.counts ?? {}
  const technologies = preview.catalog_new?.technologies ?? []
  const industries = preview.catalog_new?.industries ?? []
  const shots = preview.screenshots ?? {}
  const added = shots.new ?? []
  const replaced = shots.replaced ?? []

  return (
    <Card title={t.summaryTitle} aria-label={t.summaryTitle}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {COUNT_KEYS.map((key) => (
          <CountTile key={key} label={t.counts[key]} value={counts[key]} tone={key === 'errors' ? 'danger' : key === 'new' ? 'success' : undefined} />
        ))}
      </dl>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-soft">
            <PackagePlus size={15} aria-hidden="true" />
            {t.catalogNewTitle}
          </h3>
          {technologies.length || industries.length ? (
            <dl className="mt-2 space-y-2 text-sm">
              {technologies.length ? (
                <div>
                  <dt className="text-xs text-muted">{t.catalogTechnologies}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {technologies.map((tech) => (
                      <Badge key={tech.name} tone="accent">
                        <bdi dir="ltr">{tech.name}</bdi>
                        {tech.category ? <span className="font-normal opacity-75">· {tech.category}</span> : null}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}
              {industries.length ? (
                <div>
                  <dt className="text-xs text-muted">{t.catalogIndustries}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {industries.map((industry, index) => (
                      <Badge key={`${industry.name_en}-${index}`} tone="gold">
                        {pick(industry.name_ar, industry.name_en)}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-faint">{t.empty}</p>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-soft">
            <FilePlus2 size={15} aria-hidden="true" />
            {t.screenshotsTitle}
          </h3>
          <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-soft">
            <span>{t.screenshotsNew(added.length)}</span>
            <span>{t.screenshotsReplaced(replaced.length)}</span>
            <span>{t.screenshotsUnchanged(shots.unchanged ?? 0)}</span>
          </p>
          {added.length ? <ScreenshotList items={added} /> : null}
          {replaced.length ? <ScreenshotList items={replaced} /> : null}
        </div>
      </div>
    </Card>
  )
}

function ApplyDialog({ open, onClose, onConfirm, loading, batch, sections, choiceOf }) {
  const t = useStrings(strings)
  const c = useCommon()
  const nameOf = useBatchName()
  const writable = sections.filter((section) => section.access !== 'read_only')
  const changed = writable.flatMap((section) => section.changed ?? [])
  const replaceCount = changed.filter((item) => choiceOf(item) === 'replace').length
  const created = writable.reduce((sum, section) => sum + (section.new?.length ?? 0), 0)
  const shots = batch.preview?.screenshots ?? {}
  const catalog = (batch.preview?.catalog_new?.technologies?.length ?? 0) + (batch.preview?.catalog_new?.industries?.length ?? 0)
  const skipped = sections.filter((section) => section.access === 'read_only').map((section) => t.sections[section.key] ?? section.key)
  const name = nameOf(batch)
  const lines = [
    t.confirmCreate(created),
    t.confirmReplace(replaceCount),
    t.confirmKeep(changed.length - replaceCount),
    shots.new?.length || shots.replaced?.length ? t.confirmScreenshots(shots.new?.length ?? 0, shots.replaced?.length ?? 0) : null,
    catalog ? t.confirmCatalog(catalog) : null,
    skipped.length ? t.confirmSkipped(skipped.join(t.listSeparator)) : null,
  ].filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={t.confirmTitle}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {c.cancel}
          </Button>
          <Button icon={CheckCircle2} onClick={onConfirm} loading={loading}>
            {t.apply}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pb-1 text-sm text-soft">
        <p>{batch.match?.kind === 'new' || !batch.match?.project ? t.confirmNewProject(name) : t.confirmIntro(name)}</p>
        <ul className="list-inside list-disc space-y-1">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t.confirmNothingDeleted}</p>
      </div>
    </Modal>
  )
}

function AllErrors({ sections }) {
  const t = useStrings(strings)
  const { fieldLabel, refLabel } = useFieldLabels()
  const errors = sections.flatMap((section) => (section.errors ?? []).map((error) => ({ section, error })))
  if (!errors.length) return null
  return (
    <ul className="mt-1 list-inside list-disc space-y-0.5">
      {errors.map(({ section, error }, index) => {
        const { ref, field } = splitPath(error.path, section.key)
        return (
          <li key={`${error.path}-${index}`}>
            {[t.sections[section.key] ?? section.key, refLabel(section.key, ref), fieldLabel(section.key, field)].filter(Boolean).join(' · ')}
            {' — '}
            <span dir="auto">{t.errorCodes[error.code] ?? error.message ?? error.code}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A `previewed` batch: who it matches, its warnings, the summary, one panel per section with a keep / replace choice
 * per changed field, then Apply (a confirm dialog with the summary) or Cancel. A 409 `stale_preview` offers Refresh.
 */
export function PreviewView({ batch, onReload }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const apply = useApplyImport(batch.id)
  const refresh = useRefreshImport(batch.id)
  const cancel = useCancelImport(batch.id)
  const [overrides, setOverrides] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState(null) // { kind: 'stale' | 'blocking' | 'decisions' | 'mfa' | 'error', … }
  const [notice, setNotice] = useState(null)
  const preview = batch.preview ?? {}
  const sections = useMemo(() => orderSections(preview.sections), [preview.sections])
  const blocking = Boolean(preview.blocking)
  const abilities = batch.abilities ?? {}

  const choiceOf = (item) => overrides[item.path] ?? (item.default === 'keep' ? 'keep' : 'replace')
  const choose = (path, value) => setOverrides((current) => ({ ...current, [path]: value }))
  const chooseAll = (section, value) => setOverrides((current) => ({ ...current, ...Object.fromEntries((section.changed ?? []).map((item) => [item.path, value])) }))

  const failed = (err) => {
    if (isMfaRequired(err)) setProblem({ kind: 'mfa' })
    else setProblem({ kind: 'error', error: err })
  }

  const onApply = async () => {
    setProblem(null)
    setNotice(null)
    try {
      await apply.mutateAsync(buildDecisions(sections, choiceOf))
      setConfirming(false)
      toast.success(t.applied)
    } catch (err) {
      setConfirming(false)
      const code = err?.data?.code
      if (err?.status === 409 && code === 'stale_preview') setProblem({ kind: 'stale' })
      else if (err?.status === 409 && code === 'not_previewed') {
        toast.info(t.notPreviewed)
        onReload?.()
      } else if (err?.status === 422 && code === 'blocking_errors') setProblem({ kind: 'blocking', message: err.message })
      else if (err?.status === 422 && Array.isArray(err.errors?.decisions)) setProblem({ kind: 'decisions', messages: err.errors.decisions })
      else failed(err)
    }
  }

  const onRefresh = async () => {
    try {
      await refresh.mutateAsync()
      setOverrides({}) // the current values may have changed: back to the server's defaults
      setProblem(null)
      setNotice('refreshed')
    } catch (err) {
      if (err?.status === 409) {
        toast.info(t.notPreviewed)
        onReload?.()
      } else failed(err)
    }
  }

  const onCancel = async () => {
    const yes = await confirm({ title: t.cancelTitle, message: t.cancelMessage, confirmLabel: t.cancelConfirm, cancelLabel: t.keepImport, tone: 'danger' })
    if (!yes) return
    try {
      await cancel.mutateAsync()
      toast.success(t.cancelled)
      navigate('/imports')
    } catch (err) {
      if (err?.status === 409) {
        toast.info(t.notPreviewed)
        onReload?.()
      } else toast.error(errorText(err, c))
    }
  }

  return (
    <FieldLabelsProvider>
      <div className="space-y-5">
        <MatchBanner batch={batch} />
        <PackageInfo batch={batch} />
        <Summary preview={preview} />

        {blocking ? (
          <Alert tone="danger" title={t.blockingTitle}>
            {t.blockingHint}
          </Alert>
        ) : null}

        <section aria-label={t.sectionsTitle} className="space-y-3">
          <h2 className="text-base font-bold text-ink">{t.sectionsTitle}</h2>
          {sections.map((section) => (
            <SectionPanel key={section.key} section={section} choiceOf={choiceOf} onChoose={choose} onChooseAll={chooseAll} />
          ))}
        </section>

        <div className="space-y-3">
          {notice === 'refreshed' ? <Alert tone="info">{t.refreshed}</Alert> : null}
          {problem?.kind === 'stale' ? (
            <Alert
              tone="warning"
              title={t.staleTitle}
              action={
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRefresh} loading={refresh.isPending}>
                  {t.refresh}
                </Button>
              }
            >
              {t.staleHint}
            </Alert>
          ) : null}
          {problem?.kind === 'blocking' ? (
            <Alert tone="danger" title={t.blockingErrorsTitle}>
              <p>{t.blockingHint}</p>
              <AllErrors sections={sections} />
            </Alert>
          ) : null}
          {problem?.kind === 'decisions' ? (
            <Alert tone="danger" title={t.decisionsRejected}>
              <ul className="list-inside list-disc">
                {problem.messages.map((message) => (
                  <li key={message} dir="auto">
                    {message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {problem?.kind === 'mfa' ? <ImportsMfaNotice /> : null}
          {problem?.kind === 'error' ? <Alert tone="danger">{errorText(problem.error, c)}</Alert> : null}

          {abilities.apply || abilities.cancel ? (
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-white/[.08] bg-surface/95 px-3 py-3 backdrop-blur">
              {abilities.cancel ? (
                <Button variant="ghost" icon={XCircle} onClick={onCancel} disabled={cancel.isPending || apply.isPending}>
                  {t.cancelImport}
                </Button>
              ) : null}
              {abilities.apply ? (
                <Button icon={GitMerge} onClick={() => setConfirming(true)} disabled={blocking || problem?.kind === 'stale' || apply.isPending}>
                  {t.apply}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <ApplyDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={onApply} loading={apply.isPending} batch={batch} sections={sections} choiceOf={choiceOf} />
    </FieldLabelsProvider>
  )
}
