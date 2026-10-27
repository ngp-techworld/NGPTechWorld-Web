import './testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, paginated, reply, validationError } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import ProjectEdit from './ProjectEdit'
import { ABILITIES, legacyProject, registryRecord, registryRoutes } from './registryTestUtils'

const path = '/projects/:id'
const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent.replace(/\d+$/, '').trim())
const tablist = (name) => screen.getByRole('tablist', { name: new RegExp(`^${name}`) })
const region = (name) => within(screen.getByRole('region', { name }))
const findRegion = async (name) => within(await screen.findByRole('region', { name }))
const saveDetails = () => within(screen.getByRole('form', { name: 'Project details' })).getByRole('button', { name: 'Save' })
const manager = { ...testUser, is_super_admin: false, role: 'admin', permissions: [], registry_role: 'manager' }

function renderPage({ abilities = ABILITIES.superAdmin, route = '/projects/7', authUser = testUser, over, extra, lang } = {}) {
  const api = mockApi(registryRoutes({ abilities, over, extra }))
  const view = renderWithProviders(<ProjectEdit />, { route, path, authUser, lang })
  return { api, ...view }
}

const PUBLIC = ['Overview', 'Media', 'Features', 'Tech stack', 'Screenshots', 'Team', 'Links']
const INTERNAL = ['Non-functional', 'Maintenance', 'Documents']
const SENSITIVE = ['Accounts & permissions', 'Environments & servers', 'Deployment', 'Database & backups']

describe('project page: tabs by abilities', () => {
  it('shows every tab, in three groups, to a caller with every ability', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()

    expect(tabNames()).toEqual([...PUBLIC, ...INTERNAL, ...SENSITIVE])
    expect(within(tablist('Public content')).getAllByRole('tab')).toHaveLength(7)
    expect(within(tablist('Internal')).getAllByRole('tab')).toHaveLength(3)
    expect(within(tablist('Sensitive')).getAllByRole('tab')).toHaveLength(4)
  })

  it('leaves the sensitive tabs out (not disabled) for a viewer who is not a member', async () => {
    renderPage({ abilities: ABILITIES.viewer })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(tabNames()).toEqual([...PUBLIC, ...INTERNAL])
    expect(screen.queryByRole('tablist', { name: /^Sensitive/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Accounts/ })).not.toBeInTheDocument()
  })

  it('gives a projects-section content editor the public tabs only', async () => {
    renderPage({ abilities: ABILITIES.contentEditor })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(tabNames()).toEqual(PUBLIC)
    expect(screen.queryByRole('region', { name: 'Administration' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Project members' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Publication' })).toBeInTheDocument()
  })

  it('opens a tab from ?tab= and falls back to the Overview for a tab the caller cannot read', async () => {
    renderPage({ abilities: ABILITIES.viewer, route: '/projects/7?tab=accounts' })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })
    expect(screen.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the tab in the URL', async () => {
    const { user } = renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    await user.click(screen.getByRole('tab', { name: 'Deployment' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/7?tab=deployment')
    expect(await screen.findByRole('region', { name: 'Repositories' })).toBeInTheDocument()
  })

  it('falls back to the original public tabs, with a notice, when the registry cannot be read', async () => {
    mockApi({ 'GET /projects/:id': () => ({ data: legacyProject() }), 'GET /registry/projects/:id': () => reply(404, { message: 'Not found.' }) })
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path })

    expect(await screen.findByText(/This server has no project registry yet/)).toBeInTheDocument()
    expect(tabNames()).toEqual(['Overview', 'Media', 'Team', 'Links'])
    expect(screen.getByRole('switch', { name: /Featured project/ })).toBeInTheDocument()
  })

  it('shows a failed registry request with Retry and keeps the page read-only (no invented abilities)', async () => {
    const api = mockApi({ ...registryRoutes(), 'GET /registry/projects/:id': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<ProjectEdit />, { route: '/projects/7', path, authUser: { ...manager, registry_role: 'viewer' } })

    expect(await screen.findByText(/could not be loaded, so its public sections are shown read-only/)).toBeInTheDocument()
    expect(tabNames()).toEqual(['Overview', 'Media', 'Team', 'Links'])
    expect(screen.getByLabelText(/^Client/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    api.on('GET /registry/projects/:id', () => ({ data: registryRecord({ abilities: ABILITIES.viewer }) }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('tab', { name: 'Non-functional' })).toBeInTheDocument()
  })

  it('explains the two-step sign-in gate and keeps the public tabs from the original record', async () => {
    mockApi({ ...registryRoutes(), 'GET /registry/projects/:id': () => reply(403, { message: 'Turn on two-factor authentication.', code: 'mfa_enrollment_required' }) })
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path, authUser: { ...manager, permissions: ['projects'] } })

    expect(await screen.findByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Turn it on' })).toHaveAttribute('href', '/account#mfa')
    expect(tabNames()).toEqual(['Overview', 'Media', 'Team', 'Links'])
    expect(screen.getByLabelText(/^Client/)).toBeEnabled() // a projects-section editor may still edit the public content
  })

  it('shows the same notice when the registry withholds its internal tabs until enrolment', async () => {
    renderPage({ abilities: ABILITIES.contentEditor, over: { mfa_enrollment_required: true } })
    expect(await screen.findByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
    expect(tabNames()).toEqual(PUBLIC)
  })

  it('keeps an older backend (no registry route) read-only for an account without the projects section', async () => {
    mockApi({ 'GET /projects/:id': () => ({ data: legacyProject() }), 'GET /registry/projects/:id': () => reply(404, { message: 'Not found.' }) })
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path, authUser: { ...manager, registry_role: 'viewer' } })

    expect(await screen.findByText(/This server has no project registry yet/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Client/)).toBeDisabled()
  })

  it('names the groups and tabs in Arabic', async () => {
    renderPage({ lang: 'ar' })
    expect(await screen.findByRole('heading', { level: 1, name: 'بوابة أكمي' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: /^المحتوى العام/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'الحسابات والصلاحيات' })).toBeInTheDocument()
  })
})

describe('project page: write controls follow the abilities', () => {
  it('shows the Overview read-only to a viewer: disabled fields, no Save, no add buttons', async () => {
    const { user } = renderPage({ abilities: ABILITIES.viewer })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(screen.getByText('Read only: you cannot change this project’s content.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Client/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(region('Administration').getByLabelText('Owner')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Features' }))
    expect(await screen.findByText('No modules yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add module' })).not.toBeInTheDocument()
  })

  it('lets a developer member edit the sensitive groups', async () => {
    const { user } = renderPage({ abilities: ABILITIES.developerMember, authUser: { ...manager, registry_role: 'developer' } })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    await user.click(screen.getByRole('tab', { name: 'Accounts & permissions' }))
    expect((await findRegion('Authentication and permissions')).getByLabelText('Authentication method')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument()
  })
})

describe('project page: Team and Links follow updatePublic', () => {
  it('shows the team to a viewer without add, edit, delete or drag handles', async () => {
    renderPage({
      abilities: ABILITIES.viewer,
      route: '/projects/7?tab=team',
      extra: { 'GET /projects/:id/team-members': () => paginated([{ id: 1, project_id: 7, name: 'Sara', role_ar: 'مطورة', role_en: 'Developer', tasks_ar: [], tasks_en: [], avatar: null, avatar_url: null, order: 0 }]) },
    })

    expect(await screen.findByText('Sara')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit: Sara' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drag to reorder' })).not.toBeInTheDocument()
  })

  it('keeps the link controls for an editor', async () => {
    renderPage({ abilities: ABILITIES.contentEditor, route: '/projects/7?tab=links' })
    expect(await screen.findByRole('button', { name: 'Add link' })).toBeInTheDocument()
  })
})

describe('project page: section order card', () => {
  it('shows the card on the Overview when the API knows section layouts, read-only for a viewer', async () => {
    renderPage({ abilities: ABILITIES.viewer, over: { section_layout: null }, extra: { 'GET /settings': () => ({ data: { portfolio_sections: null } }) } })
    const sections = await findRegion('Page section order')
    expect(sections.getByRole('switch', { name: /^Use the default order/ })).toBeDisabled()
    expect(sections.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('leaves it out on a backend without them', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })
    expect(screen.queryByRole('region', { name: 'Page section order' })).not.toBeInTheDocument()
  })
})

describe('project page: Overview', () => {
  it('shows the stored industry even when the catalog arrives after the form', async () => {
    let release
    const late = new Promise((resolve) => {
      release = resolve
    })
    renderPage({
      over: { industry_id: 3 },
      extra: { 'GET /registry/industries': () => late.then(() => paginated([{ id: 3, key: 'retail', name_ar: 'التجزئة', name_en: 'Retail', order: 0 }])) },
    })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    release()
    await waitFor(() => expect(screen.getByLabelText(/^Industry/)).toHaveValue('3'))
    expect(screen.getByRole('option', { name: 'Retail' }).selected).toBe(true)
  })

  it('sends the new public fields with the original endpoint, only what changed', async () => {
    const { api, user } = renderPage({
      extra: { 'PUT /projects/:id': ({ body }) => ({ data: { ...legacyProject(), ...body } }) },
    })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(screen.queryByLabelText(/^Status/)).not.toBeInTheDocument() // replaced by the development status
    expect(screen.queryByRole('switch', { name: /Featured project/ })).not.toBeInTheDocument() // in the Publication card
    await user.selectOptions(screen.getByLabelText(/^Development status/), 'maintenance')
    await user.selectOptions(screen.getByLabelText(/^Industry/), '3')
    await user.click(screen.getByRole('checkbox', { name: 'Android' }))
    await user.type(screen.getByLabelText('Business problem (English)'), 'Orders by phone')
    await user.click(screen.getByRole('button', { name: 'Add Highlight' }))
    const item = within(screen.getAllByRole('listitem', { name: 'Highlight 1' })[0])
    await user.type(item.getByLabelText(/^Arabic/), 'طلبات أسرع')
    await user.type(item.getByLabelText(/^English/), 'Faster orders')
    await user.click(saveDetails())

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body).toEqual({
      development_status: 'maintenance',
      industry_id: 3,
      platforms: ['android'],
      business_problem_en: 'Orders by phone',
      highlights: [{ ar: 'طلبات أسرع', en: 'Faster orders' }],
    })
    // completeness may have moved: the registry record is read again
    await waitFor(() => expect(api.calls('GET', '/registry/projects/7').length).toBeGreaterThan(1))
  })

  it('maps a 422 on a non-functional highlight onto its row', async () => {
    const { user } = renderPage({
      over: { nonfunctional_highlights: [{ key: 'security', title: { ar: 'أمان', en: 'Security' }, description: { ar: null, en: null } }] },
      extra: { 'PUT /projects/:id': () => validationError({ 'nonfunctional_highlights.0.title.en': ['The title is too long.'] }) },
    })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    const row = within(screen.getByRole('listitem', { name: 'Item 1' }))
    await user.type(row.getByLabelText(/^Title \(English\)/), '!')
    await user.click(saveDetails())

    expect(await row.findByText('The title is too long.')).toBeInTheDocument()
  })

  it('lets an imported project without client or year be saved', async () => {
    const { api, user } = renderPage({
      over: { client: null, year: null },
      extra: { 'PUT /projects/:id': ({ body }) => ({ data: { ...legacyProject({ client: null, year: null }), ...body } }) },
    })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(screen.getByLabelText(/^Client/)).toHaveValue('')
    await user.type(screen.getByLabelText('Solution (English)'), 'Online ordering')
    await user.click(saveDetails())

    await waitFor(() => expect(api.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(api.calls('PUT', '/projects/7')[0].body).toEqual({ solution_en: 'Online ordering' })
  })

  it('edits the administration group with only the changed field', async () => {
    const { api, user } = renderPage({
      extra: { 'PUT /registry/projects/:id/operations/:group': ({ body }) => ({ data: { group: 'administration', values: { owner_name: 'Layla', ...body } } }) },
    })
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })

    expect(region('Administration').getByLabelText('Owner')).toHaveValue('Layla')
    await user.type(region('Administration').getByLabelText('Technical lead'), 'Sara')
    await user.click(region('Administration').getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/operations/administration')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/operations/administration')[0].body).toEqual({ technical_lead_name: 'Sara' })
  })
})

describe('project page: members', () => {
  const members = [{ id: 1, project_id: 7, user_id: 5, member_role: 'owner', responsibilities: null, user: { id: 5, name: 'Layla', email: 'layla@ngptechworld.com', registry_role: 'manager' } }]
  const accounts = [
    { id: 5, name: 'Layla', email: 'layla@ngptechworld.com', registry_role: 'manager' },
    { id: 6, name: 'Omar', email: 'omar@ngptechworld.com', registry_role: 'developer' },
    { id: 8, name: 'Huda', email: 'huda@ngptechworld.com', registry_role: null },
  ]

  // `GET registry/users`: name or email contains `search`, at most `per_page` (the API refuses more than 50)
  const searchAccounts = (rows) => ({ query }) => {
    if (Number(query.per_page) > 50) return validationError({ per_page: ['The per page field must be between 1 and 50.'] })
    const term = (query.search ?? '').toLowerCase()
    const found = rows.filter((account) => account.registry_role && `${account.name} ${account.email}`.toLowerCase().includes(term))
    return paginated(found.slice(0, Number(query.per_page)), { perPage: Number(query.per_page), total: found.length })
  }
  const picker = () => within(within(screen.getByRole('dialog')).getByRole('radiogroup', { name: 'Matching accounts' }))

  it('lets a super admin add an account that has a registry role and is not a member yet', async () => {
    const { api, user } = renderPage({
      extra: {
        'GET /registry/projects/:id/members': () => paginated(members),
        'GET /registry/users': searchAccounts(accounts),
        'POST /registry/projects/:id/members': ({ body }) => reply(201, { data: { id: 2, project_id: 7, ...body, user: accounts[1] } }),
      },
    })
    expect(await (await findRegion('Project members')).findByText('layla@ngptechworld.com')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Add member' }))
    const dialog = within(screen.getByRole('dialog'))
    // the member is listed but cannot be picked again; an account without a registry role is not listed
    expect(await picker().findByRole('radio', { name: /Omar/ })).toBeEnabled()
    expect(picker().getByRole('radio', { name: /Layla.*Already a member/ })).toBeDisabled()
    expect(picker().queryByRole('radio', { name: /Huda/ })).not.toBeInTheDocument()
    await user.click(picker().getByRole('radio', { name: /Omar/ }))
    expect(dialog.getByText('Selected: Omar')).toBeInTheDocument()
    await user.selectOptions(dialog.getByLabelText('Role on the project'), 'tech_lead')
    await user.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/members')).toHaveLength(1))
    expect(api.calls('POST', '/registry/projects/7/members')[0].body).toEqual({ user_id: 6, member_role: 'tech_lead', responsibilities: null })
    expect(api.calls('GET', '/registry/users').every((call) => Number(call.query.per_page) <= 50)).toBe(true)
  })

  it('searches as you type, 20 accounts at a time, and says when more match than are shown', async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ id: 100 + index, name: `Dev ${index + 1}`, email: `dev${index + 1}@ngptechworld.com`, registry_role: 'developer' }))
    const { api, user } = renderPage({
      abilities: ABILITIES.managerMember,
      authUser: manager,
      extra: {
        'GET /registry/projects/:id/members': () => paginated(members),
        'GET /registry/users': searchAccounts([...accounts, ...many]),
        'POST /registry/projects/:id/members': ({ body }) => reply(201, { data: { id: 2, project_id: 7, ...body, user: many[11] } }),
      },
    })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    await user.click(await screen.findByRole('button', { name: 'Add member' }))
    expect(await picker().findAllByRole('radio')).toHaveLength(20)
    expect(screen.getByText('Showing 20 of 32. Type part of the name or email to narrow the list.')).toBeInTheDocument()
    expect(api.calls('GET', '/registry/users')[0].query).toEqual({ per_page: '20' })

    const before = api.calls('GET', '/registry/users').length
    await user.type(within(screen.getByRole('dialog')).getByRole('searchbox', { name: 'Search accounts' }), 'dev 12')
    await waitFor(() => expect(picker().getAllByRole('radio')).toHaveLength(1))
    // debounced: one request for the whole word, not one per letter
    expect(api.calls('GET', '/registry/users').slice(before).map((call) => call.query)).toEqual([{ search: 'dev 12', per_page: '20' }])
    await user.click(picker().getByRole('radio', { name: /Dev 12/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/members')).toHaveLength(1))
    expect(api.calls('POST', '/registry/projects/7/members')[0].body).toMatchObject({ user_id: 111 })
    expect(api.calls('GET', '/users')).toHaveLength(0)
  })

  it('asks to pick an account before saving', async () => {
    const { api, user } = renderPage({ extra: { 'GET /registry/projects/:id/members': () => paginated(members), 'GET /registry/users': searchAccounts(accounts) } })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    await user.click(await screen.findByRole('button', { name: 'Add member' }))
    await picker().findByRole('radio', { name: /Omar/ })
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    expect(await within(screen.getByRole('dialog')).findByText('This field is required')).toBeInTheDocument()
    expect(api.calls('POST')).toHaveLength(0)
  })

  it('falls back to the users list for a super admin on a backend without registry/users', async () => {
    const { user } = renderPage({ extra: { 'GET /registry/projects/:id/members': () => paginated(members), 'GET /users': () => paginated(accounts) } })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    await user.click(await screen.findByRole('button', { name: 'Add member' }))
    expect(await picker().findByRole('radio', { name: /Omar/ })).toBeEnabled()
    expect(picker().queryByRole('radio', { name: /Huda/ })).not.toBeInTheDocument()
  })

  it('says why a member cannot be added when the account list is refused, and still lets members be changed', async () => {
    renderPage({
      abilities: ABILITIES.managerMember,
      authUser: manager,
      extra: {
        'GET /registry/projects/:id/members': () => paginated(members),
        'GET /registry/users': () => reply(403, { message: 'Turn on two-factor authentication.', code: 'mfa_enrollment_required' }),
      },
    })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    expect(await screen.findByText(/The list of accounts could not be loaded.*Turn on two-step sign-in/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(region('Project members').getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('hides the picker with a hint when the account list is refused for the role', async () => {
    renderPage({
      abilities: ABILITIES.managerMember,
      authUser: manager,
      extra: { 'GET /registry/projects/:id/members': () => paginated(members), 'GET /registry/users': () => reply(403, { message: 'This action is unauthorized.' }) },
    })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    expect(await screen.findByText(/Super admins and registry managers can add members/)).toBeInTheDocument()
    expect(screen.queryByText(/highlighted fields/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
  })

  it('still offers Add while no account has a registry role, and says how to give one', async () => {
    const { user } = renderPage({ extra: { 'GET /registry/projects/:id/members': () => paginated(members), 'GET /registry/users': () => paginated([]) } })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')

    expect(await region('Project members').findByText(/Give the account a role on the Users page first/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add member' }))
    expect(await within(screen.getByRole('dialog')).findByText(/Give the account a role on the Users page first/)).toBeInTheDocument()
  })

  it('warns a manager who removes themselves that they lose access', async () => {
    const own = [{ ...members[0], user_id: manager.id, user: { ...members[0].user, id: manager.id } }]
    const { user } = renderPage({ abilities: ABILITIES.managerMember, authUser: manager, extra: { 'GET /registry/projects/:id/members': () => paginated(own), 'GET /registry/users': () => paginated([]) } })
    const card = await findRegion('Project members')
    await card.findByText('layla@ngptechworld.com')

    await user.click(card.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove yourself from the project members? You lose its sensitive tabs')
  })

  it('shows the list without any change control to a viewer', async () => {
    renderPage({ abilities: ABILITIES.viewer, authUser: { ...manager, registry_role: 'viewer' }, extra: { 'GET /registry/projects/:id/members': () => paginated(members) } })
    await (await findRegion('Project members')).findByText('layla@ngptechworld.com')
    expect(region('Project members').queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByText(/The list of accounts could not be loaded/)).not.toBeInTheDocument()
  })
})

describe('project page: registry tabs', () => {
  it('marks an endpoint verified with a PUT and shows who confirmed it', async () => {
    let endpoint = { id: 4, url: 'https://acme.example/api', kind: 'api', environment: 'production', verification_status: 'unverified', verified_by: null, last_verified_at: null, purpose: null }
    const { api, user } = renderPage({
      route: '/projects/7?tab=environments',
      extra: {
        'GET /registry/projects/:id/endpoints': () => paginated([endpoint]),
        'PUT /registry/projects/:id/endpoints/:item': ({ body }) => {
          // the server signs the confirmation itself
          endpoint = { ...endpoint, ...body, verified_by: 1, last_verified_at: '2026-10-26T09:00:00.000000Z' }
          return { data: endpoint }
        },
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Mark https://acme.example/api verified' }))
    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/endpoints/4')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/endpoints/4')[0].body).toEqual({ verification_status: 'confirmed' })
    expect(await screen.findByText(/Confirmed by Admin on/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark https://acme.example/api unverified' })).toBeInTheDocument()
  })

  it('names who verified an endpoint and who wrote a maintenance record, from the API', async () => {
    const environments = renderPage({
      route: '/projects/7?tab=environments',
      extra: {
        'GET /registry/projects/:id/endpoints': () =>
          paginated([{ id: 4, url: 'https://acme.example', kind: 'production', verification_status: 'confirmed', verified_by: 9, verified_by_name: 'Sara', last_verified_at: '2026-10-26T09:00:00.000000Z' }]),
        'GET /registry/projects/:id/maintenance-records': () =>
          paginated([{ id: 1, type: 'incident', status: 'open', severity: 'high', title: 'Queue stuck', author_id: 9, author_name: 'Sara' }]),
      },
    })
    expect(await screen.findByText(/Confirmed by Sara on/)).toBeInTheDocument()
    environments.unmount()

    renderPage({
      route: '/projects/7?tab=maintenance',
      extra: { 'GET /registry/projects/:id/maintenance-records': () => paginated([{ id: 1, type: 'incident', status: 'open', severity: 'high', title: 'Queue stuck', author_id: 9, author_name: 'Sara' }]) },
    })
    const record = (await screen.findByText('Queue stuck')).closest('tr')
    expect(within(record).getByText('Sara')).toBeInTheDocument()
  })

  it('re-reads the features after a module is deleted (the API clears their module)', async () => {
    const view = renderPage({
      route: '/projects/7?tab=features',
      extra: {
        'GET /registry/projects/:id/modules': () => paginated([{ id: 3, key: 'orders', name_ar: 'الطلبات', name_en: 'Orders' }]),
        'DELETE /registry/projects/:id/modules/:item': () => null,
      },
    })
    const { user, api } = view
    await screen.findByText('Orders')
    const before = api.calls('GET', '/registry/projects/7/features').length

    await user.click(within(screen.getByRole('region', { name: 'Modules' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.calls('GET', '/registry/projects/7/features').length).toBeGreaterThan(before))
    await waitFor(() => expect(api.calls('GET', '/registry/projects/7').length).toBeGreaterThan(1)) // completeness too
  })

  it('locks the public switch of a feature while its change is being saved', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const feature = { id: 5, key: 'cart', module_id: null, name_ar: 'السلة', name_en: 'Cart', status: 'verified', is_public: false, tests: null, evidence: [] }
    const { user } = renderPage({
      route: '/projects/7?tab=features',
      extra: {
        'GET /registry/projects/:id/features': () => paginated([feature]),
        'PUT /registry/projects/:id/features/:item': async ({ body }) => {
          await gate
          return { data: { ...feature, ...body } }
        },
      },
    })
    const toggle = await screen.findByRole('switch', { name: 'Public: Cart' })

    await user.click(toggle)
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    release()
    await waitFor(() => expect(toggle).toBeEnabled())
  })

  it('ticks a secret off the Bitwarden checklist', async () => {
    const secret = { id: 2, ref: 'vault://ngp/acme/db-password', status: 'to_create', provider: 'bitwarden', purpose: null, environment: 'production', related_env_vars: ['DB_PASSWORD'] }
    const { api, user } = renderPage({
      route: '/projects/7?tab=accounts',
      extra: {
        'GET /registry/projects/:id/secret-refs': () => paginated([secret]),
        'PUT /registry/projects/:id/secret-refs/:item': ({ body }) => ({ data: { ...secret, ...body } }),
      },
    })

    expect(await screen.findByText('1 secret to create')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'vault://ngp/acme/db-password created in the vault' }))
    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/secret-refs/2')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/secret-refs/2')[0].body).toEqual({ status: 'exists' })
  })

  it('offers the catalog technologies and the project modules in the selects', async () => {
    const { user } = renderPage({
      route: '/projects/7?tab=tech',
      extra: { 'GET /registry/technologies': () => paginated([{ id: 11, name: 'Laravel', slug: 'laravel', category: 'backend' }]) },
    })

    await user.click(await screen.findByRole('button', { name: 'Add technology' }))
    const select = within(screen.getByRole('dialog')).getByLabelText(/^Technology/)
    expect([...select.options].map((option) => option.textContent)).toEqual(['Choose…', 'Laravel · Backend'])
  })

  it('shows the 16 non-functional attribute cards and documents one', async () => {
    const { api, user } = renderPage({
      route: '/projects/7?tab=nonfunctional',
      extra: {
        'GET /registry/projects/:id/quality-attributes': () => paginated([{ id: 1, attribute: 'security', implemented: ['Sanctum tokens'], verified: [], assumptions: [], recommendations: ['Add MFA'], evidence: [] }]),
        'POST /registry/projects/:id/quality-attributes': ({ body }) => reply(201, { data: { id: 2, ...body } }),
      },
    })

    expect(await (await findRegion('Security')).findByText('Sanctum tokens')).toBeInTheDocument()
    expect(screen.getAllByText('Not documented yet')).toHaveLength(15)
    await user.click(screen.getByRole('button', { name: 'Document Performance' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Implemented'), 'Redis cache, 60 s{Enter}Query eager loading')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/quality-attributes')).toHaveLength(1))
    expect(api.calls('POST', '/registry/projects/7/quality-attributes')[0].body).toEqual({
      attribute: 'performance',
      implemented: ['Redis cache, 60 s', 'Query eager loading'],
      verified: [],
      assumptions: [],
      recommendations: [],
      evidence: [],
    })
  })
})
