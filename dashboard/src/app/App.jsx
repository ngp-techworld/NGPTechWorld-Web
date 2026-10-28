import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { LanguageProvider } from '@/i18n'
import { queryClient } from '@/lib/queryClient'
import { ConfirmProvider, ToastProvider } from '@/ui'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './AuthProvider'
import { ErrorBoundary } from './ErrorBoundary'

/** Everything that hooks and kit components rely on, in the required order. */
export function AppProviders({ children, client = queryClient }) {
  return (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}

/**
 * A data router (not <BrowserRouter>) so screens can guard unsaved changes with `useBlocker` (UnsavedChangesGuard).
 * It holds one catch-all route: the route table itself stays in <AppRoutes>, which builds it from the features the
 * signed-in admin may see. Render errors stay with our own ErrorBoundary rather than the router's default page.
 *
 * basename strips the deploy prefix (see vite.config.js's `base`) so every route below stays unprefixed ('/faqs',
 * '/login'…) — matches vite.config.js `base` and Vercel's proxy rewrite of that prefix to this app.
 */
const router = createBrowserRouter(
  [
    {
      path: '*',
      element: (
        <ErrorBoundary>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ErrorBoundary>
      ),
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
)

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
