import { z } from 'zod'
import { DEPLOYMENT_STATUSES, DEVELOPMENT_STATUSES, KEY_PATTERN, PLATFORMS } from '@/features/registry/kit'
import { emptyToNull, optionalText, optionalUrl, requiredText } from '@/lib/validation'
import { TAB_FIELDS, makeProjectSchema, toFormValues, toPayload } from './schema'

// The Overview form of the project page when the registry is available: the original fields (schema.js) plus the
// registry's public fields that the same endpoint accepts (ProjectController::rules). Highlights are lists of
// `{ ar, en }`; a non-functional highlight is kept flat in the form (title_ar…) and nested in the body.

export const HIGHLIGHTS_MAX = 12
export const NONFUNCTIONAL_MAX = 16

const BILINGUAL_TEXTS = {
  business_problem: 10000,
  solution: 10000,
  target_customers: 2000,
  target_users: 2000,
}
const textNames = Object.keys(BILINGUAL_TEXTS).flatMap((name) => [`${name}_ar`, `${name}_en`])

/** Form fields of the Overview tab (error badge, "jump to the first error"). */
export const OVERVIEW_FIELDS = [
  ...TAB_FIELDS.general,
  'industry_id',
  ...textNames,
  'platforms',
  'highlights',
  'technical_highlights',
  'nonfunctional_highlights',
  'development_status',
  'deployment_status',
  'public_demo_url',
]

const pair = (c, max) => z.object({ ar: requiredText(c, max), en: requiredText(c, max) })

/**
 * `c` common strings, `t` project strings, `rt` registry tab strings, `r` registry kit strings.
 */
export function makeOverviewSchema(c, t, rt, r) {
  return makeProjectSchema(c, t).extend({
    industry_id: z.string(),
    ...Object.fromEntries(Object.entries(BILINGUAL_TEXTS).flatMap(([name, max]) => [[`${name}_ar`, optionalText(c, max)], [`${name}_en`, optionalText(c, max)]])),
    platforms: z.array(z.enum(PLATFORMS)),
    highlights: z.array(pair(c, 300)).max(HIGHLIGHTS_MAX, rt.highlightsMax(HIGHLIGHTS_MAX)),
    technical_highlights: z.array(pair(c, 300)).max(HIGHLIGHTS_MAX, rt.highlightsMax(HIGHLIGHTS_MAX)),
    nonfunctional_highlights: z
      .array(
        z.object({
          key: z.string().trim().min(1, c.required).max(80, c.maxLength(80)).regex(KEY_PATTERN, r.keyFormat),
          title_ar: requiredText(c, 120),
          title_en: requiredText(c, 120),
          description_ar: optionalText(c, 500),
          description_en: optionalText(c, 500),
        }),
      )
      .max(NONFUNCTIONAL_MAX, rt.highlightsMax(NONFUNCTIONAL_MAX)),
    development_status: z.enum(DEVELOPMENT_STATUSES),
    deployment_status: z.enum(DEPLOYMENT_STATUSES),
    public_demo_url: optionalUrl(c),
  })
}

const pairs = (list) => (Array.isArray(list) ? list.map((item) => ({ ar: item?.ar ?? '', en: item?.en ?? '' })) : [])

/** API record → Overview form values. */
export const toOverviewValues = (project) => ({
  ...toFormValues(project),
  industry_id: project.industry_id ? String(project.industry_id) : '',
  ...Object.fromEntries(textNames.map((name) => [name, project[name] ?? ''])),
  platforms: Array.isArray(project.platforms) ? project.platforms : [],
  highlights: pairs(project.highlights),
  technical_highlights: pairs(project.technical_highlights),
  nonfunctional_highlights: (Array.isArray(project.nonfunctional_highlights) ? project.nonfunctional_highlights : []).map((item) => ({
    key: item?.key ?? '',
    title_ar: item?.title?.ar ?? '',
    title_en: item?.title?.en ?? '',
    description_ar: item?.description?.ar ?? '',
    description_en: item?.description?.en ?? '',
  })),
  development_status: project.development_status ?? 'in_development',
  deployment_status: project.deployment_status ?? 'unknown',
  public_demo_url: project.public_demo_url ?? '',
})

/** Overview form values → body of PUT /projects/{id}. */
export const toOverviewPayload = (values) => ({
  ...toPayload(values),
  industry_id: values.industry_id ? Number(values.industry_id) : null,
  ...Object.fromEntries(textNames.map((name) => [name, emptyToNull(values[name])])),
  platforms: values.platforms ?? [],
  highlights: pairs(values.highlights),
  technical_highlights: pairs(values.technical_highlights),
  nonfunctional_highlights: (values.nonfunctional_highlights ?? []).map((item) => ({
    key: item.key,
    title: { ar: item.title_ar, en: item.title_en },
    description: { ar: emptyToNull(item.description_ar), en: emptyToNull(item.description_en) },
  })),
  development_status: values.development_status,
  deployment_status: values.deployment_status,
  public_demo_url: emptyToNull(values.public_demo_url),
})

/** Only what changed (the API takes partial updates). */
export function changedOverviewPayload(before, after) {
  const previous = toOverviewPayload(before)
  return Object.fromEntries(Object.entries(toOverviewPayload(after)).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])))
}

/** `nonfunctional_highlights.0.title.ar` (API) → `nonfunctional_highlights.0.title_ar` (form). */
export const toFormErrorKey = (key) => key.replace(/^(nonfunctional_highlights\.\d+)\.(title|description)\.(ar|en)$/, '$1.$2_$3')
