import { useId, useState } from 'react'
import { ArrowLeft, ChevronDown, Lock } from 'lucide-react'
import { useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { Badge, Button, flipRtl } from '@/ui'
import { splitPath, useFieldLabels } from './labels'
import { Disclosure, TIER_TONES } from './parts'
import strings from './strings'
import { ValueView } from './ValueView'

/** Keep / replace for one changed field: two native radios styled as a segmented control. */
function ChoiceToggle({ name, value, onChange, label }) {
  const t = useStrings(strings)
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-xl border border-white/10 bg-black/10 p-0.5">
      {['keep', 'replace'].map((option) => (
        <label
          key={option}
          className={cx(
            'cursor-pointer select-none whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-accent-light',
            value === option ? (option === 'replace' ? 'bg-accent text-white' : 'bg-white/15 text-ink') : 'text-muted hover:text-ink',
          )}
        >
          <input type="radio" className="sr-only" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
          {option === 'keep' ? t.keep : t.replace}
        </label>
      ))}
    </div>
  )
}

function FieldName({ section, item }) {
  const { fieldLabel, refLabel } = useFieldLabels()
  const ref = refLabel(section, item.ref)
  return (
    <span className="block min-w-0">
      {ref ? (
        <bdi dir="auto" className="block truncate font-mono text-[11px] text-faint">
          {ref}
        </bdi>
      ) : null}
      <span className="font-semibold text-ink">{fieldLabel(section, item.field)}</span>
    </span>
  )
}

function NewRecord({ section, record }) {
  const t = useStrings(strings)
  const { fieldLabel, refLabel } = useFieldLabels()
  const [open, setOpen] = useState(false)
  const fields = record.fields && typeof record.fields === 'object' ? Object.entries(record.fields) : []
  const ref = refLabel(section, record.ref)
  return (
    <li className="rounded-lg bg-white/[.03] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span dir="auto" className="font-semibold text-ink">
          {record.title || ref || '—'}
        </span>
        {ref && record.title ? (
          <bdi dir="auto" className="font-mono text-[11px] text-faint">
            {ref}
          </bdi>
        ) : null}
        {fields.length ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="ms-auto text-xs font-semibold text-accent-lighter hover:underline">
            {open ? t.hideFields : t.showFields}
          </button>
        ) : null}
      </div>
      {open ? (
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(120px,auto)_minmax(0,1fr)]">
          {fields.map(([field, value]) => (
            <div key={field} className="contents">
              <dt className="text-xs font-semibold text-muted">{fieldLabel(section, field)}</dt>
              <dd className="min-w-0 text-soft">
                <ValueView value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  )
}

function ChangedTable({ section, editable, choiceOf, onChoose }) {
  const t = useStrings(strings)
  const { fieldLabel, refLabel } = useFieldLabels()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[.08] text-xs font-bold text-muted">
            <th scope="col" className="py-2 pe-3 text-start">
              {t.colField}
            </th>
            <th scope="col" className="py-2 pe-2 text-start">
              {t.colCurrent}
            </th>
            <th scope="col" className="w-6 py-2">
              <span className="sr-only">{t.replacedBy}</span>
            </th>
            <th scope="col" className="py-2 pe-3 text-start">
              {t.colIncoming}
            </th>
            {editable ? (
              <th scope="col" className="py-2 text-start">
                {t.colChoice}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[.06]">
          {section.changed.map((item) => {
            const choice = choiceOf(item)
            const label = [refLabel(section.key, item.ref), fieldLabel(section.key, item.field)].filter(Boolean).join(' · ')
            return (
              <tr key={item.path} className="align-top" data-path={item.path}>
                <th scope="row" className="w-[26%] py-2.5 pe-3 text-start font-normal">
                  <FieldName section={section.key} item={item} />
                  {item.reason && t.reasons[item.reason] ? (
                    <span className={cx('mt-1 inline-block rounded-xl px-2 py-0.5 text-[11px] font-semibold leading-snug', item.reason === 'edited_by_user' ? 'bg-gold/15 text-gold' : 'bg-info/15 text-info')}>
                      {t.reasons[item.reason]}
                    </span>
                  ) : null}
                </th>
                <td className={cx('py-2.5 pe-2', editable && choice === 'replace' ? 'text-faint line-through decoration-white/30' : 'text-soft')}>
                  <ValueView value={item.current} />
                </td>
                <td className="py-2.5 text-center text-muted">
                  <ArrowLeft size={15} aria-hidden="true" className={cx('inline', flipRtl)} />
                </td>
                <td className={cx('py-2.5 pe-3', !editable || choice === 'replace' ? 'text-ink' : 'text-faint')}>
                  <ValueView value={item.incoming} />
                </td>
                {editable ? (
                  <td className="py-2.5">
                    <ChoiceToggle name={`decision:${item.path}`} value={choice} onChange={(value) => onChoose(item.path, value)} label={t.choiceFor(label)} />
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * One section of the preview (contract `Section`): its new records, the changed fields with a keep / replace choice
 * each (plus keep all / replace all), the values the package left empty, what exists only on our side and the errors
 * that block apply. A `read_only` section is shown greyed, without choices: apply skips it.
 */
export function SectionPanel({ section, choiceOf, onChoose, onChooseAll }) {
  const t = useStrings(strings)
  const { fieldLabel, refLabel } = useFieldLabels()
  const contentId = useId()
  const readOnly = section.access === 'read_only'
  const counts = { new: section.new?.length ?? 0, changed: section.changed?.length ?? 0, errors: section.errors?.length ?? 0 }
  const [open, setOpen] = useState(counts.changed > 0 || counts.errors > 0)
  const label = t.sections[section.key] ?? section.key
  const empty = !counts.new && !counts.changed && !counts.errors && !section.skipped_empty?.length && !section.only_in_db?.length

  return (
    <section aria-label={label} className={cx('rounded-card border bg-white/[.03]', counts.errors ? 'border-danger/40' : 'border-white/[.08]', readOnly && 'opacity-60')}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-start">
          <ChevronDown size={16} aria-hidden="true" className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
          <span className="text-base font-bold text-ink">{label}</span>
          <Badge tone={TIER_TONES[section.tier] ?? 'neutral'}>
            <span className="sr-only">{t.tierLabel}: </span>
            {t.tiers[section.tier] ?? section.tier}
          </Badge>
          {readOnly ? (
            <Badge tone="neutral">
              <Lock size={11} aria-hidden="true" />
              {t.readOnlyBadge}
            </Badge>
          ) : null}
          <span className="ms-auto flex flex-wrap items-center gap-1.5 text-xs">
            {counts.errors ? <Badge tone="danger">{t.chipErrors(counts.errors)}</Badge> : null}
            {counts.new ? <Badge tone="success">{t.chipNew(counts.new)}</Badge> : null}
            {counts.changed ? <Badge tone="warning">{t.chipChanged(counts.changed)}</Badge> : null}
            {section.unchanged ? <span className="text-muted">{t.chipUnchanged(section.unchanged)}</span> : null}
          </span>
        </button>
      </h3>

      {open ? (
        <div id={contentId} className="space-y-4 border-t border-white/[.07] px-4 py-4">
          {readOnly ? (
            <p className="flex items-center gap-2 rounded-lg bg-white/[.05] px-3 py-2 text-sm text-soft">
              <Lock size={14} aria-hidden="true" />
              {t.readOnlySection}
            </p>
          ) : null}

          {counts.errors ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm" role="group" aria-label={t.sectionErrors(counts.errors)}>
              <p className="font-semibold text-danger">{t.sectionErrors(counts.errors)}</p>
              <ul className="mt-1 space-y-1">
                {section.errors.map((error, index) => {
                  const { ref, field } = splitPath(error.path, section.key)
                  return (
                    <li key={`${error.path}-${index}`} className="text-ink/90">
                      <span className="font-semibold">{[refLabel(section.key, ref), fieldLabel(section.key, field)].filter(Boolean).join(' · ')}</span>
                      <span className="text-faint"> — </span>
                      <span dir="auto">{t.errorCodes[error.code] ?? error.message ?? error.code}</span>
                      {error.path ? (
                        <bdi dir="ltr" className="ms-2 font-mono text-[11px] text-muted">
                          {error.path}
                        </bdi>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {counts.new ? (
            <div>
              <h4 className="text-sm font-bold text-soft">{t.newRecords(counts.new)}</h4>
              <p className="text-xs text-muted">{t.newRecordsHint}</p>
              <ul className="mt-2 space-y-1.5">
                {section.new.map((record, index) => (
                  <NewRecord key={record.ref ?? index} section={section.key} record={record} />
                ))}
              </ul>
            </div>
          ) : null}

          {counts.changed ? (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-soft">{t.changedFields(counts.changed)}</h4>
                {!readOnly ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onChooseAll(section, 'keep')} aria-label={`${t.keepAll} · ${label}`}>
                      {t.keepAll}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onChooseAll(section, 'replace')} aria-label={`${t.replaceAll} · ${label}`}>
                      {t.replaceAll}
                    </Button>
                  </div>
                ) : null}
              </div>
              <ChangedTable section={section} editable={!readOnly} choiceOf={choiceOf} onChoose={onChoose} />
            </div>
          ) : null}

          {section.unchanged ? <p className="text-xs text-muted">{t.unchangedCount(section.unchanged)}</p> : null}

          {section.skipped_empty?.length ? (
            <Disclosure title={<span className="text-sm font-semibold text-soft">{t.skippedEmpty(section.skipped_empty.length)}</span>}>
              <p className="mb-1.5 text-xs text-muted">{t.skippedEmptyHint}</p>
              <ul className="space-y-1 text-sm">
                {section.skipped_empty.map((item) => (
                  <li key={item.path} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-ink">{[refLabel(section.key, item.ref), fieldLabel(section.key, item.field)].filter(Boolean).join(' · ')}</span>
                    <span className="text-soft">
                      <ValueView value={item.current} />
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}

          {section.only_in_db?.length ? (
            <Disclosure title={<span className="text-sm font-semibold text-soft">{t.onlyInDb(section.only_in_db.length)}</span>}>
              <p className="mb-1.5 text-xs text-muted">{t.onlyInDbHint}</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-soft">
                {section.only_in_db.map((record, index) => (
                  <li key={record.ref ?? index} dir="auto">
                    {record.title || refLabel(section.key, record.ref)}
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}

          {empty ? <p className="text-sm text-muted">{t.nothingInSection}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
