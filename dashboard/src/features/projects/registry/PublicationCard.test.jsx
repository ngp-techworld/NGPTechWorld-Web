import '../testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import ProjectEdit from '../ProjectEdit'
import { ABILITIES, registryRecord, registryRoutes } from '../registryTestUtils'

const card = async () => within(await screen.findByRole('region', { name: 'Publication' }))

function renderCard({ abilities = ABILITIES.superAdmin, over = {}, publication, extra = {} } = {}) {
  const api = mockApi(registryRoutes({ abilities, over, publication, extra }))
  const view = renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
  return { api, ...view }
}

describe('Publication card', () => {
  it('publishes a draft that is ready, then offers Unpublish', async () => {
    const published = registryRecord({ over: { publication_status: 'published', published_at: '2026-10-26T08:00:00.000000Z' }, publication: { ready: true, missing: [] } })
    const { api, user } = renderCard({ publication: { ready: true, missing: [] }, extra: { 'POST /registry/projects/:id/publish': () => ({ data: published }) } })
    const publication = await card()

    expect(publication.getByText('Draft (internal)')).toBeInTheDocument()
    expect(publication.getByText('Ready to publish')).toBeInTheDocument()
    await user.click(publication.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/publish')).toHaveLength(1))
    expect(await publication.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument()
    expect(publication.getByText('Published', { selector: 'span' })).toBeInTheDocument()
    expect(publication.getByText(/Published since/)).toBeInTheDocument()
  })

  it('lists what a refused publish needs, in words', async () => {
    const { user } = renderCard({ extra: { 'POST /registry/projects/:id/publish': () => validationError({ publication: ['name_en', 'cover'] }) } })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Publish' }))

    const alert = await publication.findByRole('alert')
    expect(alert).toHaveTextContent('The project was not published. It still needs:')
    expect(within(alert).getByText('English name')).toBeInTheDocument()
    expect(within(alert).getByText('A cover image or at least one public screenshot')).toBeInTheDocument()
    expect(screen.queryByText('Please fix the highlighted fields.')).not.toBeInTheDocument()
  })

  it('drops a refused-publish message once what the project lacks has changed', async () => {
    const api = mockApi(registryRoutes({ publication: { ready: false, missing: ['cover'] }, extra: { 'POST /registry/projects/:id/publish': () => validationError({ publication: ['cover'] }) } }))
    const { user, queryClient } = renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Publish' }))
    expect(await publication.findByText('The project was not published. It still needs:')).toBeInTheDocument()

    // a cover was added elsewhere (the Media tab): the record is read again and is now ready
    api.on('GET /registry/projects/:id', () => ({ data: registryRecord({ publication: { ready: true, missing: [] } }) }))
    await queryClient.invalidateQueries({ queryKey: ['crud', '/registry/projects'] })
    await waitFor(() => expect(publication.queryByText('The project was not published. It still needs:')).not.toBeInTheDocument())
    expect(publication.getByText('Ready to publish')).toBeInTheDocument()
  })

  it('shows what a draft still needs when the API says it is not ready', async () => {
    renderCard({ publication: { ready: false, missing: ['short_ar', 'category'] } })
    const publication = await card()
    expect(publication.getByText('Missing for publication:')).toBeInTheDocument()
    expect(publication.getByText('Arabic short description')).toBeInTheDocument()
    expect(publication.getByText('Category')).toBeInTheDocument()
  })

  it('warns when a published project lacks what its public page needs', async () => {
    renderCard({ over: { publication_status: 'published', published_at: '2026-10-01T08:00:00.000000Z' }, publication: { ready: false, missing: ['cover'] } })
    const publication = await card()
    expect(publication.getByRole('alert')).toHaveTextContent('The project is published but lacks what its public page needs:')
    expect(publication.getByText('A cover image or at least one public screenshot')).toBeInTheDocument()
  })

  it('features and unfeatures with their own actions', async () => {
    const featured = registryRecord({ over: { featured: true } })
    const { api, user } = renderCard({ extra: { 'POST /registry/projects/:id/feature': () => ({ data: featured }) } })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Feature on the home page' }))
    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/feature')).toHaveLength(1))
    expect(await publication.findByRole('button', { name: 'Unfeature' })).toBeInTheDocument()
    expect(publication.getByText('Featured', { selector: 'span' })).toBeInTheDocument()
  })

  it('asks before unpublishing', async () => {
    const { api, user } = renderCard({ over: { publication_status: 'published' }, extra: { 'POST /registry/projects/:id/unpublish': () => ({ data: registryRecord() }) } })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Unpublish' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Unpublish the project' }))
    await user.click(dialog.getByRole('button', { name: 'Unpublish' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/unpublish')).toHaveLength(1))
  })

  it('offers only Restore on an archived project (no publish, no feature)', async () => {
    const { api, user } = renderCard({
      over: { archived_at: '2026-10-25T08:00:00.000000Z' },
      extra: { 'POST /registry/projects/:id/restore': () => ({ data: registryRecord() }) },
    })
    const publication = await card()

    expect(publication.getByText('Archived', { selector: 'span' })).toBeInTheDocument()
    expect(publication.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(publication.queryByRole('button', { name: /Feature/ })).not.toBeInTheDocument()
    expect(publication.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    await user.click(publication.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/restore')).toHaveLength(1))
    expect(await publication.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })

  it('archives after confirmation', async () => {
    const { api, user } = renderCard({ extra: { 'POST /registry/projects/:id/archive': () => ({ data: registryRecord({ over: { archived_at: '2026-10-26T08:00:00.000000Z' } }) }) } })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Archive' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Archive the project' })).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/archive')).toHaveLength(1))
    expect(await publication.findByRole('button', { name: 'Restore' })).toBeInTheDocument()
  })

  it('gives a content editor publish and feature, but no archive or delete', async () => {
    renderCard({ abilities: ABILITIES.contentEditor })
    const publication = await card()
    expect(publication.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    expect(publication.getByRole('button', { name: 'Feature on the home page' })).toBeInTheDocument()
    expect(publication.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    expect(publication.queryByRole('button', { name: 'Delete the project' })).not.toBeInTheDocument()
  })

  it('shows no actions to a viewer, only the status and completeness', async () => {
    renderCard({ abilities: ABILITIES.viewer })
    const publication = await card()
    expect(publication.queryByRole('button')).not.toBeInTheDocument()
    expect(publication.getByRole('progressbar', { name: 'Completeness' })).toHaveAttribute('aria-valuenow', '86')
  })

  it('lists the completeness checks that are missing, by group', async () => {
    renderCard()
    const publication = await card()
    expect(publication.getByText('86%')).toBeInTheDocument()
    expect(publication.getByText('Business problem (both languages)')).toBeInTheDocument()
    expect(publication.getByText('At least one module')).toBeInTheDocument()
    expect(publication.getByText('At least one repository')).toBeInTheDocument()
    expect(publication.getByText('Complete')).toBeInTheDocument() // screenshots
  })

  it('deletes only after the slug is typed, for a super admin', async () => {
    const { api, user } = renderCard({ extra: { 'DELETE /registry/projects/:id': () => null } })
    const publication = await card()

    await user.click(publication.getByRole('button', { name: 'Delete the project' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Delete the project' }))
    const confirmButton = dialog.getByRole('button', { name: 'Delete' })
    expect(confirmButton).toBeDisabled()
    await user.type(dialog.getByLabelText('Type the slug “acme-portal” to confirm'), 'acme-portal')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    await waitFor(() => expect(api.calls('DELETE', '/registry/projects/7')).toHaveLength(1))
    expect(api.calls('DELETE', '/registry/projects/7')[0].body).toEqual({ confirm_slug: 'acme-portal' })
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/registry/projects'))
  })

  it('has no delete for anyone but a super admin', async () => {
    renderCard({ abilities: ABILITIES.managerMember })
    const publication = await card()
    expect(publication.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(publication.queryByRole('button', { name: 'Delete the project' })).not.toBeInTheDocument()
  })
})
