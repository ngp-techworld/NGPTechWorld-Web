import { screen, waitFor, within } from '@testing-library/react'
import { useRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockApi, paginated, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import feature from './index'
import './testTimeouts'
import { enter, makeMember, makeProject, showProject } from './testUtils'

// The feature's own route table, mounted like the app does (absolute paths inside the router of renderWithProviders)
function FeatureRoutes() {
  return useRoutes(feature.routes.map((route) => ({ ...route, path: `/${route.path}` })))
}

describe('projects feature', () => {
  it('registers itself as the Projects menu entry with the three routes', () => {
    expect(feature.id).toBe('projects')
    expect(feature.nav).toMatchObject({ order: 30, group: 'content', to: '/projects', label: { ar: 'المشاريع', en: 'Projects' } })
    expect(feature.routes.map((route) => route.path)).toEqual(['projects', 'projects/new', 'projects/:id', 'projects/:id/profile'])
  })

  it('walks the whole flow: list → new → save → Team tab of the saved project → add a member → back to the list', async () => {
    let created = null
    let members = []
    const server = mockApi({
      'GET /projects': () => paginated(created ? [makeProject(9, created)] : []),
      'POST /projects': ({ body }) => {
        created = body
        return reply(201, { data: showProject(9, body) })
      },
      'GET /projects/:id': () => ({ data: showProject(9, { ...created, team_members: members }) }),
      'GET /projects/:id/team-members': () => paginated(members),
      'POST /projects/:id/team-members': ({ body }) => {
        const member = makeMember(1, { ...body, project_id: 9 })
        members = [member]
        return reply(201, { data: member })
      },
    })
    const { user } = renderWithProviders(<FeatureRoutes />, { route: '/projects' })

    // list is empty → open the create page from the header button
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'New project' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Add a project' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Category/), 'ai')
    await enter(user, screen.getByLabelText(/^Client/), 'Nile Bank')
    await enter(user, screen.getByLabelText('Project name (Arabic)'), 'نواة')
    await enter(user, screen.getByLabelText('Project name (English)'), 'Core')
    await enter(user, screen.getByLabelText('Short description (Arabic)'), 'قصير')
    await enter(user, screen.getByLabelText('Short description (English)'), 'Short')
    await enter(user, screen.getByLabelText('Full description (Arabic)'), 'طويل')
    await enter(user, screen.getByLabelText('Full description (English)'), 'Long')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // saved as a draft → the project page (its Overview), then its Team tab
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/projects\/9$/))
    expect(server.calls('POST', '/projects')[0].body.publication_status).toBe('draft')
    expect(await screen.findByRole('heading', { level: 1, name: 'Core' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Team/ }))
    expect(screen.getByRole('tab', { name: /^Team/ })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('No team members yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add member' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Add a team member' }))
    await enter(user, dialog.getByLabelText(/^Name/), 'Sara')
    await enter(user, dialog.getByLabelText('Role (Arabic)'), 'مطورة')
    await enter(user, dialog.getByLabelText('Role (English)'), 'Developer')
    await user.click(dialog.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Sara')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Team/ })).toHaveAccessibleName(/^Team\s*1$/))
    expect(server.calls('POST', '/projects/9/team-members')[0].body).toMatchObject({ name: 'Sara', avatar: null, tasks_ar: [], tasks_en: [] })
    expect(server.calls('PUT')).toHaveLength(0)

    // back to the list, which now has the project with its team count
    await user.click(screen.getByRole('link', { name: 'Projects' }))
    expect(await screen.findByText('Core')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/projects/9')
  })
})
