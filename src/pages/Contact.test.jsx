import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { LanguageProvider } from '../i18n/LanguageContext'
import { SiteSettingsProvider, DEFAULT_SETTINGS } from '../lib/SiteSettings'
import { ui } from '../i18n/ui'
import { api } from '../lib/api'
import Contact from './Contact'

vi.mock('../lib/api', () => ({ api: { postContact: vi.fn(), getSettings: vi.fn(), getServices: vi.fn(), getProject: vi.fn() } }))

const t = ui.ar
const settings = { ...DEFAULT_SETTINGS, email: 'hello@example.com', phone: '+1 555 0100' }
const services = [
  { id: 1, slug: 'web-design', title_ar: 'تصميم مواقع', title_en: 'Web design' },
  { id: 4, slug: 'mobile-apps', title_ar: 'تطبيقات الموبايل', title_en: 'Mobile Apps' },
]

// The page reads ?service= off the URL, so it needs a router even for the tests that do not.
const renderContact = (url = '/contact') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LanguageProvider>
        <SiteSettingsProvider>
          <Contact />
        </SiteSettingsProvider>
      </LanguageProvider>
    </MemoryRouter>,
  )

/** The label the service button shows — the placeholder until something is chosen. */
const chosenService = () => screen.getByRole('button', { name: /تصميم مواقع|تطبيقات الموبايل|اختر الخدمة/ }).textContent

async function selectService(label = 'تصميم مواقع') {
  fireEvent.click(screen.getByRole('button', { name: t.fService }))
  fireEvent.click(await screen.findByRole('option', { name: label }))
}

async function fillAndSubmit() {
  await selectService()
  fireEvent.change(screen.getByPlaceholderText(t.fName), { target: { value: 'Ali' } })
  fireEvent.change(screen.getByPlaceholderText(t.fPhone), { target: { value: '+963 900 000 000' } })
  fireEvent.change(screen.getByPlaceholderText(t.fEmail), { target: { value: 'ali@example.com' } })
  fireEvent.change(screen.getByPlaceholderText(t.fTitle), { target: { value: 'App request' } })
  fireEvent.change(screen.getByPlaceholderText(t.fDescription), { target: { value: 'Hello there, I need an app' } })
  fireEvent.click(screen.getByRole('button', { name: t.submit }))
}

const httpError = (status, body) => Object.assign(new Error(`API ${status}`), { status, body })

beforeEach(() => {
  localStorage.clear() // SiteSettings caches the last answer; every test starts as a first visit
  api.getSettings.mockReset().mockResolvedValue(settings)
  api.getServices.mockReset().mockResolvedValue(services)
  api.postContact.mockReset()
  api.getProject.mockReset().mockRejectedValue(Object.assign(new Error('API 404'), { status: 404 }))
})

describe('sending the form', () => {
  test('sends the chosen service, title and description alongside the contact details', async () => {
    api.postContact.mockResolvedValue({ message: 'received' })
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByRole('button', { name: t.sent })).toBeInTheDocument()
    expect(api.postContact).toHaveBeenCalledWith({
      service_id: '1', name: 'Ali', phone: '+963 900 000 000', email: 'ali@example.com',
      title: 'App request', description: 'Hello there, I need an app',
    })
  })

  test('shows a confirmation and clears the form on success', async () => {
    api.postContact.mockResolvedValue({ message: 'received' })
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByRole('button', { name: t.sent })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByPlaceholderText(t.fName)).toHaveValue('')
  })

  test('explains a validation error (422 with no field detail) and keeps what was typed', async () => {
    api.postContact.mockRejectedValue(httpError(422))
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errValidation)
    expect(screen.getByPlaceholderText(t.fName)).toHaveValue('Ali')
  })

  test('maps a 422 with field details to the matching field, below the input', async () => {
    api.postContact.mockRejectedValue(httpError(422, { errors: { service_id: ['The selected service is invalid.'] } }))
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByText('The selected service is invalid.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull() // no generic banner when a field error covers it
  })

  test('explains the rate limit (429)', async () => {
    api.postContact.mockRejectedValue(httpError(429))
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errThrottle)
  })

  test('shows a generic error when the server cannot be reached', async () => {
    api.postContact.mockRejectedValue(new TypeError('Failed to fetch'))
    renderContact()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errGeneric)
  })

  test('cannot send again for a minute after a successful submit, even by forcing the form', async () => {
    api.postContact.mockResolvedValue({ message: 'received' })
    const { container } = renderContact()
    await fillAndSubmit()
    const button = await screen.findByRole('button', { name: t.sent })
    expect(button).toBeDisabled()

    fireEvent.submit(container.querySelector('form'))

    expect(api.postContact).toHaveBeenCalledTimes(1)
  })
})

describe('client-side validation', () => {
  test('requires every field and shows each error below its own input, without calling the API', async () => {
    renderContact()

    fireEvent.click(screen.getByRole('button', { name: t.submit }))

    expect(await screen.findAllByText(t.errRequired)).toHaveLength(6)
    expect(api.postContact).not.toHaveBeenCalled()
  })

  test('rejects a phone number that is not a number, with the error under the phone field', async () => {
    renderContact()
    await selectService()
    fireEvent.change(screen.getByPlaceholderText(t.fName), { target: { value: 'Ali' } })
    fireEvent.change(screen.getByPlaceholderText(t.fPhone), { target: { value: 'not a phone number' } })
    fireEvent.change(screen.getByPlaceholderText(t.fEmail), { target: { value: 'ali@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(t.fTitle), { target: { value: 'App request' } })
    fireEvent.change(screen.getByPlaceholderText(t.fDescription), { target: { value: 'Hello there, I need an app' } })

    fireEvent.click(screen.getByRole('button', { name: t.submit }))

    const phoneError = await screen.findByText(t.errPhoneInvalid)
    expect(phoneError.id).toBe('phone-error')
    expect(screen.getByPlaceholderText(t.fPhone)).toHaveAttribute('aria-describedby', 'phone-error')
    expect(api.postContact).not.toHaveBeenCalled()
  })

  test('accepts a phone number with spaces, plus sign and parentheses', async () => {
    api.postContact.mockResolvedValue({ message: 'received' })
    renderContact()
    await selectService()
    fireEvent.change(screen.getByPlaceholderText(t.fName), { target: { value: 'Ali' } })
    fireEvent.change(screen.getByPlaceholderText(t.fPhone), { target: { value: '+963 (933) 069-105' } })
    fireEvent.change(screen.getByPlaceholderText(t.fEmail), { target: { value: 'ali@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(t.fTitle), { target: { value: 'App request' } })
    fireEvent.change(screen.getByPlaceholderText(t.fDescription), { target: { value: 'Hello there, I need an app' } })

    fireEvent.click(screen.getByRole('button', { name: t.submit }))

    expect(await screen.findByRole('button', { name: t.sent })).toBeInTheDocument()
    expect(screen.queryByText(t.errPhoneInvalid)).toBeNull()
  })

  test('clears a field error as soon as it is edited', async () => {
    renderContact()
    fireEvent.click(screen.getByRole('button', { name: t.submit }))
    await screen.findAllByText(t.errRequired)

    fireEvent.change(screen.getByPlaceholderText(t.fName), { target: { value: 'A' } })

    expect(screen.getByPlaceholderText(t.fName)).not.toHaveAttribute('aria-invalid')
  })
})

describe('contact details from the dashboard', () => {
  test('shows the email, phone and only the social links that are filled in', async () => {
    api.getSettings.mockResolvedValue({ ...settings, facebook: 'https://facebook.com/ngp' })
    renderContact()
    expect(await screen.findByText('hello@example.com')).toBeInTheDocument()
    expect(screen.getByText('+1 555 0100')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.socialMeta.facebook })).toHaveAttribute('href', 'https://facebook.com/ngp')
    expect(screen.queryByText(t.socialMeta.instagram)).toBeNull()
  })

  test('hides the follow-us card when no social link is set', async () => {
    renderContact()
    await screen.findByText('hello@example.com')
    expect(screen.queryByText(t.cFollow)).toBeNull()
  })

  test('ignores a social link that is not an http(s) URL', async () => {
    api.getSettings.mockResolvedValue({ ...settings, x: 'javascript:alert(1)' })
    renderContact()
    await screen.findByText('hello@example.com')
    expect(screen.queryByText(t.socialMeta.x)).toBeNull()
  })

  test('falls back to the default contact details when the API is unreachable', () => {
    api.getSettings.mockRejectedValue(new Error('down'))
    renderContact()
    expect(screen.getByText(DEFAULT_SETTINGS.email)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_SETTINGS.phone)).toBeInTheDocument()
  })
})

describe('service picker', () => {
  test('lists every service, labeled in the current language, styled like the rest of the site', async () => {
    renderContact()
    fireEvent.click(await screen.findByRole('button', { name: t.fService }))
    expect(await screen.findByRole('option', { name: 'تصميم مواقع' })).toBeInTheDocument()
  })

  test('still renders the form when the services list cannot be loaded', async () => {
    api.getServices.mockRejectedValue(new Error('down'))
    renderContact()
    expect(await screen.findByPlaceholderText(t.fName)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.fService })).toBeInTheDocument()
  })
})

describe('a link that names a service', () => {
  beforeEach(() => {
    api.getSettings.mockResolvedValue(settings)
    api.getServices.mockResolvedValue(services)
  })

  it('opens with that service chosen', async () => {
    renderContact('/contact?service=mobile-apps')

    await waitFor(() => expect(chosenService()).toContain('تطبيقات الموبايل'))
  })

  it('accepts the id too, for a service that has no slug yet', async () => {
    renderContact('/contact?service=4')

    await waitFor(() => expect(chosenService()).toContain('تطبيقات الموبايل'))
  })

  it('waits for the list instead of setting a value that is not there yet', async () => {
    // The select is empty until the API answers; reading the URL on mount alone would choose
    // nothing and then never try again.
    let release
    api.getServices.mockReturnValue(new Promise((resolve) => { release = resolve }))
    renderContact('/contact?service=mobile-apps')

    expect(chosenService()).toBe(t.fService)
    await act(async () => { release(services) })
    await waitFor(() => expect(chosenService()).toContain('تطبيقات الموبايل'))
  })

  it('ignores a name no service answers to, rather than showing an error', async () => {
    renderContact('/contact?service=does-not-exist')

    await waitFor(() => expect(api.getServices).toHaveBeenCalled())
    expect(chosenService()).toBe(t.fService)
  })

  it('leaves the form alone when the link names nothing', async () => {
    renderContact('/contact')

    await waitFor(() => expect(api.getServices).toHaveBeenCalled())
    expect(chosenService()).toBe(t.fService)
  })

  it('preselects without locking — the visitor can still change it', async () => {
    renderContact('/contact?service=mobile-apps')
    await waitFor(() => expect(chosenService()).toContain('تطبيقات الموبايل'))

    await selectService('تصميم مواقع')
    expect(chosenService()).toContain('تصميم مواقع')
  })
})

describe('a link from a project page', () => {
  const project = { slug: 'falcon-store', name_ar: 'متجر الصقر', name_en: 'Falcon Store' }

  it('opens with the request title naming that project', async () => {
    api.getProject.mockResolvedValue(project)
    renderContact('/contact?project=falcon-store')

    await waitFor(() => expect(screen.getByPlaceholderText(t.fTitle)).toHaveValue(t.contactAboutProject('متجر الصقر')))
    expect(api.getProject).toHaveBeenCalledWith('falcon-store')
  })

  it('names the project in the reading language', async () => {
    localStorage.setItem('ngp.lang', 'en')
    api.getProject.mockResolvedValue(project)
    renderContact('/contact?project=falcon-store')

    await waitFor(() => expect(screen.getByPlaceholderText(ui.en.fTitle)).toHaveValue(ui.en.contactAboutProject('Falcon Store')))
  })

  it('never overwrites a title the visitor has already typed', async () => {
    let release
    api.getProject.mockReturnValue(new Promise((resolve) => { release = resolve }))
    renderContact('/contact?project=falcon-store')

    fireEvent.change(screen.getByPlaceholderText(t.fTitle), { target: { value: 'My own title' } })
    await act(async () => { release(project) })

    expect(screen.getByPlaceholderText(t.fTitle)).toHaveValue('My own title')
  })

  it('ignores a project that cannot be found, rather than showing an error', async () => {
    renderContact('/contact?project=does-not-exist')

    await waitFor(() => expect(api.getProject).toHaveBeenCalled())
    expect(screen.getByPlaceholderText(t.fTitle)).toHaveValue('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('asks for no project when the link names none', async () => {
    renderContact('/contact')

    await waitFor(() => expect(api.getServices).toHaveBeenCalled())
    expect(api.getProject).not.toHaveBeenCalled()
  })
})
