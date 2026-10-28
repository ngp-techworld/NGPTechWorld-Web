import { Controller, get } from 'react-hook-form'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { DEPLOYMENT_STATUSES, DEVELOPMENT_STATUSES, ObjectListInput, PLATFORMS, registryStrings, toOptions } from '@/features/registry/kit'
import { BilingualField, Card, Checkbox, Field, Input, Select, fieldErrorMessage } from '@/ui'
import { HIGHLIGHTS_MAX, NONFUNCTIONAL_MAX } from './overviewSchema'
import registryTabStrings from './registry/strings'

function ListField({ form, name, label, itemLabel, fields, maxItems, hint }) {
  const {
    control,
    formState: { errors },
  } = form
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <ObjectListInput label={label} itemLabel={itemLabel} fields={fields} value={field.value ?? []} onChange={field.onChange} errors={get(errors, name)} maxItems={maxItems} hint={hint} />
      )}
    />
  )
}

/** The registry's public fields of a project (status, platforms, industry, business description, highlights). */
export function RegistryPublicFields({ form, industries = [] }) {
  const c = useCommon()
  const rt = useStrings(registryTabStrings)
  const r = useStrings(registryStrings)
  const { pickField } = useLanguage()
  const {
    register,
    control,
    formState: { errors },
  } = form
  const pairFields = (max) => [
    { name: 'ar', type: 'text', label: c.arabic, required: true, dir: 'rtl' },
    { name: 'en', type: 'text', label: c.english, required: true, dir: 'ltr' },
  ].map((field) => ({ ...field, max }))

  return (
    <>
      <Card title={rt.statusCard}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={rt.developmentStatus} required hint={rt.developmentStatusHint} error={errors.development_status}>
            <Select {...register('development_status')} options={toOptions(DEVELOPMENT_STATUSES, r.developmentStatuses)} />
          </Field>
          <Field label={rt.deploymentStatus} required error={errors.deployment_status}>
            <Select {...register('deployment_status')} options={toOptions(DEPLOYMENT_STATUSES, r.deploymentStatuses)} />
          </Field>
          {/* controlled: the catalog arrives after the form, and the stored industry must still be the one shown */}
          <Controller
            name="industry_id"
            control={control}
            render={({ field }) => (
              <Field label={rt.industry} hint={rt.industryHint} error={errors.industry_id}>
                <Select
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  placeholder={rt.industryNone}
                  options={industries.map((item) => ({ value: String(item.id), label: pickField(item, 'name') }))}
                />
              </Field>
            )}
          />
          <Field label={rt.publicDemoUrl} error={errors.public_demo_url}>
            <Input type="url" {...register('public_demo_url')} placeholder="https://" autoComplete="off" />
          </Field>
          <Controller
            name="platforms"
            control={control}
            render={({ field }) => {
              const selected = field.value ?? []
              return (
                <fieldset className="min-w-0 md:col-span-2">
                  <legend className="mb-2 text-[13px] font-semibold text-soft">{rt.platforms}</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                    {PLATFORMS.map((platform) => (
                      <Checkbox
                        key={platform}
                        label={r.platforms[platform]}
                        checked={selected.includes(platform)}
                        onChange={(checked) => field.onChange(checked ? [...selected, platform] : selected.filter((value) => value !== platform))}
                      />
                    ))}
                  </div>
                  {errors.platforms ? <p className="mt-1.5 text-xs font-medium text-danger">{fieldErrorMessage(errors.platforms)}</p> : null}
                </fieldset>
              )
            }}
          />
        </div>
      </Card>

      <Card title={rt.businessCard}>
        <div className="space-y-6">
          <BilingualField name="business_problem" label={rt.businessProblem} register={register} errors={errors} multiline rows={4} maxLength={10000} />
          <BilingualField name="solution" label={rt.solution} register={register} errors={errors} multiline rows={4} maxLength={10000} />
          <BilingualField name="target_customers" label={rt.targetCustomers} register={register} errors={errors} multiline rows={2} maxLength={2000} />
          <BilingualField name="target_users" label={rt.targetUsers} register={register} errors={errors} multiline rows={2} maxLength={2000} />
        </div>
      </Card>

      <Card title={rt.highlightsCard}>
        <div className="space-y-8">
          <ListField form={form} name="highlights" label={rt.highlights} itemLabel={rt.highlight} fields={pairFields(300)} maxItems={HIGHLIGHTS_MAX} hint={rt.highlightsHint} />
          <ListField form={form} name="technical_highlights" label={rt.technicalHighlights} itemLabel={rt.technicalHighlight} fields={pairFields(300)} maxItems={HIGHLIGHTS_MAX} hint={rt.highlightsHint} />
          <ListField
            form={form}
            name="nonfunctional_highlights"
            label={rt.nonfunctionalHighlights}
            itemLabel={rt.nfHighlight}
            maxItems={NONFUNCTIONAL_MAX}
            hint={rt.nonfunctionalHint}
            fields={[
              { name: 'key', type: 'text', label: rt.nfKey, required: true, dir: 'ltr' },
              { name: 'title_ar', type: 'text', label: `${rt.nfTitle} (${c.arabic})`, required: true, dir: 'rtl' },
              { name: 'title_en', type: 'text', label: `${rt.nfTitle} (${c.english})`, required: true, dir: 'ltr' },
              { name: 'description_ar', type: 'textarea', label: `${rt.nfDescription} (${c.arabic})`, dir: 'rtl' },
              { name: 'description_en', type: 'textarea', label: `${rt.nfDescription} (${c.english})`, dir: 'ltr' },
            ]}
          />
        </div>
      </Card>
    </>
  )
}
