import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useCommon } from '@/i18n'
import { PageSpinner } from '@/ui'
import { useAuth } from '../AuthProvider'
import { ErrorBoundary } from '../ErrorBoundary'
import { MfaNotice } from '../MfaNotice'
import { buildNav } from '../features'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// A dismissed enrolment notice stays dismissed for the browser session only (it is a reminder, not a setting).
const DISMISS_KEY = 'ngp_mfa_notice_dismissed'
function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}
function writeDismissed() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* storage unavailable: the notice comes back on the next visit */
  }
}

/** Authenticated shell: sidebar + top bar + the routed page (guarded by an error boundary and Suspense for lazy pages). */
export function AppLayout({ features }) {
  const c = useCommon()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const [mfaDismissed, setMfaDismissed] = useState(() => readDismissed())
  // the enrolment nudge (auth/me): not on the account page, which has the card itself
  const showMfaNotice = Boolean(user?.mfa_required && !user?.mfa_enabled) && !mfaDismissed && location.pathname !== '/account'
  const groups = useMemo(() => buildNav(features), [features])
  // The top bar's "My account" menu item links straight to the always-visible `account` feature (profile +
  // password) — unlike `users` (managing OTHER admins), it is never filtered out by permissions.js, so this
  // must not depend on whether `users` is present for the signed-in admin.
  const accountTo = features.some((feature) => feature.id === 'account') ? '/account' : undefined

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="bg-page min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {c.skipToContent}
      </a>
      <div className="flex min-h-screen">
        <Sidebar groups={groups} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} accountTo={accountTo} />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
            {showMfaNotice ? (
              <MfaNotice
                className="mb-5"
                onDismiss={() => {
                  setMfaDismissed(true)
                  writeDismissed()
                }}
              />
            ) : null}
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageSpinner />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
