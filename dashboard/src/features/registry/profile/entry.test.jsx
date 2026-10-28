import '@/features/projects/testTimeouts'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/AppRoutes'
import projectsFeature from '@/features/projects'
import ProjectEdit from '@/features/projects/ProjectEdit'
import { ABILITIES, registryRoutes } from '@/features/projects/registryTestUtils'
import { mockApi, paginated, reply } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import registryFeature from '../index'
import RegistryProjectList from '../RegistryProjectList'
import { profileRoutes } from './testUtils'

const route = '/projects/7/profile'

describe('ways to the profile', () => {
  const rows = [
    { id: 1, slug: 'dawri', name_ar: 'دوري', name_en: 'Dawri', category: 'web', development_status: 'testing', publication_status: 'published', featured: true, archived_at: null, cover_image_url: null, is_member: true, completeness: { score: 91 } },
    { id: 2, slug: 'souq', name_ar: 'سوق', name_en: 'Souq', category: 'web', development_status: 'maintenance', publication_status: 'draft', featured: false, archived_at: null, cover_image_url: null, is_member: false, completeness: { score: 40 } },
  ]

  it('is offered in the project page header', async () => {
    mockApi(registryRoutes())
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
    expect(await screen.findByRole('link', { name: 'View project profile' })).toHaveAttribute('href', '/projects/7/profile')
  })

  it('is not offered when this server has no registry', async () => {
    mockApi({ ...registryRoutes(), 'GET /registry/projects/:id': () => reply(404, { message: 'Not found.' }) })
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
    expect(await screen.findByText(/This server has no project registry yet/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View project profile' })).not.toBeInTheDocument()
  })

  it('is a row action of the registry list, and each card opens it', async () => {
    mockApi({ 'GET /registry/projects': () => paginated(rows, { perPage: 25 }) })
    const { user } = renderWithProviders(<RegistryProjectList />, { route: '/registry/projects' })

    expect(await screen.findByRole('link', { name: 'Profile of Dawri' })).toHaveAttribute('href', '/projects/1/profile')
    expect(screen.getByRole('link', { name: 'Open Dawri' })).toHaveAttribute('href', '/projects/1')

    await user.click(screen.getByRole('button', { name: 'Cards' }))
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    const cards = screen.getByRole('list', { name: 'Registry projects' })
    const card = within(cards).getByRole('link', { name: 'Profile of Souq' })
    expect(card).toHaveAttribute('href', '/projects/2/profile')
    expect(within(card).getByText('Maintenance')).toBeInTheDocument()
    expect(within(card).getByRole('progressbar', { name: 'Completeness 40%' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('ngp_registry_list_view')).toBe('cards')
  })

  it('opens for a projects-section editor without a registry role, who may view every project', async () => {
    const editor = { ...testUser, is_super_admin: false, role: 'admin', permissions: ['projects'], registry_role: null }
    mockApi(profileRoutes({ abilities: ABILITIES.contentEditor }))
    renderWithProviders(<AppRoutes features={[registryFeature, projectsFeature]} />, { route, authUser: editor })
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Features' })).toBeInTheDocument()
  })
})
