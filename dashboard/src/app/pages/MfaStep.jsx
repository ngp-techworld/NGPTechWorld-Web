import { useEffect, useRef, useState } from 'react'
import { KeyRound, RotateCcw, ShieldCheck } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { ApiError } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { Alert, Button, Field, Input } from '@/ui'
import { useAuth } from '../AuthProvider'
import strings from '../strings'

/**
 * Second sign-in step (`POST auth/login/mfa {challenge, code}`): a 6-digit authenticator code, or a recovery code. A
 * wrong code can be retried with the same challenge; an expired or burned challenge (or the local 5-minute clock
 * running out) sends the visitor back to the password step. `onDone(user)` after the token is issued.
 */
export function MfaStep({ challenge, expiresIn, onDone, onStartOver }) {
  const c = useCommon()
  const t = useStrings(strings)
  const { loginMfa } = useAuth()
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [banner, setBanner] = useState('')
  const [ended, setEnded] = useState('') // 'expired' | 'burned'
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  // the challenge is good for `expires_in` seconds: past that, only starting over can work
  useEffect(() => {
    if (!expiresIn) return undefined
    const timer = setTimeout(() => setEnded((current) => current || 'expired'), expiresIn * 1000)
    return () => clearTimeout(timer)
  }, [expiresIn])

  useEffect(() => {
    input.current?.focus()
  }, [recovery])

  const switchMode = () => {
    setRecovery((value) => !value)
    setCode('')
    setFieldError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setBanner('')
    const value = recovery ? code.trim() : code.replace(/\s+/g, '')
    if (!value) return setFieldError(t.mfaCodeRequired)
    if (!recovery && !/^\d{6}$/.test(value)) return setFieldError(t.mfaCodeFormat)
    setFieldError('')
    setBusy(true)
    try {
      const user = await loginMfa(challenge, value)
      onDone(user)
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.status === 422 && err.errors.challenge) {
        setEnded(/too many/i.test(String(err.errors.challenge[0])) ? 'burned' : 'expired')
      } else if (err instanceof ApiError && err.status === 422) {
        setFieldError(t.mfaCodeInvalid)
        setCode('')
        input.current?.focus()
      } else if (err instanceof ApiError && err.status === 429) setBanner(t.tooManyAttempts(err.retryAfter))
      else setBanner(errorText(err, c))
    }
  }

  if (ended) {
    return (
      <div className="mt-7 space-y-4">
        <Alert tone="warning">{ended === 'burned' ? t.mfaBurned : t.mfaExpired}</Alert>
        <Button size="lg" className="w-full" icon={RotateCcw} onClick={onStartOver}>
          {t.mfaStartOver}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mt-7 space-y-4" aria-label={t.mfaTitle}>
      <p className="text-sm text-muted">{recovery ? t.mfaRecoverySubtitle : t.mfaSubtitle}</p>
      {banner ? <Alert tone="danger">{banner}</Alert> : null}
      <Field label={recovery ? t.mfaRecoveryCode : t.mfaCode} error={fieldError} required>
        <Input
          ref={input}
          key={recovery ? 'recovery' : 'totp'}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          dir="ltr"
          startIcon={recovery ? KeyRound : ShieldCheck}
          autoComplete="one-time-code"
          inputMode={recovery ? 'text' : 'numeric'}
          maxLength={recovery ? 20 : 7}
          spellCheck={false}
          autoCapitalize={recovery ? 'characters' : 'none'}
          placeholder={recovery ? 'XXXX-XXXX' : '123456'}
          className="font-mono tracking-widest"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {busy ? t.mfaVerifying : t.mfaVerify}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={switchMode}>
          {recovery ? t.mfaUseApp : t.mfaUseRecovery}
        </Button>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onStartOver}>
          {t.mfaStartOver}
        </Button>
      </div>
    </form>
  )
}
