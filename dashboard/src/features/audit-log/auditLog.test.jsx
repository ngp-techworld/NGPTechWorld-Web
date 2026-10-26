import '@/features/projects/testTimeouts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/AppRoutes'
import { mockApi, paginated } from '@/test/mockApi'
import { renderWithProviders, testUser } from '@/test/renderWithProviders'
import AuditLogPage from './AuditLogPage'
import auditLog from './index'

const entries = [
  {
    id: 41,
    action: 'updated',
    user: { id: 1, name: 'Admin' },
    project_id: 7,
    subject_type: 'ProjectServer',
    subject_id: 3,
    changes: { public_hostname: ['old.example', 'new.example'], ssh_port: [22, 2222] },
    ip: '10.0.0.5',
    user_agent: 'Firefox',
    created_at: '2026-10-26T09:30:00.000000Z',
  },
  { id: 40, action: 'viewed_sensitive', user: { id: 2, name: 'Layla' }, project_id: 7, subject_type: null, subject_id: null, changes: null, ip: null, user_agent: null, created_at: '2026-10-26T09:00:00.000000Z' },
]

function server(extra = {}) {
  return mockApi({
    'GET /registry/audit-logs': () => paginated(entries, { perPage: 50 }),
    'GET /registry/projects': () => paginated([{ id: 7, name_ar: 'بوابة أكمي', name_en: 'Acme Portal' }]),
    'GET /users': () => paginated([{ id: 2, name: 'Layla' }]),
    ...extra,
  })
}

describe('audit log', () => {
  it('is a system entry for super admins only', () => {
    expect(auditLog).toMatchObject({ id: 'audit-log', nav: { group: 'system', to: '/audit-log' } })
  })

  it('has no route for a registry manager', () => {
    mockApi({})
    renderWithProviders(<AppRoutes features={[auditLog]} />, { route: '/audit-log', authUser: { ...testUser, is_super_admin: false, role: 'admin', permissions: [], registry_role: 'manager' } })
    expect(screen.queryByRole('heading', { name: 'Audit log' })).not.toBeInTheDocument()
  })

  it('lists who did what to which record, newest first as the API sends it', async () => {
    server()
    renderWithProviders(<AuditLogPage />, { route: '/audit-log' })

    const first = (await screen.findByText('Server #3')).closest('tr')
    expect(within(first).getByText('Updated')).toBeInTheDocument()
    expect(within(first).getByText('Admin')).toBeInTheDocument()
    expect(await within(first).findByRole('link', { name: 'Acme Portal' })).toHaveAttribute('href', '/projects/7')
    expect(within(first).getByText('10.0.0.5')).toBeInTheDocument()
    expect(within(screen.getByText('Layla', { selector: 'td' }).closest('tr')).getByText('Read sensitive data')).toBeInTheDocument()
  })

  it('filters by action, record type, user, project and dates, in the URL', async () => {
    const api = server()
    const { user } = renderWithProviders(<AuditLogPage />, { route: '/audit-log' })
    await screen.findByText('Server #3')

    await user.selectOptions(screen.getByLabelText('Action'), 'published')
    await user.selectOptions(screen.getByLabelText('Record type'), 'ProjectAccount')
    await waitFor(() => expect(screen.getByLabelText('User').options.length).toBeGreaterThan(1))
    await user.selectOptions(screen.getByLabelText('User'), '2')
    await waitFor(() => expect(screen.getByLabelText('Project').options.length).toBeGreaterThan(1))
    await user.selectOptions(screen.getByLabelText('Project'), '7')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } })

    await waitFor(() =>
      expect(api.calls('GET', '/registry/audit-logs').at(-1).query).toMatchObject({ action: 'published', subject: 'ProjectAccount', user_id: '2', project_id: '7', from: '2026-10-01', per_page: '50' }),
    )
    expect(screen.getByTestId('location')).toHaveTextContent('action=published')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(api.calls('GET', '/registry/audit-logs').at(-1).query).toEqual({ page: '1', per_page: '50' }))
  })

  it('shows the changed values of an event', async () => {
    server()
    const { user } = renderWithProviders(<AuditLogPage />, { route: '/audit-log' })

    await user.click(await screen.findByRole('button', { name: 'Details of event #41' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Event details' }))
    const row = dialog.getByRole('rowheader', { name: 'public_hostname' }).closest('tr')
    expect(within(row).getByText('old.example')).toBeInTheDocument()
    expect(within(row).getByText('new.example')).toBeInTheDocument()
    expect(dialog.getByText('2222')).toBeInTheDocument()
    expect(dialog.getByText(/Firefox/)).toBeInTheDocument()
  })
})
