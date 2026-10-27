import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsPage from '@/features/settings/SettingsPage'
import { mockApi, validationError } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import { dropOn } from '../dndCapture'
import { ProjectSectionsCard } from './ProjectSectionsCard'
import { SECTION_KEYS, normalizeLayout } from './SectionLayoutEditor'

vi.mock('@dnd-kit/core', async (importOriginal) => (await import('../dndCapture')).withDndCapture(await importOriginal()))

const all = (visible = {}) => SECTION_KEYS.map((key) => ({ key, visible: visible[key] ?? true }))
const card = () => within(screen.getByRole('region', { name: 'Page section order' }))
const rows = () => within(card().getByRole('list', { name: 'Page sections, in order' })).getAllByRole('listitem')
const names = () => rows().map((item) => item.querySelector('p').textContent)
const siteOrder = ['gallery', ...SECTION_KEYS.filter((key) => key !== 'gallery')]

function renderCard({ layout = null, canWrite = true, put, settings = { portfolio_sections: siteOrder.map((key) => ({ key, visible: key !== 'video' })) } } = {}) {
  const api = mockApi({
    'GET /settings': () => ({ data: settings }),
    'PUT /projects/:id': put ?? (({ body }) => ({ data: { id: 7, ...body } })),
  })
  const view = renderWithProviders(<ProjectSectionsCard project={{ id: 7, section_layout: layout }} canWrite={canWrite} />)
  return { api, ...view }
}

describe('normalizeLayout', () => {
  it('keeps the known sections once, in the stored order, and appends the missing ones visible', () => {
    expect(normalizeLayout([{ key: 'gallery', visible: false }, { key: 'nope' }, { key: 'gallery' }, { key: 'overview' }]).slice(0, 3)).toEqual([
      { key: 'gallery', visible: false },
      { key: 'overview', visible: true },
      { key: 'problem_solution', visible: true },
    ])
    expect(normalizeLayout(null)).toEqual(all())
  })
})

describe('project page section order', () => {
  it('follows the site default when the project has none, showing it read-only', async () => {
    const { api } = renderCard()

    expect(card().getByRole('switch', { name: /^Use the default order/ })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(names()[0]).toBe('Gallery')) // the site settings' order
    expect(within(rows()[7]).getByText('Hidden')).toBeInTheDocument() // video hidden by the site
    expect(card().queryByRole('button', { name: /Move/ })).not.toBeInTheDocument()
    expect(card().getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(api.calls('GET', '/settings')).toHaveLength(1)
  })

  it('reorders with the up / down buttons and saves the whole order', async () => {
    const { api, user } = renderCard({ layout: all() })

    await user.click(card().getByRole('button', { name: 'Move “Gallery” up' }))
    await user.click(card().getByRole('button', { name: 'Move “Gallery” up' }))
    expect(names().slice(4, 7)).toEqual(['Gallery', 'Highlights', 'Technologies'])
    await user.click(card().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body.section_layout.map((item) => item.key)).toEqual([
      'overview', 'problem_solution', 'features', 'modules', 'gallery', 'highlights', 'technologies', 'video', 'team', 'links', 'demo',
    ])
    expect(await screen.findByText('Section order saved')).toBeInTheDocument()
    await waitFor(() => expect(card().getByRole('button', { name: 'Save' })).toBeDisabled())
  })

  it('reorders by drag and drop', async () => {
    const { api, user } = renderCard({ layout: all() })

    dropOn(card().getByRole('list', { name: 'Page sections, in order' }), 'demo', 'overview')
    await user.click(card().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body.section_layout[0]).toEqual({ key: 'demo', visible: true })
  })

  it('hides a section with its eye toggle', async () => {
    const { api, user } = renderCard({ layout: all() })

    await user.click(card().getByRole('button', { name: 'Hide “Video”' }))
    expect(card().getByRole('button', { name: 'Show “Video”' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(card().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body.section_layout.find((item) => item.key === 'video')).toEqual({ key: 'video', visible: false })
  })

  it('goes back to the site default by saving null', async () => {
    const { api, user } = renderCard({ layout: all({ team: false }) })

    await user.click(card().getByRole('switch', { name: /^Use the default order/ }))
    await user.click(card().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body).toEqual({ section_layout: null })
  })

  it('appends sections the stored layout does not know yet', async () => {
    const stored = all().filter((item) => item.key !== 'demo' && item.key !== 'modules')
    const { api, user } = renderCard({ layout: stored })

    expect(names().slice(-2)).toEqual(['Modules', 'Live demo'])
    await user.click(card().getByRole('button', { name: 'Hide “Live demo”' }))
    await user.click(card().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body.section_layout).toHaveLength(11)
  })

  it('puts a 422 on the row it names, and anything else above the list', async () => {
    const { user } = renderCard({
      layout: all(),
      put: () => validationError({ 'section_layout.2.key': ['The selected key is invalid.'], section_layout: ['The layout is not valid.'] }),
    })

    await user.click(card().getByRole('button', { name: 'Hide “Team”' }))
    await user.click(card().getByRole('button', { name: 'Save' }))

    expect(await within(rows()[2]).findByText('The selected key is invalid.')).toBeInTheDocument() // Features
    expect(card().getByRole('alert')).toHaveTextContent('The layout is not valid.')
  })

  it('is read-only without updatePublic', () => {
    renderCard({ layout: all(), canWrite: false })
    expect(card().getByRole('switch', { name: /^Use the default order/ })).toBeDisabled()
    expect(card().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(card().queryByRole('button', { name: /Hide/ })).not.toBeInTheDocument()
    expect(names()).toHaveLength(11)
  })

  it('shows the usual order, with a note, to an account that cannot read the site settings', () => {
    const api = mockApi({})
    renderWithProviders(<ProjectSectionsCard project={{ id: 7, section_layout: null }} canWrite />, {
      authUser: { ...testUser, is_super_admin: false, role: 'admin', permissions: ['projects'] },
    })
    expect(card().getByText(/the default set in Site settings may differ/)).toBeInTheDocument()
    expect(names()[0]).toBe('Overview')
    expect(api.calls('GET', '/settings')).toHaveLength(0)
  })

  it('speaks Arabic', () => {
    mockApi({ 'GET /settings': () => ({ data: { portfolio_sections: null } }) })
    renderWithProviders(<ProjectSectionsCard project={{ id: 7, section_layout: all() }} canWrite />, { lang: 'ar' })
    const arabic = within(screen.getByRole('region', { name: 'ترتيب أقسام الصفحة' }))
    expect(arabic.getByRole('switch', { name: /^استخدم الترتيب الافتراضي/ })).toBeInTheDocument()
    expect(arabic.getByText('التجربة الحية')).toBeInTheDocument()
  })
})

describe('site default section order (Site settings)', () => {
  const settings = { email: 'hi@ngptechworld.com', phone: null, facebook: null, instagram: null, linkedin: null, x: null, whatsapp: null, portfolio_sections: null }

  it('saves the site default order with PUT /settings, and null for "all sections, usual order"', async () => {
    const api = mockApi({ 'GET /settings': () => ({ data: settings }), 'PUT /settings': ({ body }) => ({ data: { ...settings, ...body } }) })
    const { user } = renderWithProviders(<SettingsPage />, { route: '/settings' })

    const site = within(await screen.findByRole('region', { name: 'Project page section order' }))
    expect(site.getByRole('switch', { name: /^Use the default order/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(site.getByRole('switch', { name: /^Use the default order/ }))
    await user.click(site.getByRole('button', { name: 'Move “Features” down' }))
    await user.click(site.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/settings')).toHaveLength(1))
    expect(api.calls('PUT', '/settings')[0].body.portfolio_sections.slice(2, 4)).toEqual([
      { key: 'modules', visible: true },
      { key: 'features', visible: true },
    ])

    await user.click(site.getByRole('switch', { name: /^Use the default order/ }))
    await user.click(site.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.calls('PUT', '/settings')).toHaveLength(2))
    expect(api.calls('PUT', '/settings')[1].body).toEqual({ portfolio_sections: null })
  })

  it('stays out of the way on a backend without the setting', async () => {
    const { portfolio_sections, ...older } = settings
    mockApi({ 'GET /settings': () => ({ data: older }) })
    renderWithProviders(<SettingsPage />, { route: '/settings' })
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Project page section order' })).not.toBeInTheDocument()
    expect(portfolio_sections).toBeNull()
  })
})
