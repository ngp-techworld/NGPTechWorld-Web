import { useId, useState } from 'react'
import { ChevronDown, ShieldAlert } from 'lucide-react'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Badge, Button } from '@/ui'
import strings from './strings'

// Small pieces shared by the imports pages.

export const STATUSES = ['previewed', 'applied', 'failed', 'cancelled', 'expired']
const STATUS_TONES = { previewed: 'info', applied: 'success', failed: 'danger', cancelled: 'neutral', expired: 'warning' }
export const TIER_TONES = { public: 'success', internal: 'info', sensitive: 'danger' }

export function ImportStatusBadge({ status }) {
  const t = useStrings(strings)
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} dot>
      {t.statuses[status] ?? status}
    </Badge>
  )
}

/** The project a batch is about: the matched project, otherwise the name in the package. */
export function useBatchName() {
  const { pickField, pick } = useLanguage()
  return (batch) => (batch?.match?.project ? pickField(batch.match.project, 'name') : null) || (batch?.package?.name ? pick(batch.package.name) : null) || batch?.package?.slug || batch?.original_name || ''
}

/** "Turn on two-step sign-in to use imports", linking to the account page. */
export function ImportsMfaNotice({ className }) {
  const t = useStrings(strings)
  return (
    <Alert
      tone="warning"
      className={className}
      title={t.mfaRequired}
      action={
        <Button size="sm" variant="secondary" icon={ShieldAlert} to="/account#mfa">
          {t.mfaAction}
        </Button>
      }
    >
      {t.mfaRequiredHint}
    </Alert>
  )
}

/** 422 PackageProblem `{ message, code, problems: [{ code, file, pointer, message }] }`. Values are never in it. */
export function PackageProblem({ problem, className }) {
  const t = useStrings(strings)
  const problems = Array.isArray(problem?.problems) ? problem.problems : []
  const text = t.packageCodes[problem?.code] ?? problem?.message
  return (
    <Alert tone="danger" title={t.problemTitle} className={className}>
      <div className="space-y-2">
        <p>
          {text}
          {problem?.code ? (
            <bdi dir="ltr" className="ms-2 font-mono text-[12px] text-muted">
              {problem.code}
            </bdi>
          ) : null}
        </p>
        {problems.length ? (
          <div>
            <p className="text-xs font-bold text-muted">{t.problemsList}</p>
            <ul className="mt-1 space-y-1" aria-label={t.problemsList}>
              {problems.map((item, index) => (
                <li key={index} className="rounded-lg bg-black/15 px-2.5 py-1.5 text-[13px]">
                  {item.file ? (
                    <bdi dir="ltr" className="font-mono text-[12px] text-ink" title={t.problemFile}>
                      {item.file}
                    </bdi>
                  ) : null}
                  {item.file && item.pointer ? <span className="text-faint"> · </span> : null}
                  {item.pointer ? (
                    <bdi dir="ltr" className="font-mono text-[12px] text-soft" title={t.problemPointer}>
                      {item.pointer}
                    </bdi>
                  ) : null}
                  {item.file || item.pointer ? <span className="text-faint"> · </span> : null}
                  <span dir="auto">{item.message || t.packageCodes[item.code] || item.code}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted">{t.noValuesNote}</p>
      </div>
    </Alert>
  )
}

/** A failed request of the wizard: the two-step gate, a package problem, an upload refusal or the usual text. */
export function RequestError({ error, className }) {
  const t = useStrings(strings)
  const c = useCommon()
  if (isMfaRequired(error)) return <ImportsMfaNotice className={className} />
  if (error?.status === 422 && error.data?.code) return <PackageProblem problem={error.data} className={className} />
  const fileErrors = error?.status === 422 ? error.errors?.file : null
  if (Array.isArray(fileErrors) && fileErrors.length) {
    return (
      <Alert tone="danger" title={t.fileRejected} className={className}>
        <ul className="list-inside list-disc">
          {fileErrors.map((message) => (
            <li key={message} dir="auto">
              {message}
            </li>
          ))}
        </ul>
      </Alert>
    )
  }
  if (error?.status === 413) return <Alert tone="danger" className={className}>{t.packageCodes.E_ZIP_TOO_LARGE}</Alert>
  return (
    <Alert tone="danger" className={className}>
      {errorText(error, c)}
    </Alert>
  )
}

/** A collapsible block: a button with `aria-expanded` and the content below it once open. */
export function Disclosure({ title, defaultOpen = false, className, buttonClassName, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={cx('flex w-full items-center gap-2 text-start', buttonClassName)}>
        <ChevronDown size={16} aria-hidden="true" className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        <span className="min-w-0 flex-1">{title}</span>
      </button>
      {open ? (
        <div id={id} className="mt-2">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** A labelled number of a summary. */
export function CountTile({ label, value, tone }) {
  const f = useFormat()
  return (
    <div className="rounded-xl border border-white/[.07] bg-white/[.03] px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx('mt-0.5 font-poppins text-xl font-bold tabular-nums', tone === 'danger' && value ? 'text-danger' : tone === 'success' && value ? 'text-success' : 'text-ink')}>{f.number(value ?? 0)}</dd>
    </div>
  )
}

/** A known warning code in the UI language, otherwise the server's text. */
export function useWarningText() {
  const t = useStrings(strings)
  return (warning) => (typeof warning === 'string' ? warning : t.warningCodes[warning?.code] ?? warning?.message ?? warning?.code ?? '')
}
