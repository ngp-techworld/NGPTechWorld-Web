import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, paginated, reply, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { CollectionTab } from './CollectionTab'
import { toOptions } from './form'

const SECRET = 'The notes looks like it contains a password, key or token. Store it in the vault and record its vault:// reference instead.'

const config = {
  title: 'Modules',
  itemLabel: 'module',
  rowName: (row) => row.name_en,
  emptyTitle: 'No modules yet',
  defaults: { status: 'open' },
  fields: [
    { name: 'key', type: 'text', label: 'Key', required: true, pattern: /^[a-z-]+$/, dir: 'ltr' },
    { name: 'name', type: 'bilingual', label: 'Name', required: true },
    { name: 'status', type: 'select', label: 'Status', nullable: false, options: toOptions(['open', 'done'], { open: 'Open', done: 'Done' }) },
    { name: 'notes', type: 'textarea', label: 'Notes' },
    { name: 'env_vars', type: 'tags', label: 'Env vars', dir: 'ltr' },
    { name: 'is_public', type: 'switch', label: 'Public' },
  ],
  columns: () => [
    { key: 'key', header: 'Key' },
    { key: 'name_en', header: 'Name' },
  ],
}

const module1 = { id: 1, key: 'auth', name_ar: 'الدخول', name_en: 'Sign-in', status: 'open', notes: null, env_vars: [], is_public: false }
const resource = '/registry/projects/7/modules'

function server(extra = {}) {
  let rows = [module1]
  return mockApi({
    'GET /registry/projects/:id/modules': () => paginated(rows),
    'POST /registry/projects/:id/modules': ({ body }) => {
      const created = { id: 2, ...body }
      rows = [...rows, created]
      return reply(201, { data: created })
    },
    'PUT /registry/projects/:id/modules/:item': ({ body }) => ({ data: { ...module1, ...body } }),
    'DELETE /registry/projects/:id/modules/:item': () => {
      rows = []
      return null
    },
    ...extra,
  })
}

const render = (props = {}) => renderWithProviders(<CollectionTab resource={resource} config={config} canWrite {...props} />)
const dialog = () => within(screen.getByRole('dialog'))

describe('CollectionTab', () => {
  it('lists the records and creates one from the generated form with the exact body', async () => {
    const api = server()
    const { user } = render()

    expect(await screen.findByText('Sign-in')).toBeInTheDocument()
    expect(api.calls('GET', `${resource}`)[0].query).toMatchObject({ per_page: '100', sort: 'order', dir: 'asc' })

    await user.click(screen.getByRole('button', { name: 'Add module' }))
    await user.type(dialog().getByLabelText(/^Key/), 'orders')
    await user.type(dialog().getByLabelText('Name (Arabic)'), 'الطلبات')
    await user.type(dialog().getByLabelText('Name (English)'), 'Orders')
    await user.type(dialog().getByLabelText(/^Env vars/), 'STRIPE_KEY{Enter}')
    await user.click(dialog().getByRole('switch', { name: 'Public' }))
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', resource)).toHaveLength(1))
    expect(api.calls('POST', resource)[0].body).toEqual({
      key: 'orders',
      name_ar: 'الطلبات',
      name_en: 'Orders',
      status: 'open',
      notes: null,
      env_vars: ['STRIPE_KEY'],
      is_public: true,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Orders')).toBeInTheDocument()
  })

  it('validates on the client and sends nothing while a required field is empty or malformed', async () => {
    const api = server()
    const { user } = render()
    await screen.findByText('Sign-in')

    await user.click(screen.getByRole('button', { name: 'Add module' }))
    await user.type(dialog().getByLabelText(/^Key/), 'Bad Key')
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    expect(await dialog().findByText('Invalid format.')).toBeInTheDocument()
    expect(dialog().getAllByText('This field is required')).toHaveLength(2)
    expect(api.calls('POST')).toHaveLength(0)
  })

  it('edits a record and sends only what changed', async () => {
    const api = server()
    const { user } = render()

    await user.click(await screen.findByText('Sign-in'))
    expect(dialog().getByLabelText(/^Key/)).toHaveValue('auth')
    await user.type(dialog().getByLabelText(/^Notes/), 'Uses the session guard')
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', `${resource}/1`)).toHaveLength(1))
    expect(api.calls('PUT', `${resource}/1`)[0].body).toEqual({ notes: 'Uses the session guard' })
  })

  it('puts a 422 on the fields, and a "looks like a secret" refusal in plain words', async () => {
    server({
      'PUT /registry/projects/:id/modules/:item': () => validationError({ key: ['The key has already been taken.'], notes: [SECRET] }),
    })
    const { user } = render()

    await user.click(await screen.findByText('Sign-in'))
    await user.type(dialog().getByLabelText(/^Notes/), 'password=Hunter2024')
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    expect(await dialog().findByText('The key has already been taken.')).toBeInTheDocument()
    expect(dialog().getByText(/This looks like a password, key or token\. Store the secret in the vault/)).toBeInTheDocument()
    expect(dialog().queryByText(SECRET)).not.toBeInTheDocument()
    expect(dialog().getByLabelText(/^Notes/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument() // stays open with what was typed
  })

  it('lists 422 messages for keys the form does not show above the fields', async () => {
    server({ 'POST /registry/projects/:id/modules': () => validationError({ technology: ['Something else went wrong.'] }) })
    const { user } = render()
    await screen.findByText('Sign-in')

    await user.click(screen.getByRole('button', { name: 'Add module' }))
    await user.type(dialog().getByLabelText(/^Key/), 'orders')
    await user.type(dialog().getByLabelText('Name (Arabic)'), 'ط')
    await user.type(dialog().getByLabelText('Name (English)'), 'O')
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    expect(await dialog().findByText('Something else went wrong.')).toBeInTheDocument()
  })

  it('deletes after confirmation, and explains a refused delete', async () => {
    const api = server()
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete module' })).toHaveTextContent('Delete “Sign-in”?')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.calls('DELETE', `${resource}/1`)).toHaveLength(1))
    expect(await screen.findByText('No modules yet')).toBeInTheDocument()
  })

  it('shows a refused delete in words instead of "fix the highlighted fields"', async () => {
    server({ 'DELETE /registry/projects/:id/modules/:item': () => validationError({ technology: ['A project still uses this technology.'] }) })
    const { user } = render()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('This technology cannot be deleted: at least one project still uses it.')).toBeInTheDocument()
    expect(screen.queryByText('Please fix the highlighted fields.')).not.toBeInTheDocument()
  })

  it('is read-only without the write ability: no add, no delete, a view dialog with disabled fields and no Save', async () => {
    server()
    const { user } = render({ canWrite: false })

    await screen.findByText('Sign-in')
    expect(screen.queryByRole('button', { name: 'Add module' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByRole('dialog', { name: 'View module' })).toBeInTheDocument()
    expect(dialog().getByLabelText(/^Key/)).toBeDisabled()
    expect(dialog().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(dialog().getByText('Read only: you cannot change this.')).toBeInTheDocument()
  })

  it('sends a multipart body with the file when the collection takes uploads', async () => {
    const api = mockApi({
      'GET /registry/projects/:id/documents': () => paginated([]),
      'POST /registry/projects/:id/documents': ({ body }) => reply(201, { data: { id: 5, title: body.get('title') } }),
    })
    const uploadConfig = {
      ...config,
      title: 'Documents',
      itemLabel: 'document',
      upload: { accept: '.pdf', extensions: ['pdf'], maxMB: 20 },
      fields: [
        { name: 'title', type: 'text', label: 'Title', required: true },
        { name: 'is_public', type: 'switch', label: 'Public' },
      ],
    }
    const { user } = renderWithProviders(<CollectionTab resource="/registry/projects/7/documents" config={uploadConfig} canWrite />)

    await user.click(await screen.findByRole('button', { name: 'Add document' }))
    await user.click(dialog().getByRole('button', { name: 'Save' }))
    expect(await dialog().findByText('Choose a file.')).toBeInTheDocument()

    await user.upload(screen.getByTestId('collection-file-input'), new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' }))
    await user.type(dialog().getByLabelText(/^Title/), 'Spec')
    await user.click(dialog().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/documents')).toHaveLength(1))
    const body = api.calls('POST', '/registry/projects/7/documents')[0].body
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file').name).toBe('spec.pdf')
    expect(body.get('title')).toBe('Spec')
    expect(body.get('is_public')).toBe('0')
  })
})
