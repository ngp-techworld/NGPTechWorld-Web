import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { GroupForm } from './GroupForm'
import { toOptions } from './form'
import { registryProjects } from './hooks'

const fields = [
  { name: 'owner_name', type: 'text', label: 'Owner', max: 255 },
  { name: 'technical_lead_name', type: 'text', label: 'Technical lead', max: 255 },
  { name: 'priority', type: 'select', label: 'Priority', options: toOptions(['low', 'high'], { low: 'Low', high: 'High' }) },
  { name: 'maintenance_responsibility', type: 'textarea', label: 'Maintenance responsibility' },
  {
    name: 'assigned_developers',
    type: 'objectList',
    label: 'Assigned developers',
    itemLabel: 'Developer',
    fields: [
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'commits', type: 'number', label: 'Commits' },
    ],
  },
]

const values = { owner_name: 'Layla', technical_lead_name: null, priority: 'high', maintenance_responsibility: null, assigned_developers: [{ name: 'Omar', source: 'git', commits: 12 }] }
const SECRET = 'The maintenance responsibility looks like it contains a password, key or token. Store it in the vault and record its vault:// reference instead.'

function render(props = {}) {
  return renderWithProviders(<GroupForm projectId={7} group="administration" title="Administration" fields={fields} values={values} canWrite {...props} />)
}
const form = () => within(screen.getByRole('region', { name: 'Administration' }))

describe('GroupForm', () => {
  it('loads the group, keeps Save off until something changes and sends only the changed field', async () => {
    const api = mockApi({
      'PUT /registry/projects/:id/operations/:group': ({ body }) => ({ data: { group: 'administration', values: { ...values, ...body } } }),
    })
    const { user, queryClient } = render()
    queryClient.setQueryData(registryProjects.keys.one(7), { id: 7, operations: { administration: values } })

    expect(form().getByLabelText('Owner')).toHaveValue('Layla')
    expect(form().getByLabelText('Priority')).toHaveValue('high')
    expect(form().getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(form().getByLabelText('Technical lead'), 'Sara')
    await user.click(form().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/operations/administration')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/operations/administration')[0].body).toEqual({ technical_lead_name: 'Sara' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await waitFor(() => expect(form().getByRole('button', { name: 'Save' })).toBeDisabled()) // re-based on the stored values
    expect(queryClient.getQueryData(registryProjects.keys.one(7)).operations.administration.technical_lead_name).toBe('Sara')
  })

  it('sends a list of records whole, and clears a field with null', async () => {
    const api = mockApi({
      'PUT /registry/projects/:id/operations/:group': ({ body }) => ({ data: { group: 'administration', values: { ...values, ...body } } }),
    })
    const { user } = render()

    await user.clear(form().getByLabelText('Owner'))
    await user.click(form().getByRole('button', { name: 'Add Developer' }))
    const second = within(form().getByRole('listitem', { name: 'Developer 2' }))
    await user.type(second.getByLabelText(/^Name/), 'Huda')
    await user.click(form().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT')).toHaveLength(1))
    expect(api.calls('PUT')[0].body).toEqual({
      owner_name: null,
      assigned_developers: [
        { name: 'Omar', source: 'git', commits: 12 },
        { name: 'Huda', commits: null },
      ],
    })
  })

  it('shows a "looks like a secret" refusal next to the field, in plain words', async () => {
    mockApi({ 'PUT /registry/projects/:id/operations/:group': () => validationError({ maintenance_responsibility: [SECRET] }) })
    const { user } = render()

    await user.type(form().getByLabelText('Maintenance responsibility'), 'root password: Hunter2024')
    await user.click(form().getByRole('button', { name: 'Save' }))

    expect(await form().findByText(/This looks like a password, key or token\. Store the secret in the vault \(Bitwarden\) and record only its vault:\/\/ reference here\./)).toBeInTheDocument()
    expect(form().getByLabelText('Maintenance responsibility')).toHaveAttribute('aria-invalid', 'true')
    expect(form().getByLabelText('Maintenance responsibility')).toHaveValue('root password: Hunter2024')
  })

  it('checks list items before sending', async () => {
    const api = mockApi({})
    const { user } = render()

    await user.click(form().getByRole('button', { name: 'Add Developer' }))
    await user.click(form().getByRole('button', { name: 'Save' }))

    expect(await form().findByText('This field is required')).toBeInTheDocument()
    expect(api.requests).toHaveLength(0)
  })

  it('is read-only without the write ability', () => {
    render({ canWrite: false })

    expect(form().getByLabelText('Owner')).toBeDisabled()
    expect(form().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(form().queryByRole('button', { name: 'Add Developer' })).not.toBeInTheDocument()
    expect(form().getByText('Read only: you cannot change this.')).toBeInTheDocument()
  })
})
