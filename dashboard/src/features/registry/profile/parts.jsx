import { createContext, useContext, useId, useMemo } from 'react'
import { Building2, Check, Copy, ExternalLink as ExternalIcon, Globe2, ShieldAlert } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Badge, Button, IconButton, Skeleton, useToast } from '@/ui'
import { registryStrings } from '../kit'
import strings from './strings'

// The building blocks of the profile: section cards with their tier, the page search, facts lists, copy buttons,
// safe external links and the per-collection loading / error states.

// ───────────────────────────────────────────── page search

const SearchContext = createContext('')
export const SearchProvider = SearchContext.Provider

const normalize = (value) => String(value ?? '').toLocaleLowerCase()

/** The page search: `query` as typed and `matches(...values)` (strings, numbers or arrays of them). */
export function useProfileSearch() {
  const query = useContext(SearchContext)
  return useMemo(() => {
    const needle = normalize(query).trim()
    const matches = (...values) => !needle || values.flat(2).some((value) => value !== null && value !== undefined && normalize(value).includes(needle))
    return { query: needle, active: Boolean(needle), matches }
  }, [query])
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `text` with the page search marked (<mark>). */
export function Highlight({ text }) {
  const { query } = useProfileSearch()
  if (text === null || text === undefined || text === '') return null
  const value = String(text)
  if (!query) return value
  const parts = value.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  if (parts.length === 1) return value
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-gold/30 px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/** How many rows of a filtered list match, announced while a search is typed. */
export function SearchCount({ shown }) {
  const p = useStrings(strings)
  const { active } = useProfileSearch()
  if (!active) return null
  return (
    <p role="status" className="text-xs font-semibold text-gold">
      {p.searchResults(shown)}
    </p>
  )
}

// ───────────────────────────────────────────── tiers & sections

const TIER = {
  public: { icon: Globe2, tone: 'info', spine: 'border-s-info/50' },
  internal: { icon: Building2, tone: 'accent', spine: 'border-s-accent-light/70' },
  sensitive: { icon: ShieldAlert, tone: 'danger', spine: 'border-s-danger/60' },
}

/** عام / داخلي / حساس, with who may read it as its tooltip. */
export function TierBadge({ tier, className }) {
  const p = useStrings(strings)
  const { icon: Icon, tone } = TIER[tier]
  return (
    <span title={p.tierHints[tier]} className={cx('inline-flex', className)}>
      <Badge tone={tone}>
        <Icon size={12} aria-hidden="true" />
        {p.tiers[tier]}
        <span className="sr-only">: {p.tierHints[tier]}</span>
      </Badge>
    </span>
  )
}

export const sectionId = (key) => `profile-${key}`

/**
 * One card of the dossier: an anchor for the table of contents, a heading with the tier badge, a coloured edge on
 * the start side that says the tier at a glance, and its body. Cards do not split across printed pages.
 */
export function ProfileSection({ id, tier, title, icon: Icon, meta, children }) {
  const headingId = useId()
  return (
    <section
      id={sectionId(id)}
      aria-labelledby={headingId}
      tabIndex={-1}
      data-tier={tier}
      data-profile-card=""
      className={cx('scroll-mt-24 lg:scroll-mt-40 rounded-card border border-s-[3px] border-white/[.08] bg-white/[.03] shadow-card focus:outline-none', TIER[tier].spine)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[.07] px-5 py-4">
        {Icon ? (
          <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent-lighter">
            <Icon size={18} />
          </span>
        ) : null}
        <h2 id={headingId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        <TierBadge tier={tier} />
        {meta ? <div className="ms-auto flex flex-wrap items-center gap-2 text-xs text-muted">{meta}</div> : null}
      </header>
      <div className="space-y-7 p-5">{children}</div>
    </section>
  )
}

/** A titled block inside a section. */
export function SubSection({ title, count, actions, children, className }) {
  return (
    <div className={cx('min-w-0 space-y-3', className)} data-profile-block="">
      {title ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-[15px] font-bold text-soft">
            {title}
            {count !== undefined && count !== null ? <span className="ms-2 text-xs font-semibold tabular-nums text-faint">{count}</span> : null}
          </h3>
          {actions ? <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

// ───────────────────────────────────────────── values

const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

/**
 * Label / value pairs (`items = [{ label, value, wide? }]`); empty values are left out, and nothing renders when
 * all of them are. A string value keeps its line breaks and finds its own direction.
 */
export function Facts({ items, className }) {
  const shown = items.filter((item) => item && !isEmpty(item.value) && item.value !== false)
  if (!shown.length) return null
  return (
    <dl className={cx('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {shown.map((item) => (
        <div key={item.label} className={cx('min-w-0', item.wide && 'sm:col-span-2')}>
          <dt className="text-xs font-semibold text-muted">{item.label}</dt>
          <dd className="mt-1 text-sm text-ink">{typeof item.value === 'string' ? <Prose text={item.value} /> : item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Free text from the API: its own direction, its line breaks kept. */
export function Prose({ text, className }) {
  if (isEmpty(text)) return null
  return (
    <span dir="auto" className={cx('block whitespace-pre-line break-words', className)}>
      {text}
    </span>
  )
}

/** A Latin-only value (path, hostname, command, env var name) inside any text direction. */
export function Code({ value, className }) {
  if (isEmpty(value)) return null
  return (
    <bdi dir="ltr" className={cx('break-all font-mono text-[12.5px] text-soft', className)}>
      <Highlight text={value} />
    </bdi>
  )
}

/** A list of short values as chips (env var names, config files, tables). */
export function Chips({ values, mono = false }) {
  if (!Array.isArray(values) || !values.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <li key={value} className={cx('rounded-lg bg-white/[.06] px-2 py-0.5 text-xs text-soft', mono && 'font-mono')}>
          {mono ? (
            <bdi dir="ltr">
              <Highlight text={value} />
            </bdi>
          ) : (
            <span dir="auto">{value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** A bulleted list of free-text items. */
export function Bullets({ items, mono = false, ordered = false }) {
  if (!Array.isArray(items) || !items.length) return null
  const List = ordered ? 'ol' : 'ul'
  return (
    <List className={cx('space-y-1 ps-5 text-sm text-soft', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, index) => (
        <li key={`${index}-${item}`} dir={mono ? 'ltr' : 'auto'} className={cx('break-words', mono && 'text-start font-mono text-[12.5px]')}>
          {item}
        </li>
      ))}
    </List>
  )
}

/** A value of a registry value list as a badge (`labels` from the kit strings, `tones` from the collection configs). */
export function EnumBadge({ value, labels, tones, className }) {
  if (isEmpty(value)) return null
  return (
    <Badge tone={tones?.[value] ?? 'neutral'} className={className}>
      {labels?.[value] ?? value}
    </Badge>
  )
}

/** Yes / no as a word (null stays empty). */
export function YesNo({ value }) {
  const r = useStrings(registryStrings)
  if (value === null || value === undefined) return null
  return <span>{value ? r.yes : r.no}</span>
}

// ───────────────────────────────────────────── links & copy

/** Only web addresses become links (a stored value is never given a script or data URL). */
export const isWebUrl = (value) => typeof value === 'string' && /^https?:\/\/[^\s]+$/i.test(value.trim())

/** An external link that opens in a new tab without giving it this page (`noopener noreferrer`). */
export function ExternalLink({ href, children, className, showIcon = true }) {
  const p = useStrings(strings)
  if (!isWebUrl(href)) return <span className={className}>{children ?? <Code value={href} />}</span>
  return (
    <a
      href={href.trim()}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('inline-flex min-w-0 items-center gap-1 rounded-md text-accent-lighter underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light', className)}
    >
      {children ?? <Code value={href} className="text-inherit" />}
      {showIcon ? <ExternalIcon size={13} aria-hidden="true" className="shrink-0 opacity-70" /> : null}
      <span className="sr-only"> {p.newTab}</span>
    </a>
  )
}

/** Copies `value` to the clipboard and says so in a toast. */
export function useCopy() {
  const toast = useToast()
  const p = useStrings(strings)
  return async (value, message) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(value)
      toast.success(message)
      return true
    } catch {
      toast.error(p.copyFailed)
      return false
    }
  }
}

/** An icon button that copies `value` (a vault reference, a command). */
export function CopyButton({ value, label, message, className }) {
  const copy = useCopy()
  if (isEmpty(value)) return null
  return <IconButton size="sm" icon={Copy} label={label} onClick={() => copy(value, message)} className={cx('print:hidden', className)} data-print-hide="" />
}

/** A `vault://` reference with its copy button: where a password lives, never the password. */
export function VaultRef({ value }) {
  const p = useStrings(strings)
  if (isEmpty(value)) return <span className="text-xs text-faint">{p.noVaultRef}</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1" data-vault-ref="">
      <Code value={value} className="text-gold-light" />
      <CopyButton value={value} label={p.copyRef(value)} message={p.refCopied} />
    </span>
  )
}

/** A check mark for a done item, used by the vault checklist. */
export function DoneMark({ done }) {
  return done ? (
    <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
      <Check size={13} />
    </span>
  ) : (
    <span aria-hidden="true" className="inline-flex size-5 shrink-0 rounded-full border-2 border-warning/70" />
  )
}

// ───────────────────────────────────────────── loading & errors

/** Skeleton lines while a collection loads. */
export function PartSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2.5" aria-hidden="true" data-profile-skeleton="">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cx('h-4', index % 3 === 0 ? 'w-2/3' : index % 3 === 1 ? 'w-full' : 'w-5/6')} />
      ))}
    </div>
  )
}

/**
 * One collection inside a section: skeleton while it loads, a small error with Retry when it failed (the rest of the
 * page keeps working), else `children(rows)`. The two-step sign-in gate gets its own text and no Retry: the page
 * shows the notice that leads to the account page.
 */
export function Part({ query, label, lines = 3, children }) {
  const p = useStrings(strings)
  const c = useCommon()
  if (!query?.enabled) return null
  if (query.isLoading) return <PartSkeleton lines={lines} />
  if (query.isError) {
    const mfa = isMfaRequired(query.error)
    return (
      <Alert
        tone={mfa ? 'warning' : 'danger'}
        title={p.partFailed(label)}
        action={
          mfa ? null : (
            <Button size="sm" variant="secondary" onClick={() => query.refetch()} loading={query.isFetching} data-print-hide="">
              {c.retry}
            </Button>
          )
        }
      >
        {errorText(query.error, c)}
      </Alert>
    )
  }
  return children(query.rows)
}

/** "Not recorded yet: …" from the completeness checks a section answers for. */
export function MissingHint({ keys }) {
  const p = useStrings(strings)
  const r = useStrings(registryStrings)
  if (!keys?.length) return null
  return (
    <div className="rounded-xl border border-dashed border-warning/40 bg-warning/[.06] px-4 py-3 text-sm">
      <p className="font-semibold text-warning">{p.notRecorded}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-soft">
        {keys.map((key) => (
          <li key={key}>{r.completenessChecks[key] ?? key}</li>
        ))}
      </ul>
    </div>
  )
}

/** The quiet line of a block that holds nothing yet. */
export function Nothing() {
  const p = useStrings(strings)
  return <p className="text-sm text-faint">{p.nothingYet}</p>
}
