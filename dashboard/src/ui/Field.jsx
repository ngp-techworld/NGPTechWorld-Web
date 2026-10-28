import { createContext, useContext, useId, useMemo } from 'react'
import { cx } from '@/lib/cx'

const FieldContext = createContext(null)

/** Inside <Field>, controls read their id / aria-invalid / aria-describedby from here. */
export const useFieldContext = () => useContext(FieldContext)

/** RHF passes FieldError objects; strings pass through. */
export const errorMessage = (error) => (typeof error === 'string' ? error : error?.message || '')

/**
 * Label + control + hint + error text. The control inside (Input, Textarea, Select, TagsInput, Switch…)
 * is wired automatically (id, aria-invalid, aria-describedby).
 *
 *   <Field label="Name" required error={errors.name} hint="Shown on the site">
 *     <Input {...register('name')} />
 *   </Field>
 *
 * `error` can be a string or a react-hook-form FieldError. `required` only draws the asterisk
 * (validation is done by zod / the server — use <form noValidate>).
 */
export function Field({ label, hint, error, required = false, htmlFor, className, labelClassName, children }) {
  const autoId = useId()
  const id = htmlFor || autoId
  const message = errorMessage(error)
  const errorId = message ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const value = useMemo(() => ({ id, invalid: Boolean(message), describedBy, required }), [id, message, describedBy, required])

  return (
    <FieldContext.Provider value={value}>
      <div className={cx('min-w-0', className)}>
        {label ? (
          <label htmlFor={id} className={cx('mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-soft', labelClassName)}>
            {label}
            {required ? (
              <span aria-hidden="true" className="text-gold">
                *
              </span>
            ) : null}
          </label>
        ) : null}
        {children}
        {message ? (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
            <bdi>{message}</bdi>
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}
