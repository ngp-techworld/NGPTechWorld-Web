/**
 * User-facing text for a failed request, in the current language. `c` is the common string table
 * (`useCommon()`); server messages are only shown for 4xx codes we have no dedicated text for.
 */
export function errorText(err, c) {
  const status = err?.status
  if (status === 0) return c.networkError
  if (isMfaRequired(err)) return c.mfaRequired
  if (status === 403) return c.forbidden
  if (status === 404) return c.notFound
  if (status === 422) return c.validationFailed
  if (status === 429) return c.tooManyRequests
  if (status >= 500) return c.serverError
  return err?.message || c.genericError
}

/**
 * The registry's two-step sign-in gate: `403 { message, code: 'mfa_enrollment_required' }` (internal and sensitive
 * registry data, the audit log, the member picker) for an account that must enrol and has not.
 */
export const isMfaRequired = (err) => err?.status === 403 && err?.data?.code === 'mfa_enrollment_required'
