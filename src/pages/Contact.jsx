import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useLang } from '../i18n/LanguageContext'
import { useSiteSettings, SOCIAL_KEYS } from '../lib/SiteSettings'
import { toHttpUrl } from '../lib/url'
import Icon from '../components/Icon'
import PageTitle from '../components/PageTitle'
import Select from '../components/Select'

// w-full: each field is now wrapped in its own <div> (to hold the error text below it), so the <input>/
// <textarea> is no longer a direct flex child of the form and loses the free full-width stretch that came
// from the form's `align-items: stretch` — it must be told to fill its wrapper explicitly instead.
const inputCls = 'w-full rounded-[11px] border border-white/[.14] px-4 py-3.5 text-[14.5px] text-white outline-none'
const inputStyle = { background: 'rgba(26,15,38,.6)' }
const EMPTY_FORM = { service_id: '', name: '', phone: '', email: '', title: '', description: '' }
const COOLDOWN_SECONDS = 60

// The dashboard's own rule for a project slug (Admin\ProjectController).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// StoreContactRequest caps `title` at 150; a project name may be up to 255.
const TITLE_MAX = 150

/** "A project like «name»", with the name shortened (…) so the whole title fits what the server accepts. */
function aboutProjectTitle(t, name) {
  const full = t.contactAboutProject(name)
  if (full.length <= TITLE_MAX) return full
  const room = TITLE_MAX - t.contactAboutProject('').length - 1
  return t.contactAboutProject(`${name.slice(0, Math.max(room, 0)).trimEnd()}…`)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s().-]*$/
const phoneDigitCount = (v) => (v.match(/\d/g) || []).length

function validate(form, t) {
  const errors = {}
  if (!form.service_id) errors.service_id = t.errRequired
  if (!form.name.trim()) errors.name = t.errRequired
  if (!form.phone.trim()) errors.phone = t.errRequired
  else if (!PHONE_RE.test(form.phone.trim()) || phoneDigitCount(form.phone) < 7) errors.phone = t.errPhoneInvalid
  if (!form.email.trim()) errors.email = t.errRequired
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = t.errEmailInvalid
  if (!form.title.trim()) errors.title = t.errRequired
  if (!form.description.trim()) errors.description = t.errRequired
  else if (form.description.trim().length < 5) errors.description = t.errDescriptionShort
  return errors
}

function FieldError({ id, text }) {
  if (!text) return null
  return (
    <p id={id} className="mt-1.5 text-[12.5px]" style={{ color: '#F3B4B4' }}>
      {text}
    </p>
  )
}

export default function Contact() {
  const { t, pick } = useLang()
  const settings = useSiteSettings()
  const [searchParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => { api.getServices().then(setServices).catch(() => setServices([])) }, [])

  // /contact?service=mobile-apps arrives with the service already chosen. These links go into
  // adverts and messages, so the slug is what they carry; the id is accepted too because it is
  // stable even when nobody has given the service a slug yet.
  //
  // It waits for the list rather than reading the URL once: the select has no options until the
  // API answers, so applying it on mount would set a value that is not there yet. An unknown
  // value is simply ignored — a mistyped link should open an ordinary contact form, not an error.
  useEffect(() => {
    const wanted = searchParams.get('service')
    if (!wanted || services.length === 0) return
    const match = services.find((s) => s.slug === wanted || String(s.id) === wanted)
    // Never overwrite a choice already made — the list can arrive after the visitor has picked.
    if (match) setForm((f) => (f.service_id ? f : { ...f, service_id: String(match.id) }))
  }, [searchParams, services])

  // /contact?project=falcon-store comes from "Discuss a similar project" on a project page: the
  // request title opens already naming it. Same rules as ?service= — wait for the project to load,
  // never overwrite a title the visitor has typed, and ignore a slug that leads nowhere.
  // Only a real slug (the shape the dashboard enforces) is looked up: anything else, such as
  // "../team/someone", could otherwise steer the request to a different endpoint.
  const projectSlug = SLUG_RE.test(searchParams.get('project') ?? '') ? searchParams.get('project') : null
  const [aboutProject, setAboutProject] = useState(null)
  const prefilled = useRef(false)

  useEffect(() => {
    if (!projectSlug) return undefined
    let live = true
    api.getProject(projectSlug)
      .then((p) => { if (live && p) setAboutProject(p) })
      .catch(() => {})
    return () => { live = false }
  }, [projectSlug])

  useEffect(() => {
    const name = aboutProject ? pick(aboutProject, 'name') : ''
    if (!name || prefilled.current) return
    prefilled.current = true
    setForm((f) => (f.title.trim() ? f : { ...f, title: aboutProjectTitle(t, name) }))
  }, [aboutProject, pick, t])

  // Ticks the post-send cooldown down to 0, one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Only social links that were filled in from the dashboard are shown.
  const socials = SOCIAL_KEYS
    .map((key) => ({ key, label: t.socialMeta[key], url: toHttpUrl(settings[key]) }))
    .filter((s) => s.url)

  // Accepts either a DOM change event (native inputs) or a raw value (the custom Select), so every
  // field can share one setter.
  const set = (k) => (eOrValue) => {
    const value = eOrValue && typeof eOrValue === 'object' && 'target' in eOrValue ? eOrValue.target.value : eOrValue
    setForm((f) => ({ ...f, [k]: value }))
    setFieldErrors((errs) => (errs[k] ? { ...errs, [k]: undefined } : errs))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy || cooldown > 0) return
    setError('')
    const errors = validate(form, t)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    try {
      await api.postContact(form)
      setSent(true)
      setForm(EMPTY_FORM)
      setCooldown(COOLDOWN_SECONDS)
      setTimeout(() => setSent(false), 2600)
    } catch (err) {
      if (err.status === 422 && err.body?.errors) {
        // Server-side field errors (e.g. a service id that no longer exists) land under the same fields.
        const mapped = {}
        for (const [field, msgs] of Object.entries(err.body.errors)) mapped[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        setFieldErrors(mapped)
      } else {
        setError(err.status === 422 ? t.errValidation : err.status === 429 ? t.errThrottle : t.errGeneric)
      }
    } finally { setBusy(false) }
  }

  const buttonLabel = busy ? t.sending : sent ? t.sent : cooldown > 0 ? t.cooldownWait(cooldown) : t.submit

  return (
    <div className="view-enter mx-auto max-w-[1100px] px-[26px] pb-[90px] pt-[70px]">
      <PageTitle title={t.contactTitle} description={t.contactSub} />
      <div className="mb-[50px] text-center">
        <div className="mb-2.5 font-mono text-[13px] text-accent-light">// {t.navContact}</div>
        <h1 className="mb-3.5 text-[44px] font-extrabold">{t.contactTitle}</h1>
        <p className="mx-auto max-w-[540px] text-[17px] text-muted">{t.contactSub}</p>
      </div>

      <div data-grid2 className="grid gap-6" style={{ gridTemplateColumns: '.85fr 1.15fr' }}>
        <div className="flex flex-col gap-4">
          {settings.email && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] p-[18px]">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px]" style={{ background: 'rgba(107,78,142,.3)' }}>
                <Icon path='<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/>' size={19} stroke="#9678BE" />
              </div>
              <div><div className="text-[12px] text-faint">{t.cEmail}</div><div className="text-[14.5px]" dir="ltr">{settings.email}</div></div>
            </div>
          )}
          {settings.phone && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] p-[18px]">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px]" style={{ background: 'rgba(107,78,142,.3)' }}>
                <Icon path='<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>' size={19} stroke="#9678BE" />
              </div>
              <div><div className="text-[12px] text-faint">{t.cPhone}</div><div className="text-[14.5px]" dir="ltr">{settings.phone}</div></div>
            </div>
          )}
          {socials.length > 0 && (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] p-[18px]">
              <div className="mb-3 text-[12px] text-faint">{t.cFollow}</div>
              <div className="flex flex-wrap gap-2.5">
                {socials.map((s) => (
                  <a key={s.key} href={s.url} target="_blank" rel="noreferrer" className="glink rounded-full border border-white/[.14] bg-white/[.03] px-4 py-2 text-[13px] text-[#D8CEE6]">{s.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5 rounded-card border border-[var(--border)] bg-[var(--card-bg)] p-[30px]">
          <div>
            <Select
              id="service-select"
              ariaLabel={t.fService}
              placeholder={t.fService}
              invalid={Boolean(fieldErrors.service_id)}
              describedBy={fieldErrors.service_id ? 'service-error' : undefined}
              value={form.service_id}
              onChange={set('service_id')}
              options={services.map((s) => ({ value: String(s.id), label: pick(s, 'title') }))}
              className={inputCls}
              style={inputStyle}
            />
            <FieldError id="service-error" text={fieldErrors.service_id} />
          </div>

          <div data-grid2 className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <input
                placeholder={t.fName}
                value={form.name}
                onChange={set('name')}
                aria-invalid={fieldErrors.name ? 'true' : undefined}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                className={inputCls}
                style={inputStyle}
              />
              <FieldError id="name-error" text={fieldErrors.name} />
            </div>
            <div>
              <input
                placeholder={t.fPhone}
                value={form.phone}
                onChange={set('phone')}
                dir="ltr"
                inputMode="tel"
                aria-invalid={fieldErrors.phone ? 'true' : undefined}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                className={inputCls}
                style={{ ...inputStyle, textAlign: 'start' }}
              />
              <FieldError id="phone-error" text={fieldErrors.phone} />
            </div>
          </div>

          <div>
            <input
              type="email"
              placeholder={t.fEmail}
              value={form.email}
              onChange={set('email')}
              dir="ltr"
              aria-invalid={fieldErrors.email ? 'true' : undefined}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={inputCls}
              style={{ ...inputStyle, textAlign: 'start' }}
            />
            <FieldError id="email-error" text={fieldErrors.email} />
          </div>

          <div>
            <input
              placeholder={t.fTitle}
              value={form.title}
              onChange={set('title')}
              aria-invalid={fieldErrors.title ? 'true' : undefined}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
              className={inputCls}
              style={inputStyle}
            />
            <FieldError id="title-error" text={fieldErrors.title} />
          </div>

          <div>
            <textarea
              rows={5}
              placeholder={t.fDescription}
              value={form.description}
              onChange={set('description')}
              aria-invalid={fieldErrors.description ? 'true' : undefined}
              aria-describedby={fieldErrors.description ? 'description-error' : undefined}
              className={`${inputCls} resize-y`}
              style={inputStyle}
            />
            <FieldError id="description-error" text={fieldErrors.description} />
          </div>

          {error && (
            <div role="alert" className="rounded-[11px] px-4 py-3 text-[14px]"
              style={{ background: 'rgba(220,80,80,.12)', border: '1px solid rgba(220,80,80,.4)', color: '#F3B4B4' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={busy || cooldown > 0} className="btn-p rounded-[11px] border-none bg-accent py-[15px] text-[15px] font-semibold text-white">
            {buttonLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
