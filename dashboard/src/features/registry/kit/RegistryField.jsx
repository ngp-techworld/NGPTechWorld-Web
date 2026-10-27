import { Controller, get } from 'react-hook-form'
import { useStrings } from '@/i18n'
import { cx } from '@/lib/cx'
import { BilingualField, Checkbox, Field, Input, Select, Switch, TagsInput, Textarea, fieldErrorMessage } from '@/ui'
import { ListInput } from './ListInput'
import { ObjectListInput } from './ObjectListInput'
import registryStrings from './strings'

const WIDE = new Set(['textarea', 'bilingual', 'lines', 'tags', 'objectList', 'checkboxes', 'section', 'readonly'])

/** Grid column classes of one field inside <FieldGrid>. */
export const fieldSpan = (field) => (field.span === 'half' ? undefined : field.span === 'full' || WIDE.has(field.type) ? 'md:col-span-2' : undefined)

export const resolveOptions = (field, ctx) => (typeof field.options === 'function' ? field.options(ctx) : field.options) ?? []

/**
 * One field of a generated form (CollectionTab / GroupForm), from its description (see form.js). `form` is the
 * react-hook-form instance; `ctx` is passed to option functions (lists of modules, catalog entries…).
 */
export function RegistryField({ field, form, ctx, disabled = false }) {
  const r = useStrings(registryStrings)
  const {
    register,
    control,
    formState: { errors },
  } = form
  const error = fieldErrorMessage(get(errors, field.name))
  const hint = field.hint ?? (field.type === 'lines' ? r.linesHint : undefined)
  const span = fieldSpan(field)

  switch (field.type) {
    case 'section':
      return (
        <h3 className={cx('border-b border-white/[.07] pb-2 pt-2 text-sm font-bold text-ink', span)}>
          {field.label}
          {field.hint ? <span className="mt-0.5 block text-xs font-normal text-muted">{field.hint}</span> : null}
        </h3>
      )
    case 'readonly': {
      const value = field.render ? field.render(form.getValues(), ctx) : null
      return value ? (
        <div className={span}>
          <p className="mb-1.5 text-[13px] font-semibold text-soft">{field.label}</p>
          <div className="text-sm text-muted">{value}</div>
        </div>
      ) : null
    }
    case 'bilingual':
      return (
        <BilingualField
          name={field.name}
          label={field.label}
          hint={hint}
          register={register}
          errors={errors}
          required={field.required}
          multiline={field.multiline}
          rows={field.rows}
          maxLength={field.max}
          disabled={disabled}
          className={span}
        />
      )
    case 'textarea':
      return (
        <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
          <Textarea rows={field.rows ?? 3} dir={field.dir ?? 'auto'} maxLength={field.max} disabled={disabled} {...register(field.name)} />
        </Field>
      )
    case 'select':
    case 'boolSelect': {
      const options =
        field.type === 'boolSelect'
          ? [
              { value: '', label: r.unknown },
              { value: '1', label: r.yes },
              { value: '0', label: r.no },
            ]
          : resolveOptions(field, ctx)
      const placeholder = field.type === 'boolSelect' || field.nullable === false ? undefined : field.required ? (field.placeholder ?? r.choose) : r.noneOption
      // controlled: options that arrive after the form (modules, catalog entries) must still show the stored value,
      // which an uncontrolled <select> registered before its <option> existed would not
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: rhf }) => (
            <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
              <Select
                ref={rhf.ref}
                name={rhf.name}
                value={rhf.value ?? ''}
                onChange={(event) => rhf.onChange(event.target.value)}
                onBlur={rhf.onBlur}
                placeholder={placeholder}
                options={options}
                disabled={disabled}
              />
            </Field>
          )}
        />
      )
    }
    case 'switch':
      return (
        <div className={span}>
          <Controller
            name={field.name}
            control={control}
            render={({ field: rhf }) => <Switch checked={Boolean(rhf.value)} onChange={rhf.onChange} label={field.label} description={hint} disabled={disabled} />}
          />
          {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
        </div>
      )
    case 'tags':
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: rhf }) => (
            <Field label={field.label} hint={hint ?? r.tagsHint} error={error} required={field.required} className={span}>
              <TagsInput value={rhf.value ?? []} onChange={rhf.onChange} dir={field.dir} max={field.maxItems} maxLength={field.itemMax} disabled={disabled} placeholder={field.placeholder} />
            </Field>
          )}
        />
      )
    case 'lines':
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: rhf }) => (
            <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
              <ListInput value={rhf.value ?? []} onChange={rhf.onChange} rows={field.rows ?? 4} dir={field.dir ?? 'auto'} disabled={disabled} />
            </Field>
          )}
        />
      )
    case 'checkboxes':
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: rhf }) => {
            const selected = rhf.value ?? []
            return (
              <fieldset className={cx('min-w-0', span)}>
                <legend className="mb-2 text-[13px] font-semibold text-soft">{field.label}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {resolveOptions(field, ctx).map((option) => (
                    <Checkbox
                      key={option.value}
                      label={option.label}
                      checked={selected.includes(option.value)}
                      disabled={disabled}
                      onChange={(checked) => rhf.onChange(checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
                    />
                  ))}
                </div>
                {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
                {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
              </fieldset>
            )
          }}
        />
      )
    case 'objectList':
      return (
        <div className={span}>
          <Controller
            name={field.name}
            control={control}
            render={({ field: rhf }) => (
              <ObjectListInput
                label={field.label}
                itemLabel={field.itemLabel ?? field.label}
                fields={field.fields}
                value={rhf.value ?? []}
                onChange={rhf.onChange}
                errors={get(errors, field.name)}
                maxItems={field.maxItems}
                disabled={disabled}
                ctx={ctx}
                hint={hint}
              />
            )}
          />
        </div>
      )
    case 'number':
      return (
        <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
          <Input type="number" inputMode="numeric" min={field.min} max={field.maxValue} disabled={disabled} {...register(field.name)} />
        </Field>
      )
    case 'date':
      return (
        <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
          <Input type="date" dir="ltr" disabled={disabled} {...register(field.name)} />
        </Field>
      )
    case 'url':
      return (
        <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
          <Input type="url" autoComplete="off" placeholder={field.placeholder ?? 'https://'} maxLength={field.max} disabled={disabled} {...register(field.name)} />
        </Field>
      )
    default:
      return (
        <Field label={field.label} hint={hint} error={error} required={field.required} className={span}>
          <Input
            autoComplete="off"
            dir={field.dir ?? 'auto'}
            placeholder={field.placeholder}
            maxLength={field.max}
            spellCheck={field.dir === 'ltr' ? false : undefined}
            disabled={disabled}
            {...register(field.name)}
          />
        </Field>
      )
  }
}

/** The fields of a generated form, two columns from md up (wide fields take both). */
export function FieldGrid({ fields, form, ctx, disabled }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {fields
        .filter((field) => field && !field.hidden)
        .map((field) => (
          <RegistryField key={field.name ?? field.label} field={field} form={form} ctx={ctx} disabled={disabled} />
        ))}
    </div>
  )
}
