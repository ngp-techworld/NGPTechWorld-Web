import { ApiError } from '@/lib/api'
import { errorText } from '@/lib/errors'

// Server messages the registry produces in English, matched by their wording (App\Rules\NoSecrets::MESSAGE and
// TOO_LONG_MESSAGE, the catalog and gallery guards) and shown in the UI language instead.
const KNOWN = [
  [/looks like it contains a password, key or token/i, 'secretDetected'],
  [/too long to check for passwords, keys or tokens/i, 'secretTooLong'],
  [/still uses this technology/i, 'techInUse'],
  [/still uses this industry/i, 'industryInUse'],
  [/comes from the project gallery/i, 'legacyGallery'],
  [/already listed for that component/i, 'duplicateForComponent'],
  [/already in the catalog/i, 'alreadyInCatalog'],
  [/private screenshot cannot be the cover|cannot be the cover/i, 'privateCover'],
]

/** One server message in the UI language when it is one the registry is known to send; otherwise unchanged. */
export function localizeMessage(message, r) {
  const text = String(message ?? '')
  const known = KNOWN.find(([pattern]) => pattern.test(text))
  return known && r[known[1]] ? r[known[1]] : text
}

/** True when a message is the vault guard's "looks like a secret" refusal. */
export const isSecretMessage = (message) => KNOWN[0][0].test(String(message ?? ''))

/** The human labels of publication keys (`errors.publication` of a publish 422, `publication.missing`). */
export const publicationLabels = (keys, r) => (Array.isArray(keys) ? keys : []).map((key) => r.publicationMissing?.[key] ?? key)

/**
 * A 422 with every known message localized (secrets → "store it in the vault", catalog guards…), ready for
 * applyServerErrors. Any other error is returned as it is.
 */
export function localizeErrors(err, r) {
  if (!(err instanceof ApiError) || err.status !== 422) return err
  const errors = Object.fromEntries(
    Object.entries(err.errors).map(([field, messages]) => [field, (Array.isArray(messages) ? messages : [messages]).map((message) => localizeMessage(message, r))]),
  )
  return new ApiError({ status: 422, message: err.message, errors, data: err.data })
}

/**
 * Text for a failed action that has no form to show field errors on (delete, an inline switch, a quick action).
 * `errors.publication` (the last public image of a published project without a cover) gets its own sentence.
 */
export function actionErrorText(err, r, c) {
  if (err?.status !== 422) return errorText(err, c)
  const errors = err.errors ?? {}
  if (Array.isArray(errors.publication) && errors.publication.length) {
    return errors.publication.includes('cover') ? r.lastPublicImage : publicationLabels(errors.publication, r).join(' · ')
  }
  const first = Object.values(errors).flat()[0]
  if (first) return localizeMessage(first, r)
  return err.message ? localizeMessage(err.message, r) : c.validationFailed
}
