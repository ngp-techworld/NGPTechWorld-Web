import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Languages, Lock, Mail } from 'lucide-react'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { ApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { errorText } from '@/lib/errors'
import { Alert, Button, Field, IconButton, Input } from '@/ui'
import { useAuth } from '../AuthProvider'
import { Brand } from '../layout/Brand'
import { MfaStep } from './MfaStep'
import strings from '../strings'

/**
 * Bilingual, branded sign-in page. POST /auth/login → token; 422 / 403 / 429 / network errors are shown in place. An
 * account with two-step sign-in answers with a challenge instead: the code step (MfaStep) finishes the sign-in.
 */
export function LoginPage() {
  const c = useCommon()
  const t = useStrings(strings)
  const { toggle } = useLanguage()
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [banner, setBanner] = useState('')
  const [mfa, setMfa] = useState(null) // { challenge, expiresIn } while the code step is open

  const schema = z.object({
    email: z.string().trim().min(1, t.emailRequired).email(c.invalidEmail),
    password: z.string().min(1, t.passwordRequired),
  })
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname ?? '/'} replace />

  const goOn = () => {
    const from = location.state?.from
    navigate(from ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true })
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setBanner('')
    try {
      const result = await login(email, password)
      if (result?.mfaRequired) {
        setMfa({ challenge: result.challenge, expiresIn: result.expiresIn })
        return
      }
      goOn()
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && applyServerErrors(setError, err)) {
        // the email was well-formed (client check), so a server error on it means wrong credentials
        if (err.errors.email) setError('email', { type: 'server', message: t.invalidCredentials })
      } else if (err instanceof ApiError && err.status === 403) setBanner(t.notAdmin)
      else if (err instanceof ApiError && err.status === 429) setBanner(t.tooManyAttempts(err.retryAfter))
      else setBanner(errorText(err, c))
    }
  })

  return (
    <div className="bg-page relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 start-[-10%] -z-10 size-[420px] rounded-full bg-accent/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 end-[-8%] -z-10 size-[380px] rounded-full bg-gold/10 blur-3xl" />

      <div className="absolute end-4 top-4">
        <Button variant="ghost" size="sm" icon={Languages} onClick={toggle} aria-label={c.switchLanguageLabel}>
          {c.switchLanguage}
        </Button>
      </div>

      <main className="w-full max-w-md">
        <div className="rounded-panel border border-white/[.1] bg-surface/80 p-7 shadow-pop backdrop-blur-md sm:p-9">
          <Brand size={36} />
          <h1 className="mt-7 text-2xl font-extrabold text-ink">{mfa ? t.mfaTitle : t.loginTitle}</h1>
          {mfa ? null : <p className="mt-1.5 text-sm text-muted">{t.loginSubtitle}</p>}

          {mfa ? (
            <MfaStep
              key={mfa.challenge}
              challenge={mfa.challenge}
              expiresIn={mfa.expiresIn}
              onDone={goOn}
              onStartOver={() => {
                setMfa(null)
                setValue('password', '')
              }}
            />
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
              {banner ? <Alert tone="danger">{banner}</Alert> : null}

              <Field label={t.email} error={errors.email} required>
                <Input type="email" autoComplete="username" autoFocus startIcon={Mail} {...register('email')} />
              </Field>

              <Field label={t.password} error={errors.password} required>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  startIcon={Lock}
                  endAdornment={<IconButton icon={showPassword ? EyeOff : Eye} size="sm" label={showPassword ? t.hidePassword : t.showPassword} onClick={() => setShowPassword((value) => !value)} />}
                  {...register('password')}
                />
              </Field>

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                {isSubmitting ? t.signingIn : t.signIn}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-faint">{t.loginFooter}</p>
      </main>
    </div>
  )
}
