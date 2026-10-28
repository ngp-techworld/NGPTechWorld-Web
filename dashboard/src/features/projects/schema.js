import { z } from 'zod'
import { emptyToNull, intField, optionalText, optionalUrl, requiredText, requiredUrl } from '@/lib/validation'
import { galleryPaths, toGalleryItems } from '@/ui'

// Mirrors of the API rules (ProjectController / ProjectLinkController). The server stays the source of truth.
export const CATEGORIES = ['web', 'mobile', 'ai', 'design', 'erp']
export const STATUSES = ['completed', 'in_progress']
export const LINK_TYPES = ['website', 'github', 'behance', 'instagram', 'facebook', 'linkedin', 'x', 'whatsapp', 'other']
export const GALLERY_MAX = 50
export const TASKS_MAX = 50
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Which form field belongs to which tab (drives the error badges and "jump to the first error"). */
export const TAB_FIELDS = {
  general: ['slug', 'category', 'status', 'client', 'year', 'featured', 'name_ar', 'name_en', 'short_ar', 'short_en', 'description_ar', 'description_en'],
  media: ['cover_image', 'gallery', 'video_url'],
}

// ---------------------------------------------------------------------------------------------------- project

export const emptyProject = () => ({
  slug: '',
  category: '',
  status: 'in_progress', // a brand-new project is still being built (the API keeps development_status in_development)
  client: '',
  year: new Date().getFullYear(),
  featured: false,
  name_ar: '',
  name_en: '',
  short_ar: '',
  short_en: '',
  description_ar: '',
  description_en: '',
  cover_image: null,
  gallery: [],
  video_url: '',
})

/** `c` = common strings, `t` = feature strings (slug message), so every message follows the UI language. */
export function makeProjectSchema(c, t) {
  return z.object({
    slug: z
      .string()
      .trim()
      .max(255, c.maxLength(255))
      .refine((value) => value === '' || SLUG_PATTERN.test(value), t.slugInvalid),
    category: z.enum(CATEGORIES, { error: c.required }),
    status: z.enum(STATUSES, { error: c.required }),
    // optional since the registry (an imported project may not know its client or year, or not name the client)
    client: optionalText(c, 255),
    year: z.preprocess((value) => (value === '' || value === null ? undefined : value), intField(c, { min: 1990, max: 2100 }).optional()),
    featured: z.boolean(),
    name_ar: requiredText(c, 255),
    name_en: requiredText(c, 255),
    short_ar: requiredText(c, 255),
    short_en: requiredText(c, 255),
    description_ar: requiredText(c, 10000),
    description_en: requiredText(c, 10000),
    cover_image: z.string().nullable(),
    gallery: z.array(z.object({ path: z.string(), url: z.string().nullable().optional() })).max(GALLERY_MAX, t.galleryMax),
    video_url: optionalUrl(c),
  })
}

/** API record → form values. The gallery becomes `[{ path, url }]` items (what <GalleryUpload> works with). */
export const toFormValues = (project) => ({
  slug: project.slug ?? '',
  category: project.category ?? '',
  status: project.status ?? 'completed',
  client: project.client ?? '',
  year: project.year ?? '',
  featured: Boolean(project.featured),
  name_ar: project.name_ar ?? '',
  name_en: project.name_en ?? '',
  short_ar: project.short_ar ?? '',
  short_en: project.short_en ?? '',
  description_ar: project.description_ar ?? '',
  description_en: project.description_en ?? '',
  cover_image: project.cover_image ?? null,
  gallery: toGalleryItems(project.gallery, project.gallery_urls),
  video_url: project.video_url ?? '',
})

/** Form values → API body: images as relative paths (`null` clears), gallery as paths only, blanks as `null`. */
export const toPayload = (values) => ({
  slug: emptyToNull(values.slug),
  category: values.category,
  status: values.status,
  client: emptyToNull(values.client),
  year: values.year === '' || values.year === null || values.year === undefined ? null : Number(values.year),
  featured: Boolean(values.featured),
  name_ar: values.name_ar,
  name_en: values.name_en,
  short_ar: values.short_ar,
  short_en: values.short_en,
  description_ar: values.description_ar,
  description_en: values.description_en,
  cover_image: values.cover_image ?? null,
  gallery: galleryPaths(values.gallery),
  video_url: emptyToNull(values.video_url),
})

/**
 * Edit pages send only what changed (the API accepts partial updates), so two people editing different fields do not
 * overwrite each other. `before` = the values the form was loaded / last saved with, `after` = the submitted values.
 */
export function changedPayload(before, after) {
  const previous = toPayload(before)
  return Object.fromEntries(Object.entries(toPayload(after)).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])))
}

// ------------------------------------------------------------------------------------------------ team member

export const emptyMember = () => ({ name: '', role_ar: '', role_en: '', tasks_ar: [], tasks_en: [], avatar: null })

export const makeMemberSchema = (c) =>
  z.object({
    name: requiredText(c, 255),
    role_ar: requiredText(c, 255),
    role_en: requiredText(c, 255),
    tasks_ar: z.array(z.string()).max(TASKS_MAX),
    tasks_en: z.array(z.string()).max(TASKS_MAX),
    avatar: z.string().nullable(),
  })

export const memberToFormValues = (member) => ({
  name: member.name ?? '',
  role_ar: member.role_ar ?? '',
  role_en: member.role_en ?? '',
  tasks_ar: member.tasks_ar ?? [],
  tasks_en: member.tasks_en ?? [],
  avatar: member.avatar ?? null,
})

export const memberToPayload = (values) => ({
  name: values.name,
  role_ar: values.role_ar,
  role_en: values.role_en,
  tasks_ar: values.tasks_ar ?? [],
  tasks_en: values.tasks_en ?? [],
  avatar: values.avatar ?? null,
})

// ------------------------------------------------------------------------------------------------------ link

export const emptyLink = () => ({ type: 'website', url: '' })

export const makeLinkSchema = (c) =>
  z.object({
    type: z.enum(LINK_TYPES, { error: c.required }),
    url: requiredUrl(c).max(255, c.maxLength(255)),
  })

export const linkToFormValues = (link) => ({ type: link.type ?? 'website', url: link.url ?? '' })

export const linkToPayload = (values) => ({ type: values.type, url: values.url })

/** The API only stores http(s) links; check again before rendering one as a clickable <a>. */
export const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value)
