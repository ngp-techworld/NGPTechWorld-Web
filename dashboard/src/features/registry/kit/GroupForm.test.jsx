import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { GroupForm } from './GroupForm'
import { toOptions } from './form'
import { registryProjects } from './hooks'
import { authFields, dataFields, deploymentFields, monitoringFields } from '@/features/projects/registry/groups'
import tabStrings from '@/features/projects/registry/strings'
import kitStrings from './strings'

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

describe('GroupForm with the real deployment fields', () => {
  const fieldsOf = deploymentFields({ t: tabStrings.en, r: kitStrings.en })
  const empty = { deploy_method: null, ci_cd_provider: null, workflows: null, build_artifacts: null, release_strategy: null, release_version: null, rollback_procedure: null, deploy_verification: null, deploy_permissions: null, deploy_responsible_admin: null, run_requirements: null }
  const renderDeployment = () => renderWithProviders(<GroupForm projectId={7} group="deployment" title="Deployment" fields={fieldsOf} values={empty} canWrite />)
  const deployment = () => within(screen.getByRole('region', { name: 'Deployment' }))

  async function addSoftware(user, name) {
    await user.click(deployment().getByRole('button', { name: 'Add Software' }))
    await user.type(within(deployment().getByRole('listitem', { name: 'Software 1' })).getByLabelText(/^Name/), name)
  }

  it('sends the run requirements as one object', async () => {
    const api = mockApi({ 'PUT /registry/projects/:id/operations/:group': ({ body }) => ({ data: { group: 'deployment', values: { ...empty, ...body } } }) })
    const { user } = renderDeployment()

    await addSoftware(user, 'PHP')
    await user.click(deployment().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT')).toHaveLength(1))
    expect(api.calls('PUT')[0].body).toEqual({ run_requirements: { software: [{ name: 'PHP', version: null, evidence: null }], package_managers: [] } })
  })

  it('shows a secret refused on the run requirements as a whole next to Save, not only as a toast', async () => {
    mockApi({
      'PUT /registry/projects/:id/operations/:group': () =>
        validationError({ run_requirements: ['The run requirements looks like it contains a password, key or token. Store it in the vault and record its vault:// reference instead.'] }),
    })
    const { user } = renderDeployment()

    await addSoftware(user, 'password=Secret12345')
    await user.click(deployment().getByRole('button', { name: 'Save' }))

    const alert = await deployment().findByRole('alert')
    expect(alert).toHaveTextContent('Not saved:')
    expect(alert).toHaveTextContent('This looks like a password, key or token. Store the secret in the vault')
    expect(screen.queryByText('Please fix the highlighted fields.')).not.toBeInTheDocument()
  })

  it('puts an error about one list item under that item', async () => {
    mockApi({ 'PUT /registry/projects/:id/operations/:group': () => validationError({ 'run_requirements.software.0': ['The run requirements.software.0 field must be an array.'] }) })
    const { user } = renderDeployment()

    await addSoftware(user, 'Node')
    await user.click(deployment().getByRole('button', { name: 'Save' }))

    expect(await within(deployment().getByRole('listitem', { name: 'Software 1' })).findByText('The run requirements.software.0 field must be an array.')).toBeInTheDocument()
  })

  it('says when nothing changed instead of doing nothing', async () => {
    const api = mockApi({})
    const { user } = renderDeployment()

    await user.type(deployment().getByLabelText('CI/CD provider'), '   ') // dirty, but blank once trimmed
    await user.click(deployment().getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Nothing to save.')).toBeInTheDocument()
    expect(api.requests).toHaveLength(0)
  })
})

describe('GroupForm with the real auth, data and monitoring fields', () => {
  const env = { t: tabStrings.en, r: kitStrings.en }
  const answer = (group) => ({ 'PUT /registry/projects/:id/operations/:group': ({ body }) => ({ data: { group, values: body } }) })
  const region = (name) => within(screen.getByRole('region', { name }))

  it('adds an account role to the auth group', async () => {
    const api = mockApi(answer('auth'))
    const { user } = renderWithProviders(<GroupForm projectId={7} group="auth" title="Auth" fields={authFields(env)} values={{ auth_method: null, mfa: null, provisioning: null, recovery: null, account_roles: null }} canWrite />)

    await user.selectOptions(region('Auth').getByLabelText('Multi-factor authentication'), 'required')
    await user.click(region('Auth').getByRole('button', { name: 'Add Role' }))
    const role = within(region('Auth').getByRole('listitem', { name: 'Role 1' }))
    await user.type(role.getByLabelText(/^Role/), 'Cashier')
    await user.selectOptions(role.getByLabelText('Kind'), 'staff')
    await user.click(region('Auth').getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/operations/auth')).toHaveLength(1))
    expect(api.calls('PUT')[0].body).toEqual({ mfa: 'required', account_roles: [{ role: 'Cashier', kind: 'staff', description: null, permissions_summary: null }] })
  })

  it('turns on "no database" in the data group', async () => {
    const api = mockApi(answer('data'))
    const { user } = renderWithProviders(<GroupForm projectId={7} group="data" title="Data" fields={dataFields(env)} values={{ storage_service: null, upload_handling: null, no_database: false }} canWrite />)

    await user.click(region('Data').getByRole('switch', { name: /^No database/ }))
    await user.click(region('Data').getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT')).toHaveLength(1))
    expect(api.calls('PUT')[0].body).toEqual({ no_database: true })
  })

  it('keeps commas inside a procedure (one per line)', async () => {
    const api = mockApi(answer('monitoring'))
    const values = Object.fromEntries(monitoringFields(env).map((field) => [field.name, null]))
    const { user } = renderWithProviders(<GroupForm projectId={7} group="monitoring" title="Monitoring" fields={monitoringFields(env)} values={values} canWrite />)

    await user.type(region('Monitoring').getByLabelText('Operating procedures'), 'Restart the queue, then check Horizon{Enter}Rotate logs weekly')
    await user.click(region('Monitoring').getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT')).toHaveLength(1))
    expect(api.calls('PUT')[0].body).toEqual({ procedures: ['Restart the queue, then check Horizon', 'Rotate logs weekly'] })
  })
})
