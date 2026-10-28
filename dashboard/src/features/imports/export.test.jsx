import '@/features/projects/testTimeouts'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjectEdit from '@/features/projects/ProjectEdit'
import { registryRoutes } from '@/features/projects/registryTestUtils'
import { TOKEN_KEY } from '@/lib/storage'
import { mockApi, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ExportPackageButton } from './ExportButton'

const zipResponse = (headers = {}) => new Response('PK\u0003\u0004zip', { status: 200, headers: { 'Content-Type': 'application/zip', ...headers } })

/** Captures what saveBlob downloads: the object URL's blob and the link's file name. */
function captureDownloads() {
  const downloads = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    downloads.push({ blob })
    return 'blob:export'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    downloads.at(-1).filename = this.download
  })
  return downloads
}

describe('export the package', () => {
  it('downloads GET registry/projects/{id}/export as a blob with the bearer token, under the server’s file name', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-9')
    const server = mockApi({ 'GET /registry/projects/:id/export': () => null })
    server.fetch.mockResolvedValueOnce(zipResponse({ 'Content-Disposition': 'attachment; filename="dawri-ngp-portfolio.zip"' }))
    const downloads = captureDownloads()
    const { user } = renderWithProviders(<ExportPackageButton project={{ id: 7, slug: 'dawri' }} />)

    await user.click(screen.getByRole('button', { name: 'Export the package' }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    const [url, init] = server.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/registry/projects/7/export')
    expect(init.headers.Authorization).toBe('Bearer tok-9')
    expect(downloads[0].filename).toBe('dawri-ngp-portfolio.zip')
    expect(await downloads[0].blob.text()).toBe('PK\u0003\u0004zip')
    expect(await screen.findByText('The project package was downloaded')).toBeInTheDocument()
  })

  it('names the file <slug>-ngp-portfolio.zip when the server sends no file name', async () => {
    const server = mockApi({})
    server.fetch.mockResolvedValueOnce(zipResponse())
    const downloads = captureDownloads()
    const { user } = renderWithProviders(<ExportPackageButton project={{ id: 7, slug: 'dawri' }} />)

    await user.click(screen.getByRole('button', { name: 'Export the package' }))

    await waitFor(() => expect(downloads[0]?.filename).toBe('dawri-ngp-portfolio.zip'))
  })

  it('says why an export was refused', async () => {
    mockApi({ 'GET /registry/projects/:id/export': () => reply(403, { message: 'MFA', code: 'mfa_enrollment_required' }) })
    const { user } = renderWithProviders(<ExportPackageButton project={{ id: 7, slug: 'dawri' }} />)

    await user.click(screen.getByRole('button', { name: 'Export the package' }))

    expect(await screen.findByText(/Turn on two-step sign-in on your account page/)).toBeInTheDocument()
  })

  it('sits in the project page header when the registry record loads, and not without it', async () => {
    mockApi(registryRoutes())
    const page = renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
    expect(await screen.findByRole('button', { name: 'Export the package' })).toBeInTheDocument()
    page.unmount()

    mockApi(registryRoutes({ extra: { 'GET /registry/projects/:id': () => reply(404, { message: 'Not found.' }) } }))
    renderWithProviders(<ProjectEdit />, { route: '/projects/7', path: '/projects/:id' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Portal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export the package' })).not.toBeInTheDocument()
  })
})
