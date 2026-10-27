import '../testTimeouts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setToken } from '@/lib/storage'
import { mockApi, paginated, reply, replyText, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { dropOn } from '../dndCapture'
import ProjectEdit from '../ProjectEdit'
import { ABILITIES, registryRoutes } from '../registryTestUtils'

vi.mock('@dnd-kit/core', async (importOriginal) => (await import('../dndCapture')).withDndCapture(await importOriginal()))

const shot = (id, over = {}) => ({
  id,
  project_id: 7,
  disk: 'public',
  path: `projects/screenshots/${id}.webp`,
  title_ar: null,
  title_en: `Screen ${id}`,
  description_ar: null,
  description_en: null,
  platform: 'desktop',
  language: null,
  is_public: true,
  is_cover: false,
  legacy_gallery: false,
  order: id,
  url: `http://localhost/media/projects/screenshots/${id}.webp`,
  thumbnail_url: `http://localhost/media/projects/screenshots/${id}-480.webp`,
  ...over,
})

const publicShot = shot(1)
const privateShot = shot(2, {
  disk: 'local',
  is_public: false,
  path: 'registry/screenshots/2.webp',
  url: 'http://localhost/api/admin/registry/files/screenshots/2',
  thumbnail_url: 'http://localhost/api/admin/registry/files/screenshots/2?w=480',
})
const galleryShot = shot(3, { legacy_gallery: true, title_en: 'From the old gallery' })

function renderTab({ rows = [publicShot, privateShot], abilities = ABILITIES.superAdmin, extra = {} } = {}) {
  const api = mockApi(
    registryRoutes({
      abilities,
      extra: {
        'GET /registry/projects/:id/screenshots': () => paginated(rows),
        'GET /registry/files/screenshots/:id': () => reply(200, { fake: 'image' }),
        ...extra,
      },
    }),
  )
  const view = renderWithProviders(<ProjectEdit />, { route: '/projects/7?tab=screenshots', path: '/projects/:id' })
  return { api, ...view }
}

const tile = async (name) => within(await screen.findByRole('article', { name }))

describe('Screenshots tab', () => {
  it('shows public thumbnails directly and fetches private ones with the bearer token', async () => {
    setToken('t0ken')
    const { api } = renderTab()

    expect((await tile('Screen 1')).getByRole('img', { name: 'Screen 1' })).toHaveAttribute('src', 'http://localhost/media/projects/screenshots/1-480.webp')
    const privateTile = await tile('Screen 2')
    expect(await privateTile.findByRole('img', { name: 'Screen 2' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
    expect(api.calls('GET', '/registry/projects/7/screenshots')[0].query).toMatchObject({ per_page: '48' }) // under the stream's 60/min
    const stream = api.calls('GET', '/registry/files/screenshots/2')
    expect(stream).toHaveLength(1)
    expect(stream[0].query).toEqual({ w: '480' })
    expect(stream[0].headers.authorization).toBe('Bearer t0ken')
    expect(privateTile.getByText('Private')).toBeInTheDocument()
  })

  it('uploads a screenshot as multipart with its fields', async () => {
    const { api, user } = renderTab({
      rows: [],
      extra: { 'POST /registry/projects/:id/screenshots': ({ body }) => reply(201, { data: shot(9, { title_en: body.get('title_en') }) }) },
    })

    await user.click(await screen.findByRole('button', { name: 'Upload a screenshot' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.upload(screen.getByTestId('collection-file-input'), new File(['png'], 'home.png', { type: 'image/png' }))
    await user.type(dialog.getByLabelText('Title (English)'), 'Home page')
    await user.selectOptions(dialog.getByLabelText('Platform'), 'mobile')
    await user.click(dialog.getByRole('switch', { name: /^Public/ }))
    await user.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/screenshots')).toHaveLength(1))
    const body = api.calls('POST', '/registry/projects/7/screenshots')[0].body
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file').name).toBe('home.png')
    expect(body.get('title_en')).toBe('Home page')
    expect(body.get('platform')).toBe('mobile')
    expect(body.get('is_public')).toBe('1')
    expect(body.has('title_ar')).toBe(false) // nulls are left out
  })

  it('never leaves the upload dialog hanging when the 201 answer cannot be read: it closes and the tile appears', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let rows = []
    const { api, user } = renderTab({
      extra: {
        'GET /registry/projects/:id/screenshots': () => paginated(rows),
        'POST /registry/projects/:id/screenshots': () => {
          rows = [shot(9, { title_en: 'Home page' })]
          // the demo's PHP printed a notice in front of every multipart answer
          return replyText(201, `<br />\n<b>Notice</b>: PHP Request Startup: file created in the system's temporary directory<br />\n${JSON.stringify({ data: rows[0] })}`)
        },
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Upload a screenshot' }))
    await user.upload(screen.getByTestId('collection-file-input'), new File(['png'], 'home.png', { type: 'image/png' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('article', { name: 'Home page' })).toBeInTheDocument()
    expect(screen.getByText(/the change may have been saved/)).toBeInTheDocument()
    expect(api.calls('POST', '/registry/projects/7/screenshots')).toHaveLength(1)
  })

  it('refuses a file type the API does not take before sending', async () => {
    const { api, user } = renderTab({ rows: [] })
    await user.click(await screen.findByRole('button', { name: 'Upload a screenshot' }))
    fireEvent.change(screen.getByTestId('collection-file-input'), { target: { files: [new File(['gif'], 'anim.gif', { type: 'image/gif' })] } })
    expect(await screen.findByText('This file type is not supported.')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(api.calls('POST')).toHaveLength(0)
  })

  it('makes a screenshot private with a PUT', async () => {
    const { api, user } = renderTab({ extra: { 'PUT /registry/projects/:id/screenshots/:item': ({ body }) => ({ data: { ...publicShot, ...body } }) } })

    await user.click((await tile('Screen 1')).getByRole('switch', { name: 'Public: Screen 1' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/screenshots/1')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/screenshots/1')[0].body).toEqual({ is_public: false })
  })

  it('explains the refusal to hide the last public image of a published project without a cover', async () => {
    const { user } = renderTab({ extra: { 'PUT /registry/projects/:id/screenshots/:item': () => validationError({ publication: ['cover'] }) } })

    await user.click((await tile('Screen 1')).getByRole('switch', { name: 'Public: Screen 1' }))

    expect(await screen.findByText(/This is the last public image of a published project without a cover/)).toBeInTheDocument()
  })

  it('offers "make it the cover" on public screenshots only', async () => {
    const { api, user } = renderTab({ extra: { 'PUT /registry/projects/:id/screenshots/:item': ({ body }) => ({ data: { ...publicShot, ...body } }) } })

    const privateTile = await tile('Screen 2')
    expect(privateTile.queryByRole('button', { name: /the cover/ })).not.toBeInTheDocument()
    await user.click((await tile('Screen 1')).getByRole('button', { name: 'Make “Screen 1” the cover' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/screenshots/1')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/screenshots/1')[0].body).toEqual({ is_cover: true })
    expect(await screen.findByText('Cover set')).toBeInTheDocument()
  })

  it('edits the titles and sends only what changed', async () => {
    const { api, user } = renderTab({ extra: { 'PUT /registry/projects/:id/screenshots/:item': ({ body }) => ({ data: { ...publicShot, ...body } }) } })

    await user.click((await tile('Screen 1')).getByRole('button', { name: 'Edit: Screen 1' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Title (Arabic)'), 'الشاشة')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/screenshots/1')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/screenshots/1')[0].body).toEqual({ title_ar: 'الشاشة' })
  })

  it('deletes after confirmation, but never a row of the original gallery', async () => {
    const { api, user } = renderTab({ rows: [publicShot, galleryShot], extra: { 'DELETE /registry/projects/:id/screenshots/:item': () => null } })

    const gallery = await tile('From the old gallery')
    expect(gallery.getByText('From the gallery')).toBeInTheDocument()
    expect(gallery.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(gallery.queryByRole('switch')).not.toBeInTheDocument()

    await user.click((await tile('Screen 1')).getByRole('button', { name: 'Delete: Screen 1' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.calls('DELETE', '/registry/projects/7/screenshots/1')).toHaveLength(1))
  })

  it('reorders by drag and drop', async () => {
    const { api } = renderTab({ rows: [publicShot, privateShot, galleryShot], extra: { 'POST /registry/projects/:id/screenshots/reorder': () => null } })

    await tile('Screen 1')
    dropOn(screen.getByRole('list', { name: 'Screenshot order' }), 1, 3)

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/screenshots/reorder')).toHaveLength(1))
    expect(api.calls('POST', '/registry/projects/7/screenshots/reorder')[0].body).toEqual({ ids: [2, 3, 1] })
  })

  // a page of the list, honouring per_page and page like the API (which caps per_page at 200)
  const pages = (all) => ({ query }) => {
    const perPage = Math.min(Number(query.per_page ?? 15), 200)
    const page = Number(query.page ?? 1)
    return paginated(all.slice((page - 1) * perPage, page * perPage), { page, perPage, total: all.length })
  }

  it('reorders more shots than a page holds (Dawri: 51) in a reorder mode that loads them all', async () => {
    setToken('t0ken')
    const all = Array.from({ length: 51 }, (_, index) => (index % 10 === 9 ? shot(index + 1, { ...privateShot, id: index + 1, title_en: `Screen ${index + 1}`, url: `http://localhost/api/admin/registry/files/screenshots/${index + 1}`, thumbnail_url: `http://localhost/api/admin/registry/files/screenshots/${index + 1}?w=480` }) : shot(index + 1)))
    const { api, user } = renderTab({ extra: { 'GET /registry/projects/:id/screenshots': pages(all), 'POST /registry/projects/:id/screenshots/reorder': () => null } })

    await tile('Screen 1')
    expect(screen.getAllByRole('article')).toHaveLength(48) // the first page, no drag in place
    expect(screen.queryByRole('list', { name: 'Screenshot order' })).not.toBeInTheDocument()
    const streamed = api.calls('GET').filter((call) => call.path.startsWith('/registry/files/')).length

    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    const order = await screen.findByRole('list', { name: 'Screenshot order' })
    expect(within(order).getAllByRole('listitem')).toHaveLength(51)
    expect(api.calls('GET', '/registry/projects/7/screenshots').at(-1).query).toMatchObject({ per_page: '200', page: '1' })
    expect(screen.getByText(/^All 51 screenshots, in their order on the project page/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a screenshot' })).not.toBeInTheDocument()
    // private shots show without a preview: no extra request to the rate-limited file stream
    expect(api.calls('GET').filter((call) => call.path.startsWith('/registry/files/')).length).toBe(streamed)

    dropOn(order, 51, 1)
    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/screenshots/reorder')).toHaveLength(1))
    const { ids } = api.calls('POST', '/registry/projects/7/screenshots/reorder')[0].body
    expect(ids).toHaveLength(51)
    expect(ids.slice(0, 3)).toEqual([51, 1, 2])

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findAllByRole('article')).toHaveLength(48)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })

  it('cannot reorder more shots than one request returns (200), and says so', async () => {
    const all = Array.from({ length: 201 }, (_, index) => shot(index + 1))
    renderTab({ extra: { 'GET /registry/projects/:id/screenshots': pages(all) } })
    await tile('Screen 1')

    expect(screen.getByRole('button', { name: 'Reorder' })).toBeDisabled()
    expect(screen.getByText('More than 200 items — reordering is not available here.')).toBeInTheDocument()
  })

  it('keeps long titles inside a one-column grid on a phone (minmax(0, 1fr), truncated)', async () => {
    renderTab({ rows: [shot(1, { title_en: 'A screenshot with a very long title that would widen the single grid column on a phone' })] })
    const article = await screen.findByRole('article', { name: /very long title/ })
    const grid = screen.getByRole('list', { name: 'Screenshot order' })
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid.querySelector('li')).toHaveClass('min-w-0')
    expect(article).toHaveClass('min-w-0')
    expect(within(article).getByText(/very long title/)).toHaveClass('truncate')
  })

  it('is read-only for a viewer', async () => {
    renderTab({ abilities: ABILITIES.viewer })
    const first = await tile('Screen 1')
    expect(first.queryByRole('switch')).not.toBeInTheDocument()
    expect(first.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a screenshot' })).not.toBeInTheDocument()
  })
})

describe('Documents tab', () => {
  const doc = { id: 5, project_id: 7, title: 'Architecture', type: 'architecture', original_name: 'arch.pdf', mime: 'application/pdf', size: 20480, created_at: '2026-10-20T10:00:00.000000Z', download_url: 'http://localhost/api/admin/registry/files/documents/5' }

  function renderDocs({ abilities = ABILITIES.superAdmin, extra = {} } = {}) {
    const api = mockApi(registryRoutes({ abilities, extra: { 'GET /registry/projects/:id/documents': () => paginated([doc]), ...extra } }))
    const view = renderWithProviders(<ProjectEdit />, { route: '/projects/7?tab=documents', path: '/projects/:id' })
    return { api, ...view }
  }

  it('downloads a document as a blob with the bearer token', async () => {
    setToken('t0ken')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { api, user } = renderDocs({ extra: { 'GET /registry/files/documents/:id': () => reply(200, { pdf: true }, { 'Content-Disposition': 'attachment; filename="arch.pdf"' }) } })

    await user.click(await screen.findByRole('button', { name: 'Download: Architecture' }))

    await waitFor(() => expect(api.calls('GET', '/registry/files/documents/5')).toHaveLength(1))
    expect(api.calls('GET', '/registry/files/documents/5')[0].headers.authorization).toBe('Bearer t0ken')
    await waitFor(() => expect(click).toHaveBeenCalled())
  })

  it('uploads a document with its title and type', async () => {
    const { api, user } = renderDocs({ extra: { 'POST /registry/projects/:id/documents': ({ body }) => reply(201, { data: { ...doc, id: 6, title: body.get('title') } }) } })

    await user.click(await screen.findByRole('button', { name: 'Add document' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.upload(screen.getByTestId('collection-file-input'), new File(['# notes'], 'notes.md', { type: 'text/markdown' }))
    await user.type(dialog.getByLabelText(/^Title/), 'Runbook')
    await user.selectOptions(dialog.getByLabelText('Type'), 'manual')
    await user.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('POST', '/registry/projects/7/documents')).toHaveLength(1))
    const body = api.calls('POST', '/registry/projects/7/documents')[0].body
    expect(body.get('file').name).toBe('notes.md')
    expect(body.get('title')).toBe('Runbook')
    expect(body.get('type')).toBe('manual')
  })

  it('renames a document', async () => {
    const { api, user } = renderDocs({ extra: { 'PUT /registry/projects/:id/documents/:item': ({ body }) => ({ data: { ...doc, ...body } }) } })

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const title = within(screen.getByRole('dialog')).getByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Architecture v2')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls('PUT', '/registry/projects/7/documents/5')).toHaveLength(1))
    expect(api.calls('PUT', '/registry/projects/7/documents/5')[0].body).toEqual({ title: 'Architecture v2' })
  })

  it('lets a viewer download but not upload, rename or delete', async () => {
    renderDocs({ abilities: ABILITIES.viewer })
    expect(await screen.findByRole('button', { name: 'Download: Architecture' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add document' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})
