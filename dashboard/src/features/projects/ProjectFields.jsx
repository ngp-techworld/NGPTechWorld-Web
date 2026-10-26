import { useId } from 'react'
import { Controller } from 'react-hook-form'
import { useCommon, useStrings } from '@/i18n'
import { BilingualField, Card, Field, GalleryUpload, ImageUpload, Input, Select, Switch, fieldErrorMessage } from '@/ui'
import { CATEGORIES, GALLERY_MAX, STATUSES } from './schema'
import strings from './strings'

// The field groups of a project form, shared by the create form (ProjectForm) and the project page (ProjectPage).
// `form` is the react-hook-form instance. The registry's public fields are in RegistryPublicFields.jsx (loaded with
// the project page only).

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
