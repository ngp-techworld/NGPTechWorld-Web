import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCommon, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { BilingualField, BilingualTags, Button, Card, Field, FormActions, Input, Switch } from '@/ui'
import { IconPicker } from './IconPicker'
import { emptyService, makeServiceSchema } from './schema'
import strings from './strings'

// The public site the dashboard is proxied onto; the link is for people, so it must be absolute.
const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://www.ngptechworld.com'

/**
 * Create / edit form. `onSubmit(values)` must return a promise: when it rejects with a 422 the server's field
 * errors are put on the matching inputs; any other error already produced a toast (crud hook).
 * On edit forms `isEdit` keeps Save disabled until something changed.
 */
export function ServiceForm({ defaultValues = emptyService, onSubmit, saving = false, isEdit = false }) {
  const c = useCommon()
  const t = useStrings(strings)
  const schema = useMemo(() => makeServiceSchema(c, t), [c, t])
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues })

  // The link is built from whatever is in the field right now, so an edit shows where it will
  // point before it is saved. On create, before a slug has been typed or derived, there is
  // nothing honest to show yet.
  const slug = useWatch({ control, name: 'slug' })
  const serviceLink = slug ? `${SITE_URL}/contact?service=${slug}` : null
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(serviceLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is refused outside a secure context and in some browsers; the link is
      // on screen and selectable either way, so there is nothing to recover from.
    }
  }

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (err) {
      applyServerErrors(setError, err)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Card>
        <div className="space-y-6">
          <Controller
            name="icon_key"
            control={control}
            render={({ field }) => (
              <IconPicker ref={field.ref} value={field.value} onChange={field.onChange} labels={t.icons} label={t.icon} hint={t.iconHint} required error={errors.icon_key} />
            )}
          />
          <Field label={t.slug} hint={isEdit ? t.slugHintEdit : t.slugHintCreate} error={errors.slug}>
            <Input {...register('slug')} dir="ltr" placeholder="domain-registration" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>

          {serviceLink ? (
            <Field label={t.serviceLink} hint={t.serviceLinkHint}>
              <div className="flex items-center gap-2">
                <Input value={serviceLink} dir="ltr" readOnly onFocus={(e) => e.target.select()} />
                <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
                  {copied ? t.copied : t.copy}
                </Button>
              </div>
            </Field>
          ) : null}

          <BilingualField name="title" label={t.serviceTitle} register={register} errors={errors} required maxLength={255} />
          <BilingualField name="description" label={t.serviceDescription} register={register} errors={errors} required multiline rows={5} maxLength={5000} />
          <BilingualTags name="features" label={t.features} hint={t.featuresHint} control={control} errors={errors} />
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t.activeLabel} description={t.activeHint} />}
          />
        </div>
      </Card>
      <FormActions saving={saving} dirty={isEdit ? isDirty : undefined} cancelTo="/services" />
    </form>
  )
}
