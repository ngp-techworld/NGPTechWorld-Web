import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, paginated, reply, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import ProjectCreate from './ProjectCreate'
import ProjectEdit from './ProjectEdit'
import { projects } from './hooks'
import './testTimeouts'
import { enter, makeLink, makeMember, showProject } from './testUtils'

const png = (name) => new File([new Uint8Array(10)], name, { type: 'image/png' })

// uploads land in the folder they were sent to, like the real endpoint
const uploadHandler = ({ body }) => {
  const path = `${body.get('folder')}/${body.get('file').name}`
  return reply(201, { data: { path, url: `http://localhost/media/${path}` } })
}

// a tab's name grows a badge (error count / member count), so match by its label
const tab = (label) => screen.getByRole('tab', { name: new RegExp(`^${label}`) })
const tabName = (label, rest) => expect(tab(label)).toHaveAccessibleName(new RegExp(`^${label}\\s*${rest}$`))
const field = (label) => screen.getByLabelText(label)

/** Fills every required field of the General tab with valid values. */
async function fillGeneral(user, { slug } = {}) {
  if (slug) await enter(user, field(/^Slug/), slug)
  await user.selectOptions(field(/^Category/), 'web')
  await enter(user, field(/^Client/), 'Acme')
  await user.clear(field(/^Year/))
  await enter(user, field(/^Year/), '2024')
  await enter(user, field('Project name (Arabic)'), 'بوابة أكمي')
  await enter(user, field('Project name (English)'), 'Acme Portal')
  await enter(user, field('Short description (Arabic)'), 'وصف قصير')
  await enter(user, field('Short description (English)'), 'Short text')
  await enter(user, field('Full description (Arabic)'), 'وصف طويل')
  await enter(user, field('Full description (English)'), 'Long text')
}

describe('ProjectCreate', () => {
  it('renders the four tabs, the general fields (both languages, right widgets) and Save / Cancel', () => {
    renderWithProviders(<ProjectCreate />, { route: '/projects/new' })

    expect(screen.getByRole('heading', { level: 1, name: 'Add a project' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((item) => item.textContent)).toEqual(['General', 'Media', 'Team', 'Links'])
    expect(tab('General')).toHaveAttribute('aria-selected', 'true')

    expect(field(/^Slug/)).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText(/Leave blank to generate it from the English name/)).toBeInTheDocument()
    expect(field(/^Category/)).toHaveValue('')
    expect(field(/^Status/)).toHaveValue('completed')
    expect(field(/^Year/)).toHaveValue(new Date().getFullYear())
    expect(screen.getByRole('switch', { name: /Featured project/ })).toHaveAttribute('aria-checked', 'false')
    expect(field('Project name (Arabic)')).toHaveAttribute('dir', 'rtl')
    expect(field('Project name (English)')).toHaveAttribute('dir', 'ltr')
    expect(field('Short description (English)').tagName).toBe('INPUT') // single line
    expect(field('Full description (English)').tagName).toBe('TEXTAREA')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects') // back link
  })

  it('the Media tab holds the cover, the gallery and the video link with a YouTube / Vimeo hint', async () => {
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })

    await user.click(tab('Media'))

    expect(tab('Media')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('image-input')).toBeInTheDocument()
    expect(screen.getByTestId('gallery-input')).toBeInTheDocument()
    expect(field('Video link')).toHaveAttribute('type', 'url')
    expect(field('Video link')).toHaveAttribute('dir', 'ltr')
    expect(screen.getByText(/YouTube and Vimeo links play inside the project page/)).toBeInTheDocument()
    expect(screen.getByText(/Up to 50 images/)).toBeInTheDocument()
  })

  it('opens the tab named in ?tab= and keeps the URL in sync when switching', async () => {
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new?tab=media' })
    expect(tab('Media')).toHaveAttribute('aria-selected', 'true')

    await user.click(tab('General'))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/projects\/new$/)
    await user.click(tab('Media'))
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/new?tab=media')
  })

  it('shows a clear "save the project first" state on Team and Links and sends nothing', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })

    await user.click(tab('Team'))
    expect(screen.getByRole('heading', { name: 'Save the project first' })).toBeInTheDocument()
    expect(screen.getByText(/Team members can be added once the basic project details are saved/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument() // the form (and its Save) is hidden: only General / Media use it

    await user.click(tab('Links'))
    expect(screen.getByRole('heading', { name: 'Save the project first' })).toBeInTheDocument()
    expect(screen.getByText(/Links can be added once/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add link' })).not.toBeInTheDocument()

    expect(server.requests).toHaveLength(0)
  })

  it('"Save and continue" on the Team tab jumps to the General tab when the form is not valid', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new?tab=team' })
    expect(tab('Team')).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(tab('General')).toHaveAttribute('aria-selected', 'true'))
    expect(await screen.findAllByText('This field is required')).not.toHaveLength(0)
    expect(field(/^Category/)).toHaveFocus()
    expect(server.requests).toHaveLength(0)
  })

  it('"Save and continue" on the Team tab saves a valid form and lands on its Team tab', async () => {
    const server = mockApi({ 'POST /projects': ({ body }) => reply(201, { data: showProject(9, body) }) })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user)
    await user.click(tab('Team'))

    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(server.calls('POST', '/projects')).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects/9?tab=team'))
  })

  it('validates required fields locally, counts the errors on the tab and sends nothing', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    // category, client, 2 names, 2 short descriptions, 2 descriptions
    expect(await screen.findAllByText('This field is required')).toHaveLength(8)
    expect(field(/^Client/)).toHaveAttribute('aria-invalid', 'true')
    tabName('General', '8 errors')
    tabName('Media', '')
    expect(server.requests).toHaveLength(0)
  })

  it('checks the slug format and the year range', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user, { slug: 'Bad Slug' })
    await user.clear(field(/^Year/))
    await enter(user, field(/^Year/), '1800')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Use lowercase letters, numbers and hyphens only (for example acme-portal).')).toBeInTheDocument()
    expect(screen.getByText('Must be between 1990 and 2100')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })

  it('creates the project with the exact payload (paths only, integer year, null for blanks) and opens its Team tab', async () => {
    const server = mockApi({
      'POST /uploads': uploadHandler,
      'POST /projects': ({ body }) => reply(201, { data: showProject(9, body) }),
    })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })

    await fillGeneral(user)
    await user.click(screen.getByRole('switch', { name: /Featured project/ }))
    await user.click(tab('Media'))
    await user.upload(screen.getByTestId('image-input'), png('cover.png'))
    await user.upload(screen.getByTestId('gallery-input'), [png('one.png'), png('two.png')])
    await enter(user, field('Video link'), 'https://www.youtube.com/watch?v=abc123')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove image' })).toHaveLength(3)) // cover + 2 gallery tiles

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects/9?tab=team'))
    expect(server.calls('POST', '/projects')[0].body).toEqual({
      slug: null,
      category: 'web',
      status: 'completed',
      client: 'Acme',
      year: 2024,
      featured: true,
      name_ar: 'بوابة أكمي',
      name_en: 'Acme Portal',
      short_ar: 'وصف قصير',
      short_en: 'Short text',
      description_ar: 'وصف طويل',
      description_en: 'Long text',
      cover_image: 'projects/cover.png',
      gallery: ['projects/gallery/one.png', 'projects/gallery/two.png'],
      video_url: 'https://www.youtube.com/watch?v=abc123',
    })
    expect(server.calls('POST', '/uploads').map((call) => call.body.get('folder'))).toEqual(['projects', 'projects/gallery', 'projects/gallery'])
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('sends the slug when one is typed and a minimal payload otherwise', async () => {
    const server = mockApi({ 'POST /projects': ({ body }) => reply(201, { data: showProject(3, body) }) })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user, { slug: 'my-custom-slug' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/projects')).toHaveLength(1))
    expect(server.calls('POST', '/projects')[0].body).toMatchObject({ slug: 'my-custom-slug', cover_image: null, gallery: [], video_url: null, featured: false })
  })

  it('trims whitespace before sending', async () => {
    const server = mockApi({ 'POST /projects': ({ body }) => reply(201, { data: showProject(3, body) }) })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user)
    await user.type(field(/^Client/), '   ')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('POST', '/projects')).toHaveLength(1))
    expect(server.calls('POST', '/projects')[0].body.client).toBe('Acme')
  })

  it('disables Save while a file uploads', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    mockApi({
      'POST /uploads': async (request) => {
        await gate
        return uploadHandler(request)
      },
    })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await user.click(tab('Media'))

    await user.upload(screen.getByTestId('image-input'), png('cover.png'))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  })

  it('also disables Save (and the "Save and continue" button) while gallery images upload', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    mockApi({
      'POST /uploads': async (request) => {
        await gate
        return uploadHandler(request)
      },
    })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await user.click(tab('Media'))

    await user.upload(screen.getByTestId('gallery-input'), [png('one.png'), png('two.png')])

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    await user.click(tab('Team'))
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save and continue' })).toBeEnabled())
  })

  it('maps a 422 onto the fields of both tabs, counts them on the tabs and stays on the page', async () => {
    mockApi({
      'POST /projects': () =>
        validationError({
          slug: ['The slug has already been taken.'],
          video_url: ['The video url field must be a valid URL.'],
          'gallery.1': ['The gallery.1 field format is invalid.'],
        }),
    })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user, { slug: 'taken' })
    await user.click(tab('Media'))
    await enter(user, field('Video link'), 'https://example.com/v')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The video url field must be a valid URL.')).toBeInTheDocument()
    expect(screen.getByText('The gallery.1 field format is invalid.')).toBeInTheDocument()
    expect(field('Video link')).toHaveAttribute('aria-invalid', 'true')
    tabName('Media', '2 errors')
    tabName('General', '1 error')
    expect(tab('Media')).toHaveAttribute('aria-selected', 'true') // the open tab already has errors: no jump
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/new')
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument() // toast

    await user.click(tab('General'))
    expect(screen.getByText('The slug has already been taken.')).toBeInTheDocument()
    expect(field(/^Slug/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled() // the user can correct and retry
  })

  it('jumps to (and focuses) the first field with a server error when it is on another tab', async () => {
    mockApi({ 'POST /projects': () => validationError({ video_url: ['The video url field must be a valid URL.'] }) })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user)
    expect(tab('General')).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(tab('Media')).toHaveAttribute('aria-selected', 'true'))
    await waitFor(() => expect(field('Video link')).toHaveFocus())
    expect(screen.getByText('The video url field must be a valid URL.')).toBeInTheDocument()
    tabName('Media', '1 error')
  })

  it('jumps to the Media tab when only a media field is invalid on the client', async () => {
    const server = mockApi({})
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user)
    await user.click(tab('Media'))
    await enter(user, field('Video link'), 'youtube.com/watch')
    await user.click(tab('General'))

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(tab('Media')).toHaveAttribute('aria-selected', 'true'))
    expect(await screen.findByText('Enter a valid URL (starting with http:// or https://)')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })

  it('disables Save while the request runs and keeps the form on a server failure', async () => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const server = mockApi({
      'POST /projects': async () => {
        await gate
        return reply(500, { message: 'boom' })
      },
    })
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new' })
    await fillGeneral(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    release()

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(field(/^Client/)).toHaveValue('Acme')
    expect(server.calls('POST', '/projects')).toHaveLength(1)
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/projects\/new$/)
  })

  it('speaks Arabic: validation messages, tabs and hints', async () => {
    const { user } = renderWithProviders(<ProjectCreate />, { route: '/projects/new', lang: 'ar' })

    expect(screen.getAllByRole('tab').map((item) => item.textContent)).toEqual(['عام', 'الوسائط', 'الفريق', 'الروابط'])
    expect(screen.getByText(/اتركه فارغًا ليُولَّد تلقائيًا من الاسم الإنجليزي/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'حفظ' }))

    expect((await screen.findAllByText('هذا الحقل مطلوب')).length).toBe(8)
    expect(screen.getByRole('tab', { name: /^عام/ })).toHaveAccessibleName(/^عام\s*8 أخطاء$/)
  })
})

describe('ProjectEdit', () => {
  const route = '/projects/7'
  const path = '/projects/:id'
  const project = showProject(7, {
    slug: 'acme-portal',
    category: 'web',
    client: 'Acme',
    year: 2024,
    status: 'completed',
    featured: false,
    name_ar: 'بوابة أكمي',
    name_en: 'Acme Portal',
    short_ar: 'وصف قصير',
    short_en: 'Short text',
    description_ar: 'وصف طويل',
    description_en: 'Long text',
    cover_image: 'projects/cover.png',
    cover_image_url: 'http://localhost/media/projects/cover.png',
    gallery: ['projects/gallery/a.png', 'projects/gallery/b.png', 'projects/gallery/c.png'],
    gallery_urls: ['http://localhost/media/projects/gallery/a.png', 'http://localhost/media/projects/gallery/b.png', 'http://localhost/media/projects/gallery/c.png'],
    video_url: 'https://youtu.be/abc123',
    team_members: [makeMember(1, { name: 'Sara' }), makeMember(2, { name: 'Omar' })],
    links: [makeLink(1)],
  })
  const urls = (paths) => paths.map((item) => `http://localhost/media/${item}`)

  function editServer(extra = {}) {
    return mockApi({
      'GET /projects/:id': () => ({ data: project }),
      'GET /projects/:id/team-members': () => paginated(project.team_members),
      'GET /projects/:id/links': () => paginated(project.links),
      'PUT /projects/:id': ({ body }) => ({ data: { ...project, ...body, ...(body.gallery ? { gallery_urls: urls(body.gallery) } : {}) } }),
      ...extra,
    })
  }

  it('loads the whole record into the form and keeps Save disabled until something changes', async () => {
    editServer()
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })

    expect(await screen.findByLabelText(/^Client/)).toHaveValue('Acme')
    expect(screen.getByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()
    expect(screen.getByText('acme-portal', { selector: 'bdi' })).toBeInTheDocument()
    expect(field(/^Slug/)).toHaveValue('acme-portal')
    expect(screen.getByText(/Leave blank to keep the current one/)).toBeInTheDocument()
    expect(field(/^Category/)).toHaveValue('web')
    expect(field(/^Status/)).toHaveValue('completed')
    expect(field(/^Year/)).toHaveValue(2024)
    expect(field('Project name (Arabic)')).toHaveValue('بوابة أكمي')
    expect(field('Short description (English)')).toHaveValue('Short text')
    expect(field('Full description (Arabic)')).toHaveValue('وصف طويل')
    expect(screen.getByRole('switch', { name: /Featured project/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.click(tab('Media'))
    expect(screen.getAllByRole('img', { name: 'Image preview' })[0]).toHaveAttribute('src', 'http://localhost/media/projects/cover.png')
    expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(3) // the three gallery tiles
    expect(field('Video link')).toHaveValue('https://youtu.be/abc123')

    await user.click(tab('Overview'))
    await user.type(field(/^Client/), '!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('shows the number of team members and links on their tabs', async () => {
    editServer()
    renderWithProviders(<ProjectEdit />, { route, path })

    await screen.findByLabelText(/^Client/)
    tabName('Team', '2')
    tabName('Links', '1')
  })

  it('shows a spinner while loading', () => {
    editServer()
    renderWithProviders(<ProjectEdit />, { route, path })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('sends only the fields that changed (PUT is partial) and stays on the page, re-based on the saved record', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    const client = await screen.findByLabelText(/^Client/)

    await user.clear(client)
    await enter(user, client, 'Acme Corp')
    await user.click(screen.getByRole('switch', { name: /Featured project/ }))
    await user.selectOptions(field(/^Status/), 'in_progress')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(server.calls('PUT', '/projects/7')[0].body).toEqual({ client: 'Acme Corp', featured: true, status: 'in_progress' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/projects\/7$/) // no redirect
    expect(field(/^Client/)).toHaveValue('Acme Corp')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()) // pristine again

    // the next save compares with what was just saved
    await user.type(field(/^Client/), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(2))
    expect(server.calls('PUT', '/projects/7')[1].body).toEqual({ client: 'Acme Corp!' })
  })

  it('sends the image fields as paths: a removed gallery image, a reordered one and a cleared cover', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    await screen.findByLabelText(/^Client/)
    await user.click(tab('Media'))

    // remove the first gallery tile (a.png) and the cover
    const removeButtons = screen.getAllByRole('button', { name: 'Remove image' }) // cover first, then the tiles
    await user.click(removeButtons[1])
    await user.click(removeButtons[0])
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(server.calls('PUT', '/projects/7')[0].body).toEqual({
      cover_image: null,
      gallery: ['projects/gallery/b.png', 'projects/gallery/c.png'],
    })
  })

  it('sends a new video link and clears it with null', async () => {
    const server = editServer()
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    await screen.findByLabelText(/^Client/)
    await user.click(tab('Media'))

    await user.clear(field('Video link'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(server.calls('PUT', '/projects/7')[0].body).toEqual({ video_url: null })
  })

  it('a blank slug is sent as null (the API keeps the current one) and the field is refilled from the response', async () => {
    const server = editServer({ 'PUT /projects/:id': () => ({ data: project }) })
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })

    await user.clear(await screen.findByLabelText(/^Slug/))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(server.calls('PUT', '/projects/7')[0].body).toEqual({ slug: null })
    await waitFor(() => expect(field(/^Slug/)).toHaveValue('acme-portal'))
  })

  it('uploads a replacement cover and saves its path', async () => {
    const server = editServer({ 'POST /uploads': uploadHandler })
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    await screen.findByLabelText(/^Client/)
    await user.click(tab('Media'))

    await user.upload(screen.getByTestId('image-input'), png('new-cover.png'))
    await waitFor(() => expect(screen.getAllByRole('img', { name: 'Image preview' })[0]).toHaveAttribute('src', 'http://localhost/media/projects/new-cover.png'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.calls('PUT', '/projects/7')).toHaveLength(1))
    expect(server.calls('PUT', '/projects/7')[0].body).toEqual({ cover_image: 'projects/new-cover.png' })
  })

  it('shows server errors on an edit too and keeps what was typed', async () => {
    editServer({ 'PUT /projects/:id': () => validationError({ client: ['The client field must not be greater than 255 characters.'], video_url: ['Bad video link.'] }) })
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    await enter(user, await screen.findByLabelText(/^Client/), ' Ltd')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The client field must not be greater than 255 characters.')).toBeInTheDocument()
    expect(field(/^Client/)).toHaveValue('Acme Ltd')
    expect(field(/^Client/)).toHaveFocus() // the open tab has the first error
    tabName('Overview', '1 error')
    tabName('Media', '1 error')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('never resets the form when the project is refetched in the background', async () => {
    const server = editServer()
    const { user, queryClient } = renderWithProviders(<ProjectEdit />, { route, path })
    const client = await screen.findByLabelText(/^Client/)
    await enter(user, client, ' (draft)')
    expect(server.calls('GET', '/projects/7')).toHaveLength(1)

    // somebody else changed the record meanwhile
    server.on('GET /projects/:id', () => ({ data: { ...project, client: 'Changed elsewhere', name_en: 'Renamed elsewhere' } }))
    await act(() => queryClient.invalidateQueries({ queryKey: projects.keys.one(7) }))

    await waitFor(() => expect(server.calls('GET', '/projects/7').length).toBeGreaterThan(1))
    expect(field(/^Client/)).toHaveValue('Acme (draft)')
    expect(field('Project name (English)')).toHaveValue('Acme Portal')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps the form on screen when a background refetch fails', async () => {
    const server = editServer()
    const { user, queryClient } = renderWithProviders(<ProjectEdit />, { route, path })
    await user.type(await screen.findByLabelText(/^Client/), '!')

    server.on('GET /projects/:id', () => reply(500, { message: 'boom' }))
    await act(() => queryClient.invalidateQueries({ queryKey: projects.keys.one(7) }))

    await waitFor(() => expect(server.calls('GET', '/projects/7').length).toBeGreaterThan(1))
    expect(field(/^Client/)).toHaveValue('Acme!')
    expect(screen.queryByText('Could not load the data.')).not.toBeInTheDocument()
  })

  it('warns about unsaved Overview / Media changes while another tab is open, and hides Save there', async () => {
    editServer()
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })
    await user.type(await screen.findByLabelText(/^Client/), '!')

    await user.click(tab('Team'))

    expect(screen.getByText(/You have unsaved changes in Overview or Media/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument() // hidden with the form
    await user.click(tab('Overview'))
    expect(screen.queryByText(/You have unsaved changes/)).not.toBeInTheDocument()
    expect(field(/^Client/)).toHaveValue('Acme!') // still there
  })

  it('opens on the tab from ?tab= and loads the nested data', async () => {
    const server = editServer()
    renderWithProviders(<ProjectEdit />, { route: '/projects/7?tab=team', path })

    expect(await screen.findByText('Sara')).toBeInTheDocument()
    expect(screen.getByText('Omar')).toBeInTheDocument()
    expect(tab('Team')).toHaveAttribute('aria-selected', 'true')
    expect(server.calls('GET', '/projects/7/team-members').at(-1).query).toEqual({ per_page: '200', sort: 'order', dir: 'asc' })
    expect(server.calls('GET', '/projects/7/links')).toHaveLength(0) // loaded only when its tab opens
  })

  it('shows "not found" for a missing project', async () => {
    mockApi({ 'GET /projects/:id': () => reply(404, { message: 'No query results for model [App\\Models\\Project] 7' }) })
    renderWithProviders(<ProjectEdit />, { route, path })

    expect(await screen.findByText('Project not found')).toBeInTheDocument()
    expect(screen.queryByText(/App\\Models/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
  })

  it('offers a retry when loading fails for another reason', async () => {
    const server = mockApi({ 'GET /projects/:id': () => reply(500, { message: 'boom' }) })
    const { user } = renderWithProviders(<ProjectEdit />, { route, path })

    expect(await screen.findByText('Could not load the data.')).toBeInTheDocument()

    server.on('GET /projects/:id', () => ({ data: project }))
    server.on('GET /projects/:id/team-members', () => paginated([]))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText(/^Client/)).toBeInTheDocument()
  })

  it('renders in Arabic with the Arabic name as the title', async () => {
    editServer()
    renderWithProviders(<ProjectEdit />, { route, path, lang: 'ar' })

    expect(await screen.findByRole('heading', { level: 1, name: 'بوابة أكمي' })).toBeInTheDocument()
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: /^الفريق\s*2$/ })).toBeInTheDocument()
  })
})

describe('ProjectCreate for an account that cannot create projects', () => {
  it('says so instead of showing a form the API would refuse', () => {
    mockApi({})
    renderWithProviders(<ProjectCreate />, { route: '/projects/new', authUser: { id: 3, name: 'V', email: 'v@ngptechworld.com', is_super_admin: false, role: 'admin', permissions: [], registry_role: 'viewer' } })

    expect(screen.getByRole('heading', { name: 'You cannot create a project' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/registry/projects')
  })
})
