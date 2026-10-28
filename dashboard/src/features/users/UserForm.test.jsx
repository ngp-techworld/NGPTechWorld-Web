import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockApi, reply, validationError } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import UserCreate from './UserCreate'
import UserEdit from './UserEdit'

// required fields carry an "*" in their label ("Name*"): match the visible words only (the labels contain no regex characters)
const labelPattern = (text) => new RegExp(`^${text}\\s*\\*?$`)
const byLabel = (text) => screen.getByLabelText(labelPattern(text))
const findByLabel = (text) => screen.findByLabelText(labelPattern(text))

const layla = { id: 2, name: 'Layla Hassan', email: 'layla@ngptechworld.com', role: 'super_admin', permissions: [], created_at: '2026-09-02T10:00:00.000000Z' }
const password = () => byLabel('Password')
const roleSelect = () => byLabel('Role')
const section = (name) => screen.getByRole('checkbox', { name })

// The default role is "Limited admin" (least privilege) — most tests pick "Super admin" instead so they
// need no section checkboxes; the permissions-specific tests below pick sections explicitly.
async function fillCreate(user, over = {}) {
  const values = { name: 'Omar Khaled', email: 'omar@ngptechworld.com', password: 'secret-pass-1', role: 'super_admin', ...over }
  await user.type(byLabel('Name'), values.name)
  await user.type(byLabel('Email'), values.email)
  await user.type(password(), values.password)
  await user.selectOptions(roleSelect(), values.role)
}

describe('UserCreate', () => {
  it('renders name, email and password fields', () => {
    renderWithProviders(<UserCreate />, { route: '/users/new' })

    expect(screen.getByRole('heading', { level: 1, name: 'Add a user' })).toBeInTheDocument()
    expect(byLabel('Email')).toHaveAttribute('type', 'email')
    expect(password()).toHaveAccessibleDescription('At least 8 characters.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/users')
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users') // back link
  })

  it('shows and hides the password', async () => {
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })
    await user.type(password(), 'secret-pass-1')
    expect(password()).toHaveAttribute('type', 'password')
    // Unlike email/url/number, a password field follows the page's own direction (Arabic UI: RTL) — see PasswordInput.
    expect(password()).not.toHaveAttribute('dir')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password()).toHaveAttribute('type', 'text')
    expect(password()).toHaveValue('secret-pass-1')
    expect(password()).not.toHaveAttribute('dir')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password()).toHaveAttribute('type', 'password')
  })

  it('validates locally (required fields, the email format, the password length) and sends nothing', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findAllByText('This field is required')).toHaveLength(3)

    await user.type(byLabel('Name'), 'Omar')
    await user.type(byLabel('Email'), 'not-an-email')
    await user.type(password(), 'short')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter a valid email address', { selector: 'p > bdi' })).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(byLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(server.requests).toHaveLength(0)
  })

  it('accepts the domain in any letter case', async () => {
    const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await fillCreate(user, { email: 'Omar@NGPTechWorld.com' })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/users')).toHaveLength(1))
  })

  it('creates the user, toasts and returns to the list', async () => {
    const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await fillCreate(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/users$/))
    expect(server.calls('POST', '/users')[0].body).toEqual({
      name: 'Omar Khaled', email: 'omar@ngptechworld.com', password: 'secret-pass-1', role: 'super_admin', permissions: [],
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('does not trim the password but trims the name and email', async () => {
    const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await fillCreate(user, { name: '  Omar  ', email: '  omar@ngptechworld.com  ', password: ' pass word ' })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/users')).toHaveLength(1))
    expect(server.calls('POST', '/users')[0].body).toMatchObject({ name: 'Omar', email: 'omar@ngptechworld.com', password: ' pass word ' })
  })

  it('shows the server validation errors on the matching fields and stays on the page', async () => {
    mockApi({ 'POST /users': () => validationError({ email: ['The email has already been taken.'], password: ['The password field must be at least 8 characters.'] }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await fillCreate(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument()
    expect(screen.getByText('The password field must be at least 8 characters.')).toBeInTheDocument()
    expect(byLabel('Email')).toHaveFocus()
    expect(screen.getByTestId('location')).toHaveTextContent('/users/new')
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument()
  })

  it('shows a toast when the server is down and keeps the form', async () => {
    mockApi({ 'POST /users': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await fillCreate(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(byLabel('Name')).toHaveValue('Omar Khaled')
  })

  it('validation messages follow the UI language', async () => {
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new', lang: 'ar' })
    await user.type(byLabel('البريد الإلكتروني'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('بريد إلكتروني غير صالح', { selector: 'p > bdi' })).toBeInTheDocument()
    expect(screen.getAllByText('هذا الحقل مطلوب')).toHaveLength(2)
  })

  describe('role & permissions', () => {
    it('defaults to a limited admin with no sections chosen, and shows the section checkboxes', () => {
      renderWithProviders(<UserCreate />, { route: '/users/new' })

      expect(roleSelect()).toHaveValue('admin')
      expect(section('Requests')).not.toBeChecked()
      expect(screen.getByRole('group', { name: 'Allowed sections' })).toBeInTheDocument()
    })

    it('hides the section checkboxes for a super admin', async () => {
      const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

      await user.selectOptions(roleSelect(), 'super_admin')

      expect(screen.queryByRole('group', { name: 'Allowed sections' })).not.toBeInTheDocument()
    })

    it('requires at least one section for a limited admin', async () => {
      const server = mockApi({})
      const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

      await user.type(byLabel('Name'), 'Omar')
      await user.type(byLabel('Email'), 'omar@ngptechworld.com')
      await user.type(password(), 'secret-pass-1')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Choose at least one section')).toBeInTheDocument()
      expect(server.requests).toHaveLength(0)
    })

    it('creates a limited admin with exactly the sections checked', async () => {
      const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
      const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

      await user.type(byLabel('Name'), 'Requests Admin')
      await user.type(byLabel('Email'), 'ops@ngptechworld.com')
      await user.type(password(), 'secret-pass-1')
      await user.click(section('Requests'))
      await user.click(section('Projects'))
      await user.click(section('Requests')) // toggled off again
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(server.calls('POST', '/users')).toHaveLength(1))
      expect(server.calls('POST', '/users')[0].body).toEqual({
        name: 'Requests Admin', email: 'ops@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: ['projects'], registry_role: null,
      })
    })
  })
})

describe('UserEdit', () => {
  const route = '/users/2'
  const path = '/users/:id'
  const editServer = (extra = {}) =>
    mockApi({
      'GET /users/:id': ({ params }) => ({ data: { ...layla, id: Number(params.id) } }),
      'PUT /users/:id': ({ params, body }) => ({ data: { ...layla, id: Number(params.id), ...body, password: undefined } }),
      ...extra,
    })

  it('loads the user into the form (password empty and optional) and keeps Save disabled until something changes', async () => {
    editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })

    expect(await findByLabel('Name')).toHaveValue('Layla Hassan')
    expect(byLabel('Email')).toHaveValue('layla@ngptechworld.com')
    expect(roleSelect()).toHaveValue('super_admin')
    expect(password()).toHaveValue('')
    expect(password()).toHaveAccessibleDescription(/Leave empty to keep the current password/)
    expect(screen.getByRole('heading', { level: 1, name: 'Edit user' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(byLabel('Name'), '!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('loads an existing limited admin with their sections pre-checked', async () => {
    editServer({ 'GET /users/:id': () => ({ data: { ...layla, role: 'admin', permissions: ['requests', 'settings'] } }) })
    renderWithProviders(<UserEdit />, { route, path })

    expect(await findByLabel('Name')).toHaveValue('Layla Hassan')
    expect(roleSelect()).toHaveValue('admin')
    expect(section('Requests')).toBeChecked()
    expect(section('Site settings')).toBeChecked()
    expect(section('Projects')).not.toBeChecked()
  })

  it('shows a spinner while loading', () => {
    editServer()
    renderWithProviders(<UserEdit />, { route, path })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('leaves the password out of the request when it is empty, then goes back to the list', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    const name = await findByLabel('Name')

    await user.clear(name)
    await user.type(name, 'Layla H.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/users$/))
    expect(server.calls('PUT', '/users/2')[0].body).toEqual({ name: 'Layla H.', email: 'layla@ngptechworld.com', role: 'super_admin', permissions: [] })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('sends a new password when one is typed', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    await user.type(await findByLabel('Password'), 'brand-new-pass')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/users/2')).toHaveLength(1))
    expect(server.calls('PUT', '/users/2')[0].body).toEqual({
      name: 'Layla Hassan', email: 'layla@ngptechworld.com', role: 'super_admin', permissions: [], password: 'brand-new-pass',
    })
  })

  it('changes a super admin into a limited admin with the chosen sections', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    await findByLabel('Name')

    await user.selectOptions(roleSelect(), 'admin')
    await user.click(section('Testimonials'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/users/2')).toHaveLength(1))
    expect(server.calls('PUT', '/users/2')[0].body).toEqual({
      name: 'Layla Hassan', email: 'layla@ngptechworld.com', role: 'admin', permissions: ['testimonials'], registry_role: null,
    })
  })

  it('refuses a too short new password without calling the API', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    await user.type(await findByLabel('Password'), 'short')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
    expect(server.calls('PUT')).toHaveLength(0)
  })

  it('accepts any email address, not only the ngptechworld.com domain', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    await user.clear(await findByLabel('Email'))
    await user.type(byLabel('Email'), 'layla@gmail.com')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/users/2')).toHaveLength(1))
    expect(server.calls('PUT', '/users/2')[0].body).toMatchObject({ email: 'layla@gmail.com' })
  })

  it('shows server errors on an edit too', async () => {
    editServer({ 'PUT /users/:id': () => validationError({ email: ['The email has already been taken.'] }) })
    const { user } = renderWithProviders(<UserEdit />, { route, path })
    await user.type(await findByLabel('Name'), '!')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/users/2')
  })

  it('refreshes the name in the top bar when you edit your own record', async () => {
    const updateUser = vi.fn()
    editServer({ 'GET /users/:id': () => ({ data: { ...testUser, created_at: layla.created_at } }) })
    const { user } = renderWithProviders(<UserEdit />, { route: '/users/1', path, auth: { updateUser } })
    const name = await findByLabel('Name')

    await user.clear(name)
    await user.type(name, 'Chief Admin')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Chief Admin', email: testUser.email }))
  })

  it('does not touch the signed-in user when you edit somebody else', async () => {
    const updateUser = vi.fn()
    editServer()
    const { user } = renderWithProviders(<UserEdit />, { route, path, auth: { updateUser } })
    await user.type(await findByLabel('Name'), '!')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/users$/))
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('shows "not found" for a missing user', async () => {
    mockApi({ 'GET /users/:id': () => reply(404, { message: 'No query results for model [App\\Models\\User] 2' }) })
    renderWithProviders(<UserEdit />, { route, path })

    expect(await screen.findByText('User not found')).toBeInTheDocument()
    expect(screen.queryByText(/App\\Models/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users')
  })

  it('offers a retry when loading fails for another reason', async () => {
    const server = mockApi({ 'GET /users/:id': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<UserEdit />, { route, path })

    expect(await screen.findByText('Could not load the data.')).toBeInTheDocument()

    server.on('GET /users/:id', () => ({ data: layla }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await findByLabel('Name')).toBeInTheDocument()
  })
})

describe('registry role', () => {
  const registrySelect = () => screen.getByLabelText('Project registry role')

  it('offers none / viewer / developer / manager for a limited admin and hides it for a super admin', async () => {
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    expect(registrySelect()).toHaveValue('')
    expect([...registrySelect().options].map((option) => option.textContent)).toEqual(['No registry access', 'Viewer', 'Developer', 'Manager'])
    await user.selectOptions(roleSelect(), 'super_admin')
    expect(screen.queryByLabelText('Project registry role')).not.toBeInTheDocument()
  })

  it('creates a registry manager without any content section', async () => {
    const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await user.type(byLabel('Name'), 'Project Manager')
    await user.type(byLabel('Email'), 'pm@ngptechworld.com')
    await user.type(password(), 'secret-pass-1')
    await user.selectOptions(registrySelect(), 'manager')
    expect(registrySelect()).toHaveAccessibleDescription(/Creates, publishes and archives projects/)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/users')).toHaveLength(1))
    expect(server.calls('POST', '/users')[0].body).toEqual({
      name: 'Project Manager', email: 'pm@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: [], registry_role: 'manager',
    })
  })

  it('still asks for a section when there is no registry role', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await user.type(byLabel('Name'), 'Nobody')
    await user.type(byLabel('Email'), 'nobody@ngptechworld.com')
    await user.type(password(), 'secret-pass-1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Choose at least one section')).toBeInTheDocument()
    expect(registrySelect()).toHaveAccessibleDescription(/Pick a role to let them read the projects/)
    expect(server.requests).toHaveLength(0)
  })

  it('loads the stored role on edit and clears it with null', async () => {
    const server = mockApi({
      'GET /users/:id': () => ({ data: { ...layla, role: 'admin', is_super_admin: false, permissions: ['requests'], registry_role: 'developer' } }),
      'PUT /users/:id': ({ body }) => ({ data: { ...layla, ...body } }),
    })
    const { user } = renderWithProviders(<UserEdit />, { route: '/users/2', path: '/users/:id' })

    expect(await screen.findByLabelText('Project registry role')).toHaveValue('developer')
    await user.selectOptions(registrySelect(), '')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/users/2')).toHaveLength(1))
    expect(server.calls('PUT', '/users/2')[0].body).toMatchObject({ role: 'admin', permissions: ['requests'], registry_role: null })
  })

  it('never sends a registry role for a super admin', async () => {
    const server = mockApi({ 'POST /users': ({ body }) => reply(201, { data: { id: 9, ...body } }) })
    const { user } = renderWithProviders(<UserCreate />, { route: '/users/new' })

    await user.selectOptions(screen.getByLabelText('Project registry role'), 'viewer')
    await fillCreate(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/users')).toHaveLength(1))
    expect(server.calls('POST', '/users')[0].body).not.toHaveProperty('registry_role')
  })
})
