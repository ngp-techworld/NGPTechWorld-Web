import '@/features/projects/testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ABILITIES } from '@/features/projects/registryTestUtils'
import { mockApi, paginated, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { SEGMENTS, SEGMENT_TIERS } from './data'
import ProjectProfile from './ProjectProfile'
import { COLLECTIONS, envVar, profileRoutes as routes } from './testUtils'

const path = '/projects/:id/profile'
const route = '/projects/7/profile'
const base = '/registry/projects/7'

function renderProfile({ lang, authUser, ...options } = {}) {
  const api = mockApi(routes(options))
  const view = renderWithProviders(<ProjectProfile />, { route, path, lang, authUser })
  return { api, ...view }
}

const tocLinks = () => within(screen.getByRole('navigation', { name: 'Profile sections' })).getAllByRole('link').map((link) => link.textContent.replace(/\(.*\)$/, '').trim())
const segmentCalls = (api, segment) => api.calls('GET', `${base}/${segment}`)
const section = (name) => screen.getByRole('region', { name })
const findSection = (name) => screen.findByRole('region', { name })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('project profile: tiers', () => {
  it('shows a view-only caller the public sections only and never requests an internal or sensitive collection', async () => {
    const { api } = renderProfile({ abilities: ABILITIES.contentEditor })
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()
    await findSection('Features')

    expect(tocLinks()).toEqual(['Summary', 'Overview', 'Features', 'Technologies'])
    for (const name of ['Team and administration', 'Sign-in accounts', 'Deployment and running', 'Quality', 'Maintenance and risks']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
    }
    SEGMENTS.filter((segment) => SEGMENT_TIERS[segment] !== 'public').forEach((segment) => expect(segmentCalls(api, segment)).toHaveLength(0))
    expect(segmentCalls(api, 'features')).toHaveLength(1)
    // no quick links without the endpoints (sensitive) and without a public demo link
    expect(screen.queryByText('Quick links')).not.toBeInTheDocument()
  })

  it('opens the internal sections to a registry viewer but never requests a sensitive collection', async () => {
    const { api } = renderProfile({ abilities: ABILITIES.viewer })
    await findSection('Maintenance and risks')

    expect(tocLinks()).toEqual(['Summary', 'Overview', 'Team and administration', 'Features', 'Technologies', 'Maintenance and risks'])
    expect(screen.queryByRole('region', { name: 'Sign-in accounts' })).not.toBeInTheDocument()
    SEGMENTS.filter((segment) => SEGMENT_TIERS[segment] === 'sensitive').forEach((segment) => expect(segmentCalls(api, segment)).toHaveLength(0))
    expect(segmentCalls(api, 'maintenance-records')).toHaveLength(1)
  })

  it('shows a super admin every section that holds something, each with its tier', async () => {
    const { api } = renderProfile()
    await findSection('Sign-in accounts')
    await waitFor(() => expect(screen.getByRole('table', { name: 'Environment variables' })).toBeInTheDocument())

    expect(tocLinks()).toEqual([
      'Summary',
      'Overview',
      'Team and administration',
      'Sign-in accounts',
      'Environments, links and servers',
      'Deployment and running',
      'Features',
      'Technologies',
      'Maintenance and risks',
    ])
    expect(section('Sign-in accounts')).toHaveAttribute('data-tier', 'sensitive')
    expect(within(section('Sign-in accounts')).getByText(/Project members only/)).toBeInTheDocument()
    expect(section('Maintenance and risks')).toHaveAttribute('data-tier', 'internal')
    expect(within(section('Maintenance and risks')).getByText(/NGP staff only/)).toBeInTheDocument()
    expect(section('Features')).toHaveAttribute('data-tier', 'public')
    // every collection was read once, each with the largest page
    SEGMENTS.forEach((segment) => expect(segmentCalls(api, segment)).toHaveLength(1))
    expect(segmentCalls(api, 'env-vars')[0].query).toEqual({ per_page: '200', page: '1' })
    // the production links of the endpoints are quick links that open in a new tab, without this page
    const quick = within(section('Acme Portal')).getByRole('link', { name: /acme\.test\/admin/ })
    expect(quick).toHaveAttribute('href', 'https://acme.test/admin')
    expect(quick).toHaveAttribute('target', '_blank')
    expect(quick).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says what a section misses when it holds nothing yet', async () => {
    renderProfile({ collections: { ...COLLECTIONS, technologies: [] } })
    // the fixture's completeness misses `repositories` (operations): the deployment section says so
    const deployment = await findSection('Deployment and running')
    expect(within(deployment).getByText('Not recorded yet:')).toBeInTheDocument()
    expect(within(deployment).getByText('At least one repository')).toBeInTheDocument()
    // technologies hold nothing and are not among the missing checks: no section at all
    await findSection('Features')
    expect(screen.queryByRole('region', { name: 'Technologies' })).not.toBeInTheDocument()
  })
})

describe('project profile: data', () => {
  it('reads every page of a long collection (250 env vars, 200 a page)', async () => {
    const all = Array.from({ length: 250 }, (_, index) => envVar(index + 1, `VAR_${index + 1}`))
    const api = mockApi(
      routes({
        extra: {
          [`GET ${base}/env-vars`]: ({ query }) => {
            const page = Number(query.page)
            return paginated(all.slice((page - 1) * 200, page * 200), { page, perPage: 200, total: 250 })
          },
        },
        collections: Object.fromEntries(Object.entries(COLLECTIONS).filter(([segment]) => segment !== 'env-vars')),
      }),
    )
    renderWithProviders(<ProjectProfile />, { route, path })

    const table = await screen.findByRole('table', { name: 'Environment variables' })
    expect(within(table).getAllByRole('row')).toHaveLength(251) // the header row + 250
    expect(within(table).getByText('VAR_250')).toBeInTheDocument()
    expect(segmentCalls(api, 'env-vars').map((call) => call.query)).toEqual([
      { per_page: '200', page: '1' },
      { per_page: '200', page: '2' },
    ])
  })

  it('shows a failed collection with Retry inside its section while the others render', async () => {
    const api = mockApi(routes({ extra: { [`GET ${base}/features`]: () => reply(500, { message: 'boom' }) } }))
    const { user } = renderWithProviders(<ProjectProfile />, { route, path })

    const features = await findSection('Features')
    expect(await within(features).findByText('“Features” could not be loaded.')).toBeInTheDocument()
    expect(within(await findSection('Technologies')).getByText('Laravel')).toBeInTheDocument()
    expect(within(await findSection('Sign-in accounts')).getByText('Account 1')).toBeInTheDocument()

    api.on(`GET ${base}/features`, () => paginated(COLLECTIONS.features, { perPage: 200 }))
    await user.click(within(features).getByRole('button', { name: 'Try again' }))
    expect(await within(features).findByText('Online ordering')).toBeInTheDocument()
  })

  it('sorts the risks by severity, critical first', async () => {
    renderProfile()
    const risks = await screen.findByRole('list', { name: 'Risks' })
    const titles = within(risks).getAllByText(/risk:/).map((node) => node.textContent)
    expect(titles).toEqual(['Critical risk: no backups', 'Low risk: logs fill the disk'])
  })
})

describe('project profile: screenshots', () => {
  const shot = (id, over = {}) => ({ id, project_id: 7, title_ar: `لقطة ${id}`, title_en: `Screen ${id}`, platform: 'desktop', is_public: true, is_cover: false, url: `https://cdn.test/${id}.webp`, thumbnail_url: `https://cdn.test/${id}-480.webp`, order: id, ...over })

  it('opens a screenshot in a lightbox and steps through them', async () => {
    const { user } = renderProfile({ collections: { ...COLLECTIONS, screenshots: [shot(1, { is_cover: true }), shot(2, { is_public: false })] } })
    const screenshots = await findSection('Screenshots')
    expect(within(screenshots).getByText('Private')).toBeInTheDocument()

    await user.click(within(screenshots).getByRole('button', { name: 'View Screen 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Screen 1' })
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Screen 1' })).toHaveAttribute('src', 'https://cdn.test/1.webp')

    await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Screen 2' })).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('project profile: sign-in accounts', () => {
  it('shows every account with its vault reference and never a password', async () => {
    const { container } = renderProfile()
    const access = await findSection('Sign-in accounts')
    await within(access).findByText('Account 1')

    expect(within(access).getByText('Passwords are kept in the Bitwarden vault; the reference tells you where.')).toBeInTheDocument()
    const rows = within(within(access).getByRole('table', { name: 'Project accounts' })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('vault://ngp/acme/production/account-1')).toBeInTheDocument()
    expect(within(rows[1]).getByText('vault://ngp/acme/staging/owner')).toBeInTheDocument()
    // the checklist of vault references
    expect(within(access).getByText('vault://ngp/acme/production/app-key')).toBeInTheDocument()
    expect(within(access).getByText('1 secret to create')).toBeInTheDocument()
    // the vault column holds references only, and nothing on the page can hold or show a password
    rows.forEach((row) => expect(row.querySelector('[data-vault-ref]')?.textContent).toMatch(/^vault:\/\//))
    expect(container.querySelector('input[type="password"]')).toBeNull()
  })

  it('copies a vault reference and says so', async () => {
    const { user } = renderProfile()
    const access = await findSection('Sign-in accounts')
    await within(access).findByText('Account 1')

    await user.click(within(access).getByRole('button', { name: 'Copy the reference vault://ngp/acme/production/account-1' }))
    expect(await screen.findByText('Vault reference copied')).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe('vault://ngp/acme/production/account-1')
  })
})

describe('project profile: search, contents and print', () => {
  it('filters the env vars with the page search and marks the matches', async () => {
    const { user } = renderProfile()
    const table = await screen.findByRole('table', { name: 'Environment variables' })
    expect(within(table).getAllByRole('row')).toHaveLength(4)

    await user.type(screen.getByRole('searchbox', { name: 'Search this profile' }), 'db_')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3))
    expect(within(table).queryByText('APP_NAME')).not.toBeInTheDocument()
    // the names and the purposes that match are marked
    const marks = [...table.querySelectorAll('mark')].map((mark) => mark.textContent)
    expect(marks).toEqual(['DB_', 'DB_', 'DB_', 'DB_'])
  })

  it('links each entry of the table of contents to its section', async () => {
    renderProfile()
    await findSection('Sign-in accounts')
    const nav = screen.getByRole('navigation', { name: 'Profile sections' })
    const link = within(nav).getByRole('link', { name: /Sign-in accounts/ })
    expect(link).toHaveAttribute('href', '#profile-access')
    expect(document.getElementById('profile-access')).toBe(section('Sign-in accounts'))
    expect(within(nav).getByRole('link', { name: /Summary/ })).toHaveAttribute('href', '#profile-summary')
  })

  it('prints the page', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const { user } = renderProfile()
    await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })
    await user.click(screen.getByRole('button', { name: 'Print / save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('reads in Arabic, right to left, with its names in both languages', async () => {
    renderProfile({ lang: 'ar' })
    expect(await screen.findByRole('heading', { level: 1, name: 'بوابة أكمي' })).toBeInTheDocument()
    expect(screen.getByText('Acme Portal')).toHaveAttribute('dir', 'ltr')
    expect(await screen.findByRole('region', { name: 'حسابات الدخول' })).toBeInTheDocument()
    expect(screen.getByText('كلمات المرور محفوظة في خزنة Bitwarden، والمرجع يدلّك على مكانها.')).toBeInTheDocument()
  })
})

describe('project profile: the two-step sign-in gate', () => {
  it('shows the notice and the public part when the registry withholds the internal tiers', async () => {
    const { api } = renderProfile({ abilities: ABILITIES.contentEditor, over: { mfa_enrollment_required: true } })
    expect(await screen.findByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
    expect(await findSection('Features')).toBeInTheDocument()
    expect(segmentCalls(api, 'members')).toHaveLength(0)
  })

  it('shows the notice when a collection answers 403 mfa_enrollment_required, and keeps the rest', async () => {
    const gate = () => reply(403, { message: 'Turn on two-factor authentication.', code: 'mfa_enrollment_required' })
    renderProfile({ abilities: ABILITIES.viewer, extra: { [`GET ${base}/maintenance-records`]: gate, [`GET ${base}/members`]: gate } })

    expect(await screen.findByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
    const maintenance = await findSection('Maintenance and risks')
    expect(await within(maintenance).findByText(/Turn on two-step sign-in on your account page/)).toBeInTheDocument()
    expect(within(maintenance).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(within(await findSection('Features')).getByText('Online ordering')).toBeInTheDocument()
  })

  it('explains a profile that cannot be read at all', async () => {
    mockApi({ 'GET /registry/projects/:id': () => reply(403, { message: 'Turn on two-factor authentication.', code: 'mfa_enrollment_required' }) })
    renderWithProviders(<ProjectProfile />, { route, path })
    expect(await screen.findByText('The project profile could not be loaded.')).toBeInTheDocument()
    expect(screen.getByText('Two-step sign-in is required to open internal and sensitive project data.')).toBeInTheDocument()
  })
})
