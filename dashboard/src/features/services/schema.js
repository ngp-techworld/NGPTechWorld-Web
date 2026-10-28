import { z } from 'zod'
import { emptyToNull, requiredText } from '@/lib/validation'
import { SERVICE_ICON_KEYS } from './icons'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const emptyService = {
  slug: '',
  icon_key: '',
  title_ar: '',
  title_en: '',
  description_ar: '',
  description_en: '',
  features_ar: [],
  features_en: [],
  is_active: true,
}

/**
 * Validation mirrors the API rules (ServiceController::rules). Built from the common strings `c` so the messages
 * follow the UI language. The server stays the source of truth: its 422 errors are shown on the same fields.
 */
export function makeServiceSchema(c, t) {
  const feature = z.string().trim().max(255, c.maxLength(255))
  return z.object({
    // Optional in every sense: blank on create and the API derives it from the English title,
    // and defaulted so validating a partial object does not force every caller to carry it.
    slug: z.string().trim().max(255, c.maxLength(255))
      .refine((value) => value === '' || SLUG_PATTERN.test(value), t.slugInvalid)
      .default(''),
    icon_key: z.enum(SERVICE_ICON_KEYS, { error: c.required }),
    title_ar: requiredText(c, 255),
    title_en: requiredText(c, 255),
    description_ar: requiredText(c, 5000),
    description_en: requiredText(c, 5000),
    features_ar: z.array(feature),
    features_en: z.array(feature),
    is_active: z.boolean(),
  })
}

/** API record → form values (editable fields only; `order` is managed by the reorder mode). */
export const toFormValues = (service) => ({
  slug: service.slug ?? '',
  icon_key: service.icon_key ?? '',
  title_ar: service.title_ar,
  title_en: service.title_en,
  description_ar: service.description_ar,
  description_en: service.description_en,
  features_ar: [...(service.features_ar ?? [])],
  features_en: [...(service.features_en ?? [])],
  is_active: service.is_active ?? true,
})

/**
 * Form values → API payload. A blank slug is sent as null rather than '', which is what tells the
 * API to derive one on create and to leave the existing one alone on update — an empty string
 * would fail its format rule instead.
 */
export const toPayload = (values) => ({ ...values, slug: emptyToNull(values.slug) })
