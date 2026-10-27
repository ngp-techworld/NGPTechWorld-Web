import '@/features/projects/testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/AppRoutes'
import projectsFeature from '@/features/projects'
import { ABILITIES, registryRoutes } from '@/features/projects/registryTestUtils'
import { mockApi, paginated, reply } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import RegistryOverview from './RegistryOverview'
import RegistryProjectList from './RegistryProjectList'
import registry from './index'

const counts = {
  total: 12,
  active: 7,
  completed: 3,
  under_development: 4,
  maintenance: 2,
  public: 8,
  internal_only: 3,
  missing_documentation: 5,
  missing_screenshots: 1,
  missing_operations: 6,
}
const viewer = { ...testUser, is_super_admin: false, role: 'admin', permissions: [], registry_role: 'viewer' }
const manager = { ...viewer, registry_role: 'manager' }

const row = (id, over = {}) => ({
  id,
  slug: `project-${id}`,
  project_uid: `uid-${id}`,
  name_ar: `مشروع ${id}`,
  name_en: `Project ${id}`,
  category: 'web',
  development_status: 'in_development',
  publication_status: 'draft',
  featured: false,
  archived_at: null,
  cover_image_url: null,
  is_member: false,
  completeness: { documentation: { complete: true, missing: [] }, screenshots: { complete: true, missing: [] }, operations: { complete: true, missing: [] }, score: 64 },
  updated_at: '2026-10-20T10:00:00.000000Z',
  ...over,
})

describe('registry feature', () => {
  it('registers the overview, the list and the shared project page', () => {
    expect(registry.id).toBe('registry')
    expect(registry.nav).toMatchObject({ group: 'main', to: '/registry' })
    expect(registry.routes.map((route) => route.path)).toEqual(['registry', 'registry/projects', 'projects/new', 'projects/:id'])
  })

  it('lets a registry-only account open a project page (no projects section needed)', async () => {
    mockApi(registryRoutes({ abilities: ABILITIES.viewer }))
    renderWithProviders(<AppRoutes features={[registry, projectsFeature]} />, { route: '/projects/7', authUser: viewer })

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/registry/projects') // back to a list it can open
  })
})

describe('RegistryOverview', () => {
  it('shows the 10 counters, each linking to the list filtered the same way', async () => {
    mockApi({ 'GET /registry/overview': () => ({ data: counts }) })
    renderWithProviders(<RegistryOverview />, { route: '/registry' })

    await screen.findByText('Missing documentation')
    const cards = within(screen.getByRole('region', { name: 'Registry overview' })).getAllByRole('link')
    expect(cards).toHaveLength(10)
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/registry/projects?archived=all',
      '/registry/projects?development_status=planning,in_development,testing,maintenance',
      '/registry/projects?development_status=completed',
      '/registry/projects?development_status=in_development,testing',
      '/registry/projects?development_status=maintenance',
      '/registry/projects?publication_status=published',
      '/registry/projects?publication_status=draft',
      '/registry/projects?incomplete=documentation',
      '/registry/projects?incomplete=screenshots',
      '/registry/projects?incomplete=operations',
    ])
    expect(cards[7]).toHaveTextContent('Missing documentation5')
    expect(cards[0]).toHaveTextContent('Archived included')
  })

  it('offers "New project" to those who may create projects only', async () => {
    mockApi({ 'GET /registry/overview': () => ({ data: counts }) })
    const { unmount } = renderWithProviders(<RegistryOverview />, { route: '/registry', authUser: manager })
    expect(await screen.findByRole('link', { name: 'New project' })).toHaveAttribute('href', '/projects/new')
    unmount()

    renderWithProviders(<RegistryOverview />, { route: '/registry', authUser: viewer })
    await screen.findByText('Missing screenshots')
    expect(screen.queryByRole('link', { name: 'New project' })).not.toBeInTheDocument()
  })

  it('offers a retry when the counters cannot be loaded', async () => {
    const api = mockApi({ 'GET /registry/overview': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<RegistryOverview />, { route: '/registry' })

    expect(await screen.findByText('The numbers could not be loaded.')).toBeInTheDocument()
    api.on('GET /registry/overview', () => ({ data: counts }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Under development')).toBeInTheDocument()
  })
})

describe('RegistryProjectList', () => {
  const rows = [
    row(1, { name_en: 'Dawri', development_status: 'completed', publication_status: 'published', featured: true, is_member: true, publication: { ready: false, missing: ['cover'] }, completeness: { ...row(1).completeness, score: 91 } }),
    row(2, { name_en: 'Souq', development_status: 'maintenance' }),
  ]

  it('shows development status, publication, completeness and membership', async () => {
    mockApi({ 'GET /registry/projects': () => paginated(rows, { perPage: 25 }) })
    renderWithProviders(<RegistryProjectList />, { route: '/registry/projects' })

    const first = (await screen.findByText('Dawri')).closest('tr')
    expect(within(first).getByText('Completed')).toBeInTheDocument()
    expect(within(first).getByText('Published')).toBeInTheDocument()
    expect(within(first).getByText('Featured on the home page')).toBeInTheDocument()
    expect(within(first).getByText('Published but lacks what its page needs')).toBeInTheDocument()
    expect(within(first).getByRole('progressbar', { name: 'Completeness 91%' })).toHaveAttribute('aria-valuenow', '91')
    expect(within(first).getByText('Member')).toBeInTheDocument()
    const second = screen.getByText('Souq').closest('tr')
    expect(within(second).getByText('Maintenance')).toBeInTheDocument()
    expect(within(second).queryByText('Member')).not.toBeInTheDocument()
  })

  it('sends the filters of a card link to the API as they are', async () => {
    const api = mockApi({ 'GET /registry/projects': () => paginated(rows) })
    renderWithProviders(<RegistryProjectList />, { route: '/registry/projects?development_status=planning,in_development,testing,maintenance&incomplete=operations' })

    await screen.findByText('Dawri')
    expect(api.calls('GET', '/registry/projects')[0].query).toEqual({ page: '1', per_page: '25', development_status: 'planning,in_development,testing,maintenance', incomplete: 'operations' })
    expect(screen.getByLabelText('Development status')).toHaveValue('planning,in_development,testing,maintenance')
    expect(screen.getByLabelText('Missing')).toHaveValue('operations')
  })

  it('filters by publication, category, search, mine and archived, in the URL', async () => {
    const api = mockApi({ 'GET /registry/projects': () => paginated(rows) })
    const { user } = renderWithProviders(<RegistryProjectList />, { route: '/registry/projects' })
    await screen.findByText('Dawri')

    await user.selectOptions(screen.getByLabelText('Publication'), 'published')
    await user.selectOptions(screen.getByLabelText('Category'), 'mobile')
    await user.click(screen.getByRole('checkbox', { name: 'My projects only' }))
    await user.selectOptions(screen.getByLabelText('Archive'), 'all')
    await user.type(screen.getByRole('searchbox'), 'daw')

    await waitFor(() => expect(api.calls('GET', '/registry/projects').at(-1).query).toMatchObject({ publication_status: 'published', category: 'mobile', mine: '1', archived: 'all', search: 'daw' }))
    expect(screen.getByTestId('location')).toHaveTextContent('publication_status=published')
  })

  it('opens a project from its row', async () => {
    mockApi({ 'GET /registry/projects': () => paginated(rows) })
    const { user } = renderWithProviders(<RegistryProjectList />, { route: '/registry/projects' })

    await user.click(await screen.findByText('Souq'))
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/2')
    expect(screen.getByRole('link', { name: 'Open Dawri' })).toHaveAttribute('href', '/projects/1')
  })

  it('says when nothing matches the filters', async () => {
    mockApi({ 'GET /registry/projects': () => paginated([]) })
    renderWithProviders(<RegistryProjectList />, { route: '/registry/projects?incomplete=screenshots' })
    expect(await screen.findByText('No results')).toBeInTheDocument()
  })
})
