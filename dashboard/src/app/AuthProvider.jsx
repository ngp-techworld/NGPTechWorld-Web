import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler } from '@/lib/api'
import { clearToken, getToken, setToken } from '@/lib/storage'

export const AuthContext = createContext(null)

/**
 * Owns the session: the token lives in localStorage (`ngp_admin_token`), `user` comes from GET /auth/me.
 *
 * status: 'loading' (validating a stored token) | 'authenticated' | 'anonymous' | 'error' (server unreachable
 * while validating — the token is kept so a reload can succeed).
 * A 401 from any API call clears the session (api.js → setUnauthorizedHandler) and <ProtectedRoute> sends the
 * user to /login.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'anonymous'))
  const [attempt, setAttempt] = useState(0)

  const clearSession = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  useEffect(() => setUnauthorizedHandler(clearSession), [clearSession])

  // validate the stored token once (and again on retry)
  useEffect(() => {
    if (!getToken()) return undefined
    let cancelled = false
    setStatus('loading')
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return
        setUser(res.data)
        setStatus('authenticated')
      })
      .catch((err) => {
        if (cancelled || err.status === 401) return // 401 already cleared the session
        if (err.status === 403) clearSession()
        else setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, clearSession])

  // A token was issued: keep it, then read the full account from GET /auth/me (the login answer lacks the two-step
  // sign-in flags); if that read fails, the login's own copy of the user is used.
  const startSession = useCallback(async ({ token, user: loginUser }) => {
    setToken(token)
    let account = loginUser
    try {
      account = (await api.get('/auth/me')).data ?? loginUser
    } catch {
      /* keep the login response's user */
    }
    setUser(account)
    setStatus('authenticated')
    return account
  }, [])

  /**
   * Step one. Resolves with the user, or — for an account with two-step sign-in — with
   * `{ mfaRequired: true, challenge, expiresIn }` (no token yet; finish with loginMfa).
   */
  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password, device_name: 'ngp-dashboard' }, { auth: false })
      if (res.data?.mfa_required) return { mfaRequired: true, challenge: res.data.challenge, expiresIn: res.data.expires_in }
      return startSession(res.data)
    },
    [startSession],
  )

  /** Step two: the 6-digit authenticator code, or a recovery code. */
  const loginMfa = useCallback(
    async (challenge, code) => {
      const res = await api.post('/auth/login/mfa', { challenge, code }, { auth: false })
      return startSession(res.data)
    },
    [startSession],
  )

  /** Re-read the signed-in account (after turning two-step sign-in on or off). */
  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me')
    setUser(res.data)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* the token may already be invalid — we are signing out anyway */
    }
    clearSession()
  }, [clearSession])

  const updateUser = useCallback((patch) => setUser((current) => (current ? { ...current, ...patch } : current)), [])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === 'authenticated', isLoading: status === 'loading', login, loginMfa, logout, updateUser, refreshUser, retry }),
    [user, status, login, loginMfa, logout, updateUser, refreshUser, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * const { user, login, loginMfa, logout, updateUser, refreshUser, status, isAuthenticated } = useAuth()
 * `updateUser({ name })` refreshes the name shown in the top bar after a profile update.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>')
  return ctx
}
