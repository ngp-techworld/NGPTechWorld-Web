import { isUnreadableResponse } from '@/lib/api'
import { errorText } from '@/lib/errors'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',')
export const MAX_IMAGE_MB = 5

/** Client-side pre-check that mirrors the API rules, so obvious mistakes never cost an upload. */
export function validateImage(file, maxMB = MAX_IMAGE_MB) {
  if (!IMAGE_TYPES.includes(file.type)) return 'type'
  if (file.size > maxMB * 1024 * 1024) return 'size'
  return null
}

/** Localized message for a rejected file or a failed upload (prefers the server's `file` validation message). */
export function uploadErrorText(err, c, maxMB = MAX_IMAGE_MB) {
  if (err === 'type') return c.fileBadType
  if (err === 'size') return c.fileTooLarge(maxMB)
  // the file may be on the server, but without its path in the answer it cannot be used: upload it again
  if (isUnreadableResponse(err)) return c.uploadFailed
  const serverMessage = err?.status === 422 ? err.errors?.file?.[0] : null
  return serverMessage || errorText(err, c) || c.uploadFailed
}
