import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TOKEN_KEY } from '@/lib/storage'
import { mockApi, reply, validationError } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import AccountPage from './AccountPage'

// required fields carry an "*" in their label ("Name*"): match the visible words only (the labels contain no regex characters)
const labelPattern = (text) => new RegExp(`^${text}\\s*\\*?$`)
const byLabel = (text) => screen.getByLabelText(labelPattern(text))
const findByLabel = (text) => screen.findByLabelText(labelPattern(text))

const save = () => screen.getByRole('button', { name: 'Save' })
const changePassword = () => screen.getByRole('button', { name: 'Change password' })

async function fillPasswords(user, { current = 'old-password', next = 'new-password-1', confirm = next } = {}) {
  await user.type(byLabel('Current password'), current)
  await user.type(byLabel('New password'), next)
  await user.type(byLabel('Confirm new password'), confirm)
}

describe('AccountPage — profile', () => {
  it('shows your name and email; Save stays disabled until something changes', async () => {
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    expect(screen.getByRole('heading', { level: 1, name: 'My account' })).toBeInTheDocument()
    expect(byLabel('Name')).toHaveValue('Admin')
    expect(byLabel('Email')).toHaveValue('admin@ngptechworld.com')
    expect(save()).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users')

    await user.type(byLabel('Name'), '!')
    expect(save()).toBeEnabled()
  })

  it('hides the back-to-Users link for a limited admin (Users is super-admin only)', () => {
    renderWithProviders(<AccountPage />, { route: '/account', authUser: { ...testUser, is_super_admin: false, role: 'admin', permissions: ['requests'] } })

    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('saves name and email, refreshes the top bar, toasts and disables Save again', async () => {
    const updateUser = vi.fn()
    const server = mockApi({ 'PUT /auth/profile': ({ body }) => ({ data: { id: 1, ...body } }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account', auth: { updateUser } })
    const name = byLabel('Name')

    await user.clear(name)
    await user.type(name, 'Baraa Ali')
    await user.click(save())

    await waitFor(() => expect(server.calls('PUT', '/auth/profile')).toHaveLength(1))
    expect(server.calls('PUT', '/auth/profile')[0].body).toEqual({ name: 'Baraa Ali', email: 'admin@ngptechworld.com' })
    expect(await screen.findByText('Your details were updated')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith({ id: 1, name: 'Baraa Ali', email: 'admin@ngptechworld.com' })
    await waitFor(() => expect(save()).toBeDisabled())
    expect(byLabel('Name')).toHaveValue('Baraa Ali')
  })

  it('validates locally: required name and a well-formed email (any domain is accepted)', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await user.clear(byLabel('Name'))
    await user.clear(byLabel('Email'))
    await user.type(byLabel('Email'), 'not-an-email')
    await user.click(save())

    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address', { selector: 'p > bdi' })).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })

  it('accepts any email address, not only the ngptechworld.com domain', async () => {
    const server = mockApi({ 'PUT /auth/profile': ({ body }) => ({ data: { id: 1, ...body } }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await user.clear(byLabel('Email'))
    await user.type(byLabel('Email'), 'me@gmail.com')
    await user.click(save())

    await waitFor(() => expect(server.calls('PUT', '/auth/profile')).toHaveLength(1))
    expect(server.calls('PUT', '/auth/profile')[0].body).toMatchObject({ email: 'me@gmail.com' })
  })

  it('shows a server error (email already taken) on the field', async () => {
    mockApi({ 'PUT /auth/profile': () => validationError({ email: ['The email has already been taken.'] }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })
    await user.type(byLabel('Name'), '!')

    await user.click(save())

    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument()
    expect(byLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a toast and does not touch the top bar when the server is down', async () => {
    const updateUser = vi.fn()
    mockApi({ 'PUT /auth/profile': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account', auth: { updateUser } })
    await user.type(byLabel('Name'), '!')

    await user.click(save())

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })
})

describe('AccountPage — password', () => {
  it('sends the three fields as the API names them, keeps the session, clears the form and toasts', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'token-123')
    const logout = vi.fn()
    const server = mockApi({ 'PUT /auth/password': () => null })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account', auth: { logout } })
    expect(changePassword()).toBeDisabled()

    await fillPasswords(user)
    await user.click(changePassword())

    await waitFor(() => expect(server.calls('PUT', '/auth/password')).toHaveLength(1))
    expect(server.calls('PUT', '/auth/password')[0].body).toEqual({ current_password: 'old-password', password: 'new-password-1', password_confirmation: 'new-password-1' })
    expect(server.calls('PUT', '/auth/password')[0].headers.authorization).toBe('Bearer token-123')
    expect(await screen.findByText('Password changed. You were signed out of your other devices.')).toBeInTheDocument()
    await waitFor(() => expect(byLabel('Current password')).toHaveValue(''))
    expect(byLabel('New password')).toHaveValue('')
    expect(byLabel('Confirm new password')).toHaveValue('')
    expect(changePassword()).toBeDisabled()
    // still signed in: no logout, token kept, no redirect
    expect(logout).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('token-123')
    expect(screen.getByTestId('location')).toHaveTextContent('/account')
  })

  it('needs a matching confirmation', async () => {
    const server = mockApi({ 'PUT /auth/password': () => null })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await fillPasswords(user, { confirm: 'something-else-1' })
    await user.click(changePassword())

    expect(await screen.findByText('The two passwords do not match')).toBeInTheDocument()
    expect(byLabel('Confirm new password')).toHaveAttribute('aria-invalid', 'true')
    expect(server.requests).toHaveLength(0)
  })

  it('needs every field and at least 8 characters', async () => {
    const server = mockApi({ 'PUT /auth/password': () => null })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await user.type(byLabel('New password'), 'short')
    await user.click(changePassword())

    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getAllByText('This field is required')).toHaveLength(2) // current + confirmation
    expect(server.requests).toHaveLength(0)
  })

  it('shows "the current password is incorrect" on that field (also in Arabic) and keeps what was typed', async () => {
    mockApi({ 'PUT /auth/password': () => validationError({ current_password: ['The current password is incorrect.'] }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await fillPasswords(user)
    await user.click(changePassword())

    expect(await screen.findByText('The current password is incorrect.')).toBeInTheDocument()
    expect(byLabel('Current password')).toHaveAttribute('aria-invalid', 'true')
    expect(byLabel('Current password')).toHaveFocus()
    expect(byLabel('New password')).toHaveValue('new-password-1')
  })

  it('translates that server message', async () => {
    mockApi({ 'PUT /auth/password': () => validationError({ current_password: ['The current password is incorrect.'] }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account', lang: 'ar' })

    await user.type(byLabel('كلمة المرور الحالية'), 'old-password')
    await user.type(byLabel('كلمة المرور الجديدة'), 'new-password-1')
    await user.type(byLabel('تأكيد كلمة المرور الجديدة'), 'new-password-1')
    await user.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }))

    expect(await screen.findByText('كلمة المرور الحالية غير صحيحة.')).toBeInTheDocument()
  })

  it('shows the API validation error of the new password on its field', async () => {
    mockApi({ 'PUT /auth/password': () => validationError({ password: ['The password field confirmation does not match.'] }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await fillPasswords(user)
    await user.click(changePassword())

    expect(await screen.findByText('The password field confirmation does not match.')).toBeInTheDocument()
    expect(byLabel('New password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('tells you to wait when the API throttles password changes (429)', async () => {
    mockApi({ 'PUT /auth/password': () => reply(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '30' }) })
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    await fillPasswords(user)
    await user.click(changePassword())

    expect(await screen.findByText('Too many attempts. Try again later.')).toBeInTheDocument()
    expect(byLabel('New password')).toHaveValue('new-password-1')
  })

  it('has a show / hide toggle for each password field', async () => {
    const { user } = renderWithProviders(<AccountPage />, { route: '/account' })

    const toggles = screen.getAllByRole('button', { name: 'Show password' })
    expect(toggles).toHaveLength(3)
    await user.click(toggles[1])
    expect(byLabel('New password')).toHaveAttribute('type', 'text')
    expect(byLabel('Current password')).toHaveAttribute('type', 'password')
    expect(byLabel('Confirm new password')).toHaveAttribute('type', 'password')
  })
})

it('renders in Arabic', () => {
  renderWithProviders(<AccountPage />, { route: '/account', lang: 'ar', authUser: { ...testUser, name: 'مدير النظام' } })

  expect(screen.getByRole('heading', { level: 1, name: 'حسابي' })).toBeInTheDocument()
  expect(byLabel('الاسم')).toHaveValue('مدير النظام')
  expect(screen.getByRole('heading', { level: 2, name: 'تغيير كلمة المرور' })).toBeInTheDocument()
})
