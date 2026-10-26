import { useId } from 'react'
import { Controller, get } from 'react-hook-form'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { DEPLOYMENT_STATUSES, DEVELOPMENT_STATUSES, ObjectListInput, PLATFORMS, registryStrings, toOptions } from '@/features/registry/kit'
import { BilingualField, Card, Checkbox, Field, GalleryUpload, ImageUpload, Input, Select, Switch, fieldErrorMessage } from '@/ui'
import { HIGHLIGHTS_MAX, NONFUNCTIONAL_MAX } from './overviewSchema'
import registryTabStrings from './registry/strings'
import { CATEGORIES, GALLERY_MAX, STATUSES } from './schema'
import strings from './strings'

// The field groups of a project form, shared by the create form (ProjectForm) and the project page (ProjectPage).
// `form` is the react-hook-form instance.

/** Label + hint + error around a control that is not a single form element (the gallery). */
export function LabeledGroup({ label, hint, error, children }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} className="min-w-0">
      <p id={`${id}-label`} className="mb-1.5 text-[13px] font-semibold text-soft">
        {label}
      </p>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Identity of the project (slug, category, client, year…) and its names / descriptions. `showStatus` / `showFeatured`
 * are off on the registry Overview, where the development status and the Publication card replace them.
 */
export function GeneralFields({ form, isEdit = false, showStatus = true, showFeatured = true, clientRequired = true, featuredNote }) {
  const c = useCommon()
  const t = useStrings(strings)
  const {
    register,
    control,
    formState: { errors },
  } = form
  const categoryOptions = CATEGORIES.map((value) => ({ value, label: t.categories[value] }))
  const statusOptions = STATUSES.map((value) => ({ value, label: t.projectStatuses[value] }))

  return (
    <>
      <Card title={t.basicInfo}>
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={t.slug} hint={isEdit ? t.slugHintEdit : t.slugHintCreate} error={errors.slug} className="md:col-span-2">
              <Input {...register('slug')} dir="ltr" placeholder="acme-portal" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label={t.category} required error={errors.category}>
              <Select {...register('category')} placeholder={t.categoryPlaceholder} options={categoryOptions} />
            </Field>
            {showStatus ? (
              <Field label={c.status} required error={errors.status}>
                <Select {...register('status')} options={statusOptions} />
              </Field>
            ) : null}
            <Field label={t.client} required={clientRequired} error={errors.client}>
              <Input {...register('client')} dir="auto" />
            </Field>
            <Field label={t.year} required={clientRequired} error={errors.year}>
              <Input type="number" inputMode="numeric" min={1990} max={2100} {...register('year')} />
            </Field>
          </div>
          {showFeatured ? (
            <Controller
              name="featured"
              control={control}
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={t.featured} description={t.featuredHint} />}
            />
          ) : featuredNote ? (
            <p className="text-xs text-muted">{featuredNote}</p>
          ) : null}
        </div>
      </Card>
      <Card>
        <div className="space-y-6">
          <BilingualField name="name" label={t.name} register={register} errors={errors} required maxLength={255} />
          <BilingualField name="short" label={t.short} hint={t.shortHint} register={register} errors={errors} required maxLength={255} />
          <BilingualField name="description" label={t.descriptionField} register={register} errors={errors} required multiline rows={8} maxLength={10000} />
        </div>
      </Card>
    </>
  )
}

/** Cover, gallery (the original image list, mirrored as screenshots by the API) and video link. */
export function MediaFields({ form, project, onCoverBusy, onGalleryBusy }) {
  const t = useStrings(strings)
  const {
    register,
    control,
    formState: { errors },
  } = form

  return (
    <Card>
      <div className="space-y-8">
        <Controller
          name="cover_image"
          control={control}
          render={({ field }) => (
            <Field label={t.cover} hint={t.coverHint} error={errors.cover_image}>
              <ImageUpload folder="projects" value={field.value} url={project?.cover_image_url} onChange={field.onChange} onUploadingChange={onCoverBusy} />
            </Field>
          )}
        />
        <Controller
          name="gallery"
          control={control}
          render={({ field }) => (
            <LabeledGroup label={t.gallery} hint={t.galleryHint} error={fieldErrorMessage(errors.gallery)}>
              <GalleryUpload folder="projects/gallery" max={GALLERY_MAX} value={field.value} onChange={field.onChange} onUploadingChange={onGalleryBusy} invalid={Boolean(errors.gallery)} />
            </LabeledGroup>
          )}
        />
        <Field label={t.video} hint={t.videoHint} error={errors.video_url}>
          <Input type="url" {...register('video_url')} placeholder={t.videoPlaceholder} autoComplete="off" />
        </Field>
      </div>
    </Card>
  )
}

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
          <Field label={rt.industry} hint={rt.industryHint} error={errors.industry_id}>
            <Select {...register('industry_id')} placeholder={rt.industryNone} options={industries.map((item) => ({ value: String(item.id), label: pickField(item, 'name') }))} />
          </Field>
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
