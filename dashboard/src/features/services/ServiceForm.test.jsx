import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, reply, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import ServiceCreate from './ServiceCreate'
import ServiceEdit from './ServiceEdit'
import { SERVICE_ICON_KEYS } from './icons'
import { makeServiceSchema } from './schema'
import strings from './strings'

const service = {
  id: 7,
  icon_key: 'erp',
  title_ar: 'أنظمة المؤسسات',
  title_en: 'Enterprise systems',
  description_ar: 'وصف الخدمة',
  description_en: 'Service description',
  features_ar: ['ميزة أولى', 'ميزة ثانية'],
  features_en: ['First feature'],
  order: 3,
}

const fillAll = async (user) => {
  await user.click(screen.getByRole('radio', { name: 'Cloud' }))
  await user.type(screen.getByLabelText('Title (Arabic)'), 'عنوان')
  await user.type(screen.getByLabelText('Title (English)'), 'A title')
  await user.type(screen.getByLabelText('Description (Arabic)'), 'وصف')
  await user.type(screen.getByLabelText('Description (English)'), 'A description')
}

describe('ServiceCreate', () => {
  it('renders the icon choices, Arabic and English pairs, the feature lists and Save / Cancel', () => {
    renderWithProviders(<ServiceCreate />, { route: '/services/new' })

    expect(screen.getByRole('heading', { level: 1, name: 'Add a service' })).toBeInTheDocument()
    const icons = screen.getByRole('radiogroup', { name: 'Icon' })
    expect(within(icons).getAllByRole('radio')).toHaveLength(7)
    expect(within(icons).getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual(Array(7).fill('false'))
    expect(screen.getByLabelText('Title (Arabic)')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByLabelText('Title (English)')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByLabelText('Description (English)').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Title (English)').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Features (Arabic)').closest('[dir]')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByLabelText('Features (English)').closest('[dir]')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/services')
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services') // back link
  })

  it('validates locally (icon, titles, descriptions) and sends nothing', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('This field is required')).toHaveLength(5)
    expect(screen.getByRole('radiogroup', { name: 'Icon' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Title (Arabic)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('radio', { name: 'Web' })).toHaveFocus() // first invalid field = the icon group
    expect(server.requests).toHaveLength(0)
  })

  it('creates the service with its icon and feature lists, toasts and returns to the list', async () => {
    const server = mockApi({ 'POST /services': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })

    await fillAll(user)
    await user.type(screen.getByLabelText('Features (Arabic)'), 'ميزة أولى{Enter}ميزة ثانية{Enter}')
    await user.type(screen.getByLabelText('Features (English)'), 'First{Enter}')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/services$/))
    expect(server.calls('POST', '/services')[0].body).toEqual({
      // Blank, so the API derives it from the English title.
      slug: null,
      icon_key: 'cloud',
      title_ar: 'عنوان',
      title_en: 'A title',
      description_ar: 'وصف',
      description_en: 'A description',
      features_ar: ['ميزة أولى', 'ميزة ثانية'],
      features_en: ['First'],
      is_active: true,
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('sends empty feature lists when none were added (and never sends the order)', async () => {
    const server = mockApi({ 'POST /services': ({ body }) => reply(201, { data: body }) })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })

    await fillAll(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/services')).toHaveLength(1))
    const body = server.calls('POST', '/services')[0].body
    expect(body.features_ar).toEqual([])
    expect(body.features_en).toEqual([])
    expect(body).not.toHaveProperty('order')
  })

  it('trims whitespace before sending and lets a feature be removed again', async () => {
    const server = mockApi({ 'POST /services': ({ body }) => reply(201, { data: body }) })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })

    await user.click(screen.getByRole('radio', { name: 'AI' }))
    await user.type(screen.getByLabelText('Title (Arabic)'), '  عنوان  ')
    await user.type(screen.getByLabelText('Title (English)'), '  Title  ')
    await user.type(screen.getByLabelText('Description (Arabic)'), 'و')
    await user.type(screen.getByLabelText('Description (English)'), 'D')
    await user.type(screen.getByLabelText('Features (English)'), 'Keep{Enter}Drop{Enter}')
    await user.click(screen.getByRole('button', { name: 'Remove Drop' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/services')).toHaveLength(1))
    expect(server.calls('POST', '/services')[0].body).toMatchObject({ icon_key: 'ai', title_ar: 'عنوان', title_en: 'Title', features_en: ['Keep'] })
  })

  it('shows the server validation errors on the matching fields (icon, title, a single feature) and stays on the page', async () => {
    mockApi({
      'POST /services': () =>
        validationError({
          icon_key: ['The selected icon key is invalid.'],
          title_en: ['The title en field must not be greater than 255 characters.'],
          'features_en.1': ['The features_en.1 field must not be greater than 255 characters.'],
        }),
    })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })
    await fillAll(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The selected icon key is invalid.')).toBeInTheDocument()
    expect(screen.getByText('The title en field must not be greater than 255 characters.')).toBeInTheDocument()
    expect(screen.getByText('The features_en.1 field must not be greater than 255 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title (English)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('radiogroup', { name: 'Icon' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('radio', { name: 'Cloud' })).toHaveFocus() // first invalid field: the group focuses its selected tile
    expect(screen.getByTestId('location')).toHaveTextContent('/services/new')
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument() // toast
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('disables Save while the request is running', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    mockApi({
      'POST /services': async () => {
        await gate
        return reply(201, { data: { id: 1 } })
      },
    })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })
    await fillAll(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/services$/))
  })

  it('shows a toast when the server is down (and keeps the form)', async () => {
    mockApi({ 'POST /services': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new' })
    await fillAll(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title (English)')).toHaveValue('A title')
  })

  it('renders in Arabic with Arabic icon names and validation messages', async () => {
    const { user } = renderWithProviders(<ServiceCreate />, { route: '/services/new', lang: 'ar' })

    expect(screen.getByRole('heading', { level: 1, name: 'إضافة خدمة' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'الذكاء الاصطناعي' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'حفظ' }))
    expect((await screen.findAllByText('هذا الحقل مطلوب')).length).toBe(5)
  })
})

describe('service schema', () => {
  const c = { required: 'required', maxLength: (n) => `max ${n}` }
  const valid = { icon_key: 'web', title_ar: 'ع', title_en: 'T', description_ar: 'و', description_en: 'D', features_ar: [], features_en: [], is_active: true }

  it('accepts exactly the seven icon keys of the API', () => {
    const schema = makeServiceSchema(c, strings.en)
    expect(SERVICE_ICON_KEYS).toEqual(['web', 'mobile', 'design', 'erp', 'cloud', 'ai', 'support'])
    SERVICE_ICON_KEYS.forEach((key) => expect(schema.safeParse({ ...valid, icon_key: key }).success).toBe(true))
    expect(schema.safeParse({ ...valid, icon_key: 'rocket' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, icon_key: '' }).success).toBe(false)
  })

  it('mirrors the API length limits', () => {
    const schema = makeServiceSchema(c, strings.en)
    expect(schema.safeParse({ ...valid, title_en: 'x'.repeat(255) }).success).toBe(true)
    expect(schema.safeParse({ ...valid, title_en: 'x'.repeat(256) }).success).toBe(false)
    expect(schema.safeParse({ ...valid, description_ar: 'x'.repeat(5000) }).success).toBe(true)
    expect(schema.safeParse({ ...valid, description_ar: 'x'.repeat(5001) }).success).toBe(false)
    expect(schema.safeParse({ ...valid, features_en: ['ok', 'x'.repeat(256)] }).success).toBe(false)
  })
})

describe('ServiceEdit', () => {
  const route = '/services/7'
  const path = '/services/:id'

  it('loads the record into the form and keeps Save disabled until something changes', async () => {
    mockApi({ 'GET /services/:id': () => ({ data: service }) })
    const { user } = renderWithProviders(<ServiceEdit />, { route, path })

    expect(await screen.findByLabelText('Title (English)')).toHaveValue('Enterprise systems')
    expect(screen.getByLabelText('Title (Arabic)')).toHaveValue('أنظمة المؤسسات')
    expect(screen.getByRole('radio', { name: 'ERP' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Web' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('ميزة ثانية')).toBeInTheDocument() // Arabic feature tag
    expect(screen.getByText('First feature')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Edit service' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(screen.getByLabelText('Title (English)'), '!')

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('shows a spinner while loading', () => {
    mockApi({ 'GET /services/:id': () => ({ data: service }) })
    renderWithProviders(<ServiceEdit />, { route, path })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('saves the changed values with PUT (icon, title, features) and goes back to the list', async () => {
    const server = mockApi({
      'GET /services/:id': () => ({ data: service }),
      'PUT /services/:id': ({ params, body }) => ({ data: { ...service, ...body, id: Number(params.id) } }),
    })
    const { user } = renderWithProviders(<ServiceEdit />, { route, path })
    const english = await screen.findByLabelText('Title (English)')

    await user.clear(english)
    await user.type(english, 'ERP systems')
    await user.click(screen.getByRole('radio', { name: 'Support' }))
    await user.click(screen.getByRole('button', { name: 'Remove ميزة أولى' }))
    await user.type(screen.getByLabelText('Features (English)'), 'Second feature{Enter}')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/services$/))
    expect(server.calls('PUT', '/services/7')[0].body).toEqual({
      slug: null,
      icon_key: 'support',
      title_ar: service.title_ar,
      title_en: 'ERP systems',
      description_ar: service.description_ar,
      description_en: service.description_en,
      features_ar: ['ميزة ثانية'],
      features_en: ['First feature', 'Second feature'],
      is_active: true,
    })
  })

  it('can clear both feature lists (sends empty arrays)', async () => {
    const server = mockApi({ 'GET /services/:id': () => ({ data: service }), 'PUT /services/:id': ({ body }) => ({ data: { ...service, ...body } }) })
    const { user } = renderWithProviders(<ServiceEdit />, { route, path })
    await screen.findByLabelText('Title (English)')

    await user.click(screen.getByRole('button', { name: 'Remove ميزة أولى' }))
    await user.click(screen.getByRole('button', { name: 'Remove ميزة ثانية' }))
    await user.click(screen.getByRole('button', { name: 'Remove First feature' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/services/7')).toHaveLength(1))
    expect(server.calls('PUT', '/services/7')[0].body).toMatchObject({ features_ar: [], features_en: [] })
  })

  it('shows server errors on an edit too', async () => {
    mockApi({ 'GET /services/:id': () => ({ data: service }), 'PUT /services/:id': () => validationError({ description_en: ['Description is too long.'] }) })
    const { user } = renderWithProviders(<ServiceEdit />, { route, path })
    await user.type(await screen.findByLabelText('Description (English)'), ' more')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Description is too long.')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/services/7')
  })

  it('shows "not found" for a missing service', async () => {
    mockApi({ 'GET /services/:id': () => reply(404, { message: 'No query results for model [App\\Models\\Service] 7' }) })
    renderWithProviders(<ServiceEdit />, { route, path })

    expect(await screen.findByText('Service not found')).toBeInTheDocument()
    expect(screen.queryByText(/App\\Models/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services')
  })

  it('offers a retry when loading fails for another reason', async () => {
    const server = mockApi({ 'GET /services/:id': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<ServiceEdit />, { route, path })

    expect(await screen.findByText('Could not load the data.')).toBeInTheDocument()

    server.on('GET /services/:id', () => ({ data: service }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Title (English)')).toBeInTheDocument()
  })

  it('tolerates a legacy record with an unknown icon and missing feature lists', async () => {
    mockApi({ 'GET /services/:id': () => ({ data: { ...service, icon_key: 'legacy', features_ar: null, features_en: undefined } }) })
    renderWithProviders(<ServiceEdit />, { route, path })

    expect(await screen.findByLabelText('Title (English)')).toHaveValue('Enterprise systems')
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'))
  })
})

describe('the slug and the link it makes', () => {
  it('sends the slug the admin typed instead of deriving one', async () => {
    const server = mockApi({ 'POST /services': reply({ data: { ...service, id: 9 } }) })
    const { user } = renderWithProviders(<ServiceCreate />)

    await fillAll(user)
    await user.type(screen.getByLabelText(/^Slug/), 'domain-registration')
    await user.click(screen.getByRole('button', { name: /save|حفظ/i }))

    await waitFor(() => expect(server.calls('POST', '/services')).toHaveLength(1))
    expect(server.calls('POST', '/services')[0].body.slug).toBe('domain-registration')
  })

  it('refuses a slug that would not survive being put in a URL', async () => {
    mockApi({ 'POST /services': reply({ data: service }) })
    const { user } = renderWithProviders(<ServiceCreate />)

    await fillAll(user)
    await user.type(screen.getByLabelText(/^Slug/), 'Domain Registration!')
    await user.click(screen.getByRole('button', { name: /save|حفظ/i }))

    expect(await screen.findByText(strings.en.slugInvalid)).toBeInTheDocument()
  })

  it('shows the ready-made contact link for a service that has a slug', async () => {
    mockApi({ 'GET /services/:id': () => ({ data: { ...service, slug: 'domain-registration' } }) })
    renderWithProviders(<ServiceEdit />, { route: '/services/7', path: '/services/:id' })

    const link = await screen.findByDisplayValue('https://www.ngptechworld.com/contact?service=domain-registration')
    expect(link).toHaveAttribute('readonly')
  })

  it('shows no link until there is a slug to build one from', async () => {
    mockApi({})
    renderWithProviders(<ServiceCreate />)

    // Nothing honest to show on an empty create form — the slug does not exist yet.
    expect(screen.queryByLabelText(strings.en.serviceLink)).not.toBeInTheDocument()
  })

  it('follows the slug as it is typed, so the link is right before saving', async () => {
    mockApi({ 'GET /services/:id': () => ({ data: { ...service, slug: 'old-name' } }) })
    const { user } = renderWithProviders(<ServiceEdit />, { route: '/services/7', path: '/services/:id' })

    // The full link, not /old-name/ — that appears in the slug field as well.
    await screen.findByDisplayValue('https://www.ngptechworld.com/contact?service=old-name')
    const field = screen.getByLabelText(/^Slug/)
    await user.clear(field)
    await user.type(field, 'new-name')

    expect(await screen.findByDisplayValue('https://www.ngptechworld.com/contact?service=new-name')).toBeInTheDocument()
  })
})
