import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/app/AppRoutes'
import { mockApi, reply, validationError } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import AccountPage from './AccountPage'

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
const setup = { secret: SECRET, otpauth_url: `otpauth://totp/NGP%20TechWorld:admin%40ngptechworld.com?secret=${SECRET}&issuer=NGP%20TechWorld`, expires_in: 600 }
const CODES = ['AAAA-BBBB', 'CCCC-DDDD', 'EEEE-FFFF', 'GGGG-HHHH', 'IIII-JJJJ', 'KKKK-LLLL', 'MMMM-NNNN', 'OOOO-PPPP']

function renderCard({ user = {}, routes = {} } = {}) {
  const api = mockApi(routes)
  const updateUser = vi.fn()
  const refreshUser = vi.fn(async () => ({}))
  const view = renderWithProviders(<AccountPage />, { route: '/account', authUser: { ...testUser, mfa_enabled: false, mfa_required: true, ...user }, auth: { updateUser, refreshUser } })
  return { api, updateUser, refreshUser, ...view }
}
const card = async () => within(await screen.findByRole('region', { name: 'Two-step sign-in' }))

beforeEach(() => window.sessionStorage.clear())

describe('Two-step sign-in card', () => {
  it('shows the status and why the account needs it', async () => {
    renderCard()
    const mfa = await card()
    expect(mfa.getByText('Off')).toBeInTheDocument()
    expect(mfa.getByText('Your account needs it to open internal and sensitive project data.')).toBeInTheDocument()
  })

  it('turns it on: QR code and key, the first code, then the recovery codes shown once', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { api, updateUser, refreshUser, user } = renderCard({
      routes: {
        'POST /auth/mfa/setup': () => ({ data: setup }),
        'POST /auth/mfa/confirm': ({ body }) => (body.code === '123456' ? { data: { mfa_enabled: true, recovery_codes: CODES } } : validationError({ code: ['The code is not valid.'] })),
      },
    })
    const mfa = await card()

    await user.click(mfa.getByRole('button', { name: 'Turn on two-step sign-in' }))
    expect(await mfa.findByRole('img', { name: 'QR code to add this account to your authenticator app' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/))
    expect(mfa.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument()

    await user.type(mfa.getByLabelText(/^Verification code/), '000000')
    await user.click(mfa.getByRole('button', { name: 'Confirm and turn on' }))
    expect(await mfa.findByText('The code is wrong or was already used.')).toBeInTheDocument()

    await user.type(mfa.getByLabelText(/^Verification code/), '123456')
    await user.click(mfa.getByRole('button', { name: 'Confirm and turn on' }))

    const codes = within(await mfa.findByRole('region', { name: 'Recovery codes' }))
    expect(codes.getAllByRole('listitem').map((item) => item.textContent)).toEqual(CODES)
    expect(mfa.queryByText(/JBSW Y3DP/)).not.toBeInTheDocument() // the secret is gone once confirmed
    expect(updateUser).toHaveBeenCalledWith({ mfa_enabled: true })
    expect(api.calls('POST', '/auth/mfa/confirm').at(-1).body).toEqual({ code: '123456' })

    await user.click(codes.getByRole('button', { name: 'Download as a text file' }))
    expect(click).toHaveBeenCalled()
    const done = codes.getByRole('button', { name: 'Done' })
    expect(done).toBeDisabled()
    await user.click(codes.getByRole('checkbox', { name: 'I saved the codes somewhere safe' }))
    await user.click(done)

    expect(mfa.queryByRole('region', { name: 'Recovery codes' })).not.toBeInTheDocument()
    expect(refreshUser).toHaveBeenCalled()
    // nothing of the secret or the codes was kept by the browser
    const stored = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage })
    expect(stored).not.toContain(SECRET)
    expect(stored).not.toContain('AAAA-BBBB')
  })

  it('starts again when the setup expired on the server', async () => {
    const { api, user } = renderCard({
      routes: { 'POST /auth/mfa/setup': () => ({ data: setup }), 'POST /auth/mfa/confirm': () => validationError({ setup: ['The setup has expired.'] }) },
    })
    const mfa = await card()
    await user.click(mfa.getByRole('button', { name: 'Turn on two-step sign-in' }))
    await user.type(await mfa.findByLabelText(/^Verification code/), '123456')
    await user.click(mfa.getByRole('button', { name: 'Confirm and turn on' }))

    expect(await mfa.findByText('The setup expired (10 minutes). Start again for a new QR code.')).toBeInTheDocument()
    await user.click(mfa.getByRole('button', { name: 'Start again' }))
    await waitFor(() => expect(api.calls('POST', '/auth/mfa/setup')).toHaveLength(2))
  })

  it('turns it off with the password and a code', async () => {
    const { api, updateUser, user } = renderCard({
      user: { mfa_enabled: true },
      routes: { 'POST /auth/mfa/disable': ({ body }) => (body.password === 'right-pass' ? null : validationError({ password: ['The password is incorrect.'] })) },
    })
    const mfa = await card()
    expect(mfa.getByText('On')).toBeInTheDocument()

    await user.click(mfa.getByRole('button', { name: 'Turn off two-step sign-in' }))
    const form = within(mfa.getByRole('form', { name: 'Turn off two-step sign-in' }))
    await user.type(form.getByLabelText(/^Password/), 'wrong')
    await user.type(form.getByLabelText(/^Verification code or recovery code/), '123456')
    await user.click(form.getByRole('button', { name: 'Turn off two-step sign-in' }))
    expect(await form.findByText('The password is incorrect.')).toBeInTheDocument()

    await user.clear(form.getByLabelText(/^Password/))
    await user.type(form.getByLabelText(/^Password/), 'right-pass')
    await user.click(form.getByRole('button', { name: 'Turn off two-step sign-in' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ mfa_enabled: false }))
    expect(api.calls('POST', '/auth/mfa/disable').at(-1).body).toEqual({ password: 'right-pass', code: '123456' })
    expect(await screen.findByText('Two-step sign-in is off')).toBeInTheDocument()
  })

  it('replaces the recovery codes after the password and a code', async () => {
    const { user } = renderCard({ user: { mfa_enabled: true }, routes: { 'POST /auth/mfa/recovery-codes': () => ({ data: { recovery_codes: CODES } }) } })
    const mfa = await card()

    await user.click(mfa.getByRole('button', { name: 'New recovery codes' }))
    const form = within(mfa.getByRole('form', { name: 'New recovery codes' }))
    await user.type(form.getByLabelText(/^Password/), 'right-pass')
    await user.type(form.getByLabelText(/^Verification code or recovery code/), 'AAAA-BBBB')
    await user.click(form.getByRole('button', { name: 'New recovery codes' }))

    expect(within(await mfa.findByRole('region', { name: 'Recovery codes' })).getAllByRole('listitem')).toHaveLength(8)
  })

  it('asks for both fields before sending anything', async () => {
    const { api, user } = renderCard({ user: { mfa_enabled: true } })
    const mfa = await card()
    await user.click(mfa.getByRole('button', { name: 'Turn off two-step sign-in' }))
    await user.click(within(mfa.getByRole('form', { name: 'Turn off two-step sign-in' })).getByRole('button', { name: 'Turn off two-step sign-in' }))
    expect(mfa.getAllByText('This field is required')).toHaveLength(2)
    expect(api.requests).toHaveLength(0)
  })
})

describe('enrolment notice', () => {
  const page = { id: 'x', nav: { order: 1, group: 'main', icon: () => null, label: { ar: 'س', en: 'X' }, to: '/x' }, routes: [{ path: 'x', element: <div>page x</div> }] }

  it('reminds an account that must enrol, links to the card, and can be dismissed for the session', async () => {
    mockApi({})
    const { user } = renderWithProviders(<AppRoutes features={[page]} />, { route: '/x', authUser: { ...testUser, mfa_required: true, mfa_enabled: false } })

    expect(await screen.findByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Turn it on' })).toHaveAttribute('href', '/account#mfa')
    await user.click(screen.getByRole('button', { name: 'Hide this notice' }))
    expect(screen.queryByText(/Two-step sign-in is required/)).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem('ngp_mfa_notice_dismissed')).toBe('1')
  })

  it('stays away once it is on, or when it is not required', () => {
    mockApi({})
    const { unmount } = renderWithProviders(<AppRoutes features={[page]} />, { route: '/x', authUser: { ...testUser, mfa_required: true, mfa_enabled: true } })
    expect(screen.queryByText(/Two-step sign-in is required/)).not.toBeInTheDocument()
    unmount()
    renderWithProviders(<AppRoutes features={[page]} />, { route: '/x', authUser: { ...testUser, mfa_required: false, mfa_enabled: false } })
    expect(screen.queryByText(/Two-step sign-in is required/)).not.toBeInTheDocument()
  })
})

it('keeps a 409 from setup (already on) from breaking the card', async () => {
  const { refreshUser, user } = renderCard({ routes: { 'POST /auth/mfa/setup': () => reply(409, { message: 'Two-factor authentication is already on.' }) } })
  const mfa = await card()
  await user.click(mfa.getByRole('button', { name: 'Turn on two-step sign-in' }))
  expect(await screen.findByText('Two-step sign-in is already on for this account.')).toBeInTheDocument()
  expect(refreshUser).toHaveBeenCalled()
})
