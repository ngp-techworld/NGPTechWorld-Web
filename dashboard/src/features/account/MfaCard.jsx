import { useEffect, useState } from 'react'
import { Copy, Download, KeyRound, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useCommon, useStrings } from '@/i18n'
import { ApiError, api, saveBlob } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { Alert, Badge, Button, Card, Checkbox, Field, Input, PasswordInput, Spinner, useToast } from '@/ui'
import strings from './strings'

// Two-step sign-in (TOTP) of the signed-in account: `POST auth/mfa/setup | confirm | disable | recovery-codes`.
// The secret and the recovery codes live only in this component's state while they are on screen: never logged,
// never stored, dropped as soon as the step ends.

/** The QR code of an otpauth:// URL, drawn here (the `qrcode` package, loaded with this card; no network). */
function QrImage({ value }) {
  const t = useStrings(strings)
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QRCode) => QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
      .then((markup) => !cancelled && setSvg(markup))
    return () => {
      cancelled = true
    }
  }, [value])
  if (!svg) {
    return (
      <div className="flex size-48 items-center justify-center rounded-xl bg-white/[.04] text-accent-lighter">
        <Spinner size={22} label={t.mfaQrLoading} />
      </div>
    )
  }
  // an <img> of the generated SVG: no markup of ours is injected into the page
  return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={t.mfaQrAlt} width={192} height={192} className="rounded-xl bg-white p-2" />
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
  await navigator.clipboard.writeText(text)
}

/** The 8 one-time recovery codes, shown once: copy, download, and "I saved them" before closing. */
function RecoveryCodes({ codes, onDone }) {
  const t = useStrings(strings)
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const text = codes.join('\n')
  const copy = () =>
    copyText(text).then(
      () => toast.success(t.mfaCopied),
      () => toast.error(t.mfaCopyFailed),
    )
  const download = () => saveBlob(new Blob([`${t.mfaCodesFileTitle}\n\n${text}\n`], { type: 'text/plain;charset=utf-8' }), 'ngp-recovery-codes.txt')

  return (
    <section aria-label={t.mfaCodesTitle} className="space-y-4">
      <h3 className="text-sm font-bold text-ink">{t.mfaCodesTitle}</h3>
      <Alert tone="warning">{t.mfaCodesIntro}</Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-white/[.08] bg-white/[.03] p-4 font-mono text-sm tracking-wider text-ink" dir="ltr">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>
          {t.mfaCodesCopy}
        </Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={download}>
          {t.mfaCodesDownload}
        </Button>
      </div>
      <Checkbox label={t.mfaCodesSaved} checked={saved} onChange={setSaved} />
      <div className="flex justify-end">
        <Button onClick={onDone} disabled={!saved}>
          {t.mfaCodesDone}
        </Button>
      </div>
    </section>
  )
}

/** Scan, type the first code, get the recovery codes. */
function SetupStep({ setup, onConfirmed, onRestart, onCancel }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), (setup.expires_in ?? 600) * 1000)
    return () => clearTimeout(timer)
  }, [setup])

  const confirm = async (event) => {
    event.preventDefault()
    const value = code.replace(/\s+/g, '')
    if (!/^\d{6}$/.test(value)) return setError(t.mfaCodeFormat)
    setError('')
    setBusy(true)
    try {
      const res = await api.post('/auth/mfa/confirm', { code: value })
      onConfirmed(res.data.recovery_codes)
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.status === 422 && err.errors.setup) setExpired(true)
      else if (err instanceof ApiError && err.status === 422) {
        setError(t.mfaCodeInvalid)
        setCode('')
      } else toast.error(err?.status === 409 ? t.mfaAlreadyOn : errorText(err, c))
    }
  }

  if (expired) {
    return (
      <div className="space-y-3">
        <Alert tone="warning">{t.mfaSetupExpired}</Alert>
        <div className="flex gap-2">
          <Button icon={RefreshCw} onClick={onRestart}>
            {t.mfaRestart}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {c.cancel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={confirm} noValidate className="space-y-4">
      <p className="text-sm text-soft">{t.mfaScan}</p>
      <div className="flex flex-wrap items-start gap-5">
        <QrImage value={setup.otpauth_url} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[13px] font-semibold text-soft">{t.mfaSecret}</p>
          <p dir="ltr" className="break-all rounded-lg bg-white/[.04] px-3 py-2 font-mono text-sm tracking-wider text-ink">
            {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
          </p>
          <Button size="sm" variant="ghost" icon={Copy} onClick={() => copyText(setup.secret).then(() => toast.success(t.mfaCopied), () => toast.error(t.mfaCopyFailed))}>
            {t.mfaCopySecret}
          </Button>
        </div>
      </div>
      <p className="text-sm text-soft">{t.mfaEnterCode}</p>
      <Field label={t.mfaCode} error={error} required className="max-w-xs">
        <Input value={code} onChange={(event) => setCode(event.target.value)} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" className="font-mono tracking-widest" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={ShieldCheck} loading={busy}>
          {t.mfaConfirm}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {c.cancel}
        </Button>
      </div>
    </form>
  )
}

/** Password + a code (authenticator or recovery): turning it off, or replacing the recovery codes. */
function ProveItsYou({ action, onDone, onCancel }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const disabling = action === 'disable'

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!password) next.password = c.required
    if (!code.trim()) next.code = c.required
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const res = await api.post(disabling ? '/auth/mfa/disable' : '/auth/mfa/recovery-codes', { password, code: code.trim() })
      onDone(res?.data?.recovery_codes ?? null)
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.status === 422) {
        setErrors({ password: err.errors.password ? t.mfaPasswordWrong : undefined, code: err.errors.code ? t.mfaCodeInvalid : undefined })
        if (err.errors.code) setCode('')
      } else toast.error(err?.status === 409 ? t.mfaNotOn : errorText(err, c))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={disabling ? t.mfaDisable : t.mfaRegenerate}>
      <p className="text-sm text-soft">{t.mfaPasswordAndCode}</p>
      {disabling ? <Alert tone="warning">{t.mfaDisableWarning}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.mfaPassword} error={errors.password} required>
          <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" showLabel={t.showPassword} hideLabel={t.hidePassword} />
        </Field>
        <Field label={t.mfaCodeOrRecovery} error={errors.code} required>
          <Input value={code} onChange={(event) => setCode(event.target.value)} dir="ltr" autoComplete="one-time-code" maxLength={20} className="font-mono tracking-widest" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={disabling ? 'danger' : 'primary'} icon={disabling ? ShieldOff : KeyRound} loading={busy}>
          {disabling ? t.mfaDisable : t.mfaRegenerate}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {c.cancel}
        </Button>
      </div>
    </form>
  )
}

/** The account page's two-step sign-in card (lazy, with the QR library). */
export default function MfaCard() {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const { user, updateUser, refreshUser } = useAuth()
  const enabled = Boolean(user?.mfa_enabled)
  const [step, setStep] = useState('idle') // idle | setup | codes | disable | regenerate
  const [setup, setSetup] = useState(null)
  const [codes, setCodes] = useState(null)
  const [busy, setBusy] = useState(false)

  const reread = () => refreshUser?.().catch(() => {})
  const finish = () => {
    setSetup(null)
    setCodes(null)
    setStep('idle')
  }

  const startSetup = async () => {
    setBusy(true)
    try {
      const res = await api.post('/auth/mfa/setup')
      setSetup(res.data)
      setStep('setup')
    } catch (err) {
      if (err?.status === 409) {
        toast.info(t.mfaAlreadyOn)
        reread()
      } else toast.error(errorText(err, c))
    } finally {
      setBusy(false)
    }
  }

  let body
  if (step === 'setup' && setup) {
    body = (
      <SetupStep
        key={setup.secret}
        setup={setup}
        onRestart={startSetup}
        onCancel={finish}
        onConfirmed={(recoveryCodes) => {
          setSetup(null) // the secret leaves the screen as soon as it is confirmed
          setCodes(recoveryCodes)
          setStep('codes')
          updateUser({ mfa_enabled: true })
          toast.success(t.mfaEnabled)
        }}
      />
    )
  } else if (step === 'codes' && codes) {
    body = (
      <RecoveryCodes
        codes={codes}
        onDone={() => {
          finish()
          reread()
        }}
      />
    )
  } else if (step === 'disable' || step === 'regenerate') {
    body = (
      <ProveItsYou
        action={step}
        onCancel={finish}
        onDone={(recoveryCodes) => {
          if (step === 'disable') {
            updateUser({ mfa_enabled: false })
            toast.success(t.mfaDisabled)
            finish()
            reread()
          } else {
            toast.success(t.mfaRegenerated)
            setCodes(recoveryCodes)
            setStep('codes')
          }
        }}
      />
    )
  } else {
    body = enabled ? (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={KeyRound} onClick={() => setStep('regenerate')}>
          {t.mfaRegenerate}
        </Button>
        <Button variant="ghost" icon={ShieldOff} onClick={() => setStep('disable')}>
          {t.mfaDisable}
        </Button>
      </div>
    ) : (
      <Button icon={ShieldCheck} onClick={startSetup} loading={busy}>
        {t.mfaEnable}
      </Button>
    )
  }

  return (
    <Card
      id="mfa"
      title={t.mfaTitle}
      description={t.mfaDescription}
      aria-label={t.mfaTitle}
      actions={
        <Badge tone={enabled ? 'success' : 'neutral'} dot>
          <span className="sr-only">{t.mfaStatus}: </span>
          {enabled ? t.mfaOn : t.mfaOff}
        </Badge>
      }
    >
      <div className="space-y-4">
        {!enabled && user?.mfa_required && step === 'idle' ? <Alert tone="warning">{t.mfaRequiredHint}</Alert> : null}
        {body}
      </div>
    </Card>
  )
}
