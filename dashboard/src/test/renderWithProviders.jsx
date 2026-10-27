import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext } from '@/app/AuthProvider'
import { LanguageProvider } from '@/i18n'
import { ConfirmProvider, ToastProvider } from '@/ui'

// Full access by default (role/permissions were added after most tests were written) — a test that needs a
// limited admin passes its own `authUser: { ...testUser, is_super_admin: false, role: 'admin', permissions: [...] }`.
export const testUser = { id: 1, name: 'Admin', email: 'admin@ngptechworld.com', role: 'super_admin', is_super_admin: true, permissions: [] }

/** A QueryClient without retries and without garbage-collection timers, so tests are deterministic. */
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 0 }, mutations: { retry: false } } })
}

/** Shows the current URL: expect(screen.getByTestId('location')).toHaveTextContent('/faqs') */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location" hidden>{`${location.pathname}${location.search}`}</div>
}

/**
 * Renders `ui` inside every provider the app has (react-query, language, toast, confirm, router, auth).
 *
 *   const { user, queryClient } = renderWithProviders(<FaqList />, { route: '/faqs?page=2' })
 *   renderWithProviders(<FaqEdit />, { route: '/faqs/7', path: '/faqs/:id' })   // `path` makes useParams work
 *
 * Options: route ('/'), path (route pattern for `ui`), lang ('en' — tests read English strings; pass 'ar' to
 * test RTL), queryClient, authUser (the signed-in user given to useAuth(); null = anonymous), auth (extra/override
 * fields of the auth context, e.g. { logout: vi.fn() }). Returns RTL's result plus `user` (user-event, already
 * set up) and `queryClient`. Use `mockApi()` for the network and a real AuthProvider only in auth tests.
 */
export function renderWithProviders(ui, { route = '/', path, lang = 'en', queryClient, authUser = testUser, auth, ...options } = {}) {
  const client = queryClient ?? createTestQueryClient()
  const authValue = {
    user: authUser,
    status: authUser ? 'authenticated' : 'anonymous',
    isAuthenticated: Boolean(authUser),
    isLoading: false,
    login: vi.fn(),
    loginMfa: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    refreshUser: vi.fn(async () => authUser),
    retry: vi.fn(),
    ...auth,
  }

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <LanguageProvider initialLang={lang}>
          <ToastProvider>
            <ConfirmProvider>
              <MemoryRouter initialEntries={[route]}>
                <AuthContext.Provider value={authValue}>
                  {path ? (
                    <Routes>
                      <Route path={path} element={children} />
                      <Route path="*" element={null} />
                    </Routes>
                  ) : (
                    children
                  )}
                  <LocationProbe />
                </AuthContext.Provider>
              </MemoryRouter>
            </ConfirmProvider>
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), user: userEvent.setup(), queryClient: client }
}

/** Wrapper for renderHook(): renderHook(() => faqs.useList(), { wrapper: createWrapper() }) */
export function createWrapper({ lang = 'en', queryClient } = {}) {
  const client = queryClient ?? createTestQueryClient()
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <LanguageProvider initialLang={lang}>
          <ToastProvider>
            <ConfirmProvider>
              <MemoryRouter>{children}</MemoryRouter>
            </ConfirmProvider>
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    )
  }
}
