import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useStrings } from '@/i18n'
import { Button, Field, IconButton, Input, Select, Textarea, fieldErrorMessage } from '@/ui'
import { emptyItem } from './form'
import registryStrings from './strings'

function SubControl({ field, value, onChange, error, disabled, ctx }) {
  const r = useStrings(registryStrings)
  const common = { value: value ?? '', disabled, dir: field.dir, onChange: (event) => onChange(event.target.value) }
  let control
  if (field.type === 'select') {
    const options = typeof field.options === 'function' ? field.options(ctx) : field.options
    control = <Select {...common} placeholder={field.required ? undefined : r.noneOption} options={options} />
  } else if (field.type === 'textarea') {
    control = <Textarea {...common} rows={field.rows ?? 2} />
  } else if (field.type === 'number') {
    control = <Input {...common} type="number" inputMode="numeric" />
  } else {
    control = <Input {...common} autoComplete="off" />
  }
  return (
    <Field label={field.label} required={field.required} error={error} className={field.type === 'textarea' ? 'md:col-span-2' : undefined}>
      {control}
    </Field>
  )
}

/**
 * A list of small records edited in place (account roles, workflows, assigned developers…). Controlled: `value` is an
 * array of objects with the keys of `fields`; `errors` is what react-hook-form holds for the list (per item, per key).
 */
export function ObjectListInput({ label, itemLabel, fields, value = [], onChange, errors, maxItems, disabled = false, ctx, hint }) {
  const r = useStrings(registryStrings)
  const items = Array.isArray(value) ? value : []
  const listError = errors && !Array.isArray(errors) && typeof errors === 'object' && errors.message ? errors.message : ''

  const update = (index, key, next) => onChange(items.map((item, i) => (i === index ? { ...item, [key]: next } : item)))
  const move = (index, delta) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[13px] font-semibold text-soft">{label}</legend>
      {items.length ? (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const name = r.itemN(itemLabel, index + 1)
            return (
              <li key={index} aria-label={name} className="rounded-xl border border-white/[.08] bg-white/[.02] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted">{name}</span>
                  {!disabled ? (
                    <div className="flex items-center gap-0.5">
                      <IconButton size="sm" icon={ArrowUp} label={r.moveUp(name)} onClick={() => move(index, -1)} disabled={index === 0} />
                      <IconButton size="sm" icon={ArrowDown} label={r.moveDown(name)} onClick={() => move(index, 1)} disabled={index === items.length - 1} />
                      <IconButton size="sm" icon={Trash2} tone="danger" label={r.removeItem(name)} onClick={() => onChange(items.filter((_, i) => i !== index))} />
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {fields.map((sub) => (
                    <SubControl
                      key={sub.name}
                      field={sub}
                      ctx={ctx}
                      value={item?.[sub.name]}
                      disabled={disabled}
                      onChange={(next) => update(index, sub.name, next)}
                      error={fieldErrorMessage(errors?.[index]?.[sub.name])}
                    />
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-sm text-faint">{r.none}</p>
      )}
      {!disabled ? (
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          className="mt-3"
          onClick={() => onChange([...items, emptyItem({ fields })])}
          disabled={Boolean(maxItems) && items.length >= maxItems}
        >
          {r.addItem(itemLabel)}
        </Button>
      ) : null}
      {listError ? <p className="mt-1.5 text-xs font-medium text-danger">{listError}</p> : null}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </fieldset>
  )
}
