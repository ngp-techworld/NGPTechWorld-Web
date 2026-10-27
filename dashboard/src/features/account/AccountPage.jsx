import { Suspense, lazy, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { useStrings } from '@/i18n'
import { PageHeader, PageSpinner, Spinner } from '@/ui'
import { PasswordForm } from './PasswordForm'
import { ProfileForm } from './ProfileForm'
import strings from './strings'

// with the QR library: loaded when the account page is opened, not with the dashboard
const MfaCard = lazy(() => import('./MfaCard'))

/** /account — the signed-in admin's own profile, password and two-step sign-in (the user comes from the auth context,
 * GET /auth/me). Reachable by every admin, including one with no section permissions at all. `/account#mfa` scrolls
 * to the two-step sign-in card (the links of the enrolment notices). */
export default function AccountPage() {
  const t = useStrings(strings)
  const { user } = useAuth()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash !== '#mfa') return undefined
    const timer = setTimeout(() => document.getElementById('mfa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(timer)
  }, [hash])

  return (
    <>
      {/* The Users list (and its back link here) is super-admin-only — a limited admin never sees it. */}
      <PageHeader title={t.accountTitle} description={t.accountDescription} backTo={user?.is_super_admin ? '/users' : undefined} backLabel={t.backToUsers} />
      {user ? (
        <div className="space-y-5">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {/* keyed by id: the form reads its defaults once */}
            <ProfileForm key={user.id} user={user} />
            <PasswordForm />
          </div>
          <Suspense fallback={<Spinner size={22} />}>
            <MfaCard />
          </Suspense>
        </div>
      ) : (
        <PageSpinner />
      )}
    </>
  )
}
