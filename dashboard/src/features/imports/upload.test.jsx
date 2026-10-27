import '@/features/projects/testTimeouts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { unzipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeXhr } from '@/test/fakeXhr'
import { mockApi, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { TOKEN_KEY } from '@/lib/storage'
import ImportBatchPage from './ImportBatchPage'
import { MAX_FILES } from './packaging'
import { BATCH_ID, dirEntry, dropOf, fileEntry, folderFile, makeBatch, makeFile } from './testUtils'
import { UploadCard } from './UploadCard'
import { zipPackage } from './zipPackage'

// a spy around the real zipper: the ZIP passthrough must never load or run it
vi.mock('./zipPackage', async (importOriginal) => {
  const original = await importOriginal()
  return { zipPackage: vi.fn(original.zipPackage) }
})

const created = () => reply(201, { data: makeBatch() })

beforeEach(() => {
  vi.mocked(zipPackage).mockClear()
})

function setup({ handler = created, xhr } = {}) {
  localStorage.setItem(TOKEN_KEY, 'tok-1')
  const server = mockApi({ 'POST /registry/imports': handler })
  const fake = installFakeXhr(xhr)
  const view = renderWithProviders(<UploadCard />, { route: '/imports' })
  return { server, fake, ...view }
}

const uploaded = (server) => server.calls('POST', '/registry/imports')[0]?.body.get('file')
const unzipped = async (file) => unzipSync(new Uint8Array(await file.arrayBuffer()))
const pickFolder = (files) => fireEvent.change(screen.getByTestId('folder-input'), { target: { files } })
const pickZip = (file) => fireEvent.change(screen.getByTestId('zip-input'), { target: { files: [file] } })
const location = () => screen.getByTestId('location')

describe('imports: upload a folder', () => {
  it('zips a chosen folder with its relative paths, skips other extensions and opens the batch', async () => {
    const { server } = setup()

    pickFolder([
      folderFile('dawri/portfolio.json', '{"project_id":"x"}'),
      folderFile('dawri/operational.json', '{}'),
      folderFile('dawri/PORTFOLIO_AR.md', '# دوري'),
      folderFile('dawri/public/screenshots/01-home.png', 'png-bytes'),
      folderFile('dawri/.DS_Store', 'junk'),
      folderFile('dawri/notes.txt', 'junk'),
    ])

    await waitFor(() => expect(location()).toHaveTextContent(`/imports/${BATCH_ID}`))
    const file = uploaded(server)
    expect(file.name).toBe('dawri.zip')
    expect(Object.keys(await unzipped(file))).toEqual(['dawri/portfolio.json', 'dawri/operational.json', 'dawri/PORTFOLIO_AR.md', 'dawri/public/screenshots/01-home.png'])
    expect(server.calls('POST', '/registry/imports')[0].headers.authorization).toBe('Bearer tok-1')
    expect(screen.getByText('2 files were skipped (extension not accepted).')).toBeInTheDocument()
    expect(zipPackage).toHaveBeenCalledTimes(1)
  })

  it('walks a dropped folder recursively and zips what it holds', async () => {
    const { server } = setup()
    const folder = dirEntry('ngp-portfolio', [
      fileEntry('/ngp-portfolio/portfolio.json', '{}'),
      dirEntry('ngp-portfolio/public', [dirEntry('ngp-portfolio/public/screenshots', [fileEntry('/ngp-portfolio/public/screenshots/01.webp', 'webp')])]),
      fileEntry('/ngp-portfolio/Thumbs.db', 'junk'),
    ])

    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: dropOf([folder]) })

    await waitFor(() => expect(uploaded(server)).toBeTruthy())
    const file = uploaded(server)
    expect(file.name).toBe('ngp-portfolio.zip')
    expect(Object.keys(await unzipped(file))).toEqual(['ngp-portfolio/portfolio.json', 'ngp-portfolio/public/screenshots/01.webp'])
    expect(await screen.findByText('1 file was skipped (extension not accepted).')).toBeInTheDocument()
  })

  it('refuses more than 300 files before zipping or sending anything', async () => {
    const { server } = setup()

    pickFolder(Array.from({ length: MAX_FILES + 1 }, (_, index) => folderFile(`big/${index}.json`, '{}')))

    expect(await screen.findByText('The folder holds 301 accepted files; at most 300 are allowed.')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
    expect(zipPackage).not.toHaveBeenCalled()
  })

  it('refuses more than 200 MB, with the sizes in words', async () => {
    const { server } = setup()

    pickFolder([folderFile('p/portfolio.json', '{}', { size: 150 * 1024 * 1024 }), folderFile('p/operational.json', '{}', { size: 60 * 1024 * 1024 })])

    expect(await screen.findByText('The folder’s files take 210 MB; at most 200 MB is allowed.')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })

  it('says so when a folder has no accepted file', async () => {
    const { server } = setup()
    pickFolder([folderFile('repo/index.js', 'x'), folderFile('repo/README', 'x')])
    expect(await screen.findByText('The folder has no file of an accepted type (json, md, png, jpg, jpeg, webp).')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })
})

describe('imports: upload a ZIP', () => {
  it('sends a chosen ZIP as it is, without zipping it again', async () => {
    const { server } = setup()
    const zip = makeFile('dawri-export.zip', 'PK\u0003\u0004 the bytes', { type: 'application/zip' })

    pickZip(zip)

    await waitFor(() => expect(location()).toHaveTextContent(`/imports/${BATCH_ID}`))
    const file = uploaded(server)
    expect(file.name).toBe('dawri-export.zip')
    expect(await file.text()).toBe('PK\u0003\u0004 the bytes')
    expect(zipPackage).not.toHaveBeenCalled()
  })

  it('takes a dropped ZIP as it is', async () => {
    const { server } = setup()
    const zip = makeFile('dawri.zip', 'PK', { type: 'application/zip' })
    const entry = { isFile: true, isDirectory: false, name: 'dawri.zip', fullPath: '/dawri.zip' }

    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: dropOf([entry], [zip]) })

    await waitFor(() => expect(uploaded(server)?.name).toBe('dawri.zip'))
    expect(zipPackage).not.toHaveBeenCalled()
  })

  it('shows the upload progress, then the server step, then opens the batch', async () => {
    const { fake } = setup({ xhr: { progress: [0.4], hold: true } })

    pickZip(makeFile('dawri.zip', 'z'.repeat(1000), { type: 'application/zip' }))

    const bar = await screen.findByRole('progressbar', { name: 'Uploading…' })
    await waitFor(() => expect(bar).toHaveAttribute('aria-valuenow', '40'))
    expect(screen.getByText('Uploading… 40%')).toBeInTheDocument()

    fake.release()
    await waitFor(() => expect(location()).toHaveTextContent(`/imports/${BATCH_ID}`))
  })

  it('reaches "checking the package" once every byte is sent', async () => {
    let answer
    setup({ handler: () => new Promise((resolve) => (answer = resolve)), xhr: { progress: [1] } })

    pickZip(makeFile('dawri.zip', 'z'.repeat(100), { type: 'application/zip' }))

    expect(await screen.findByRole('progressbar', { name: 'Checking the package and preparing the preview…' })).toBeInTheDocument()
    answer(created())
    await waitFor(() => expect(location()).toHaveTextContent(`/imports/${BATCH_ID}`))
  })

  it('refuses a ZIP over 50 MB before uploading it', async () => {
    const { server } = setup()
    pickZip(makeFile('huge.zip', 'PK', { type: 'application/zip', size: 51 * 1024 * 1024 }))
    expect(await screen.findByText('The ZIP (51 MB) is larger than the 50 MB that can be uploaded.')).toBeInTheDocument()
    expect(server.requests).toHaveLength(0)
  })
})

describe('imports: refused packages', () => {
  it('shows a 422 PackageProblem in words with each problem’s file, pointer and message', async () => {
    setup({
      handler: () =>
        reply(422, {
          message: 'The package does not match the schema.',
          code: 'E_SCHEMA',
          problems: [
            { code: 'E_SCHEMA', file: 'portfolio.json', pointer: '/project_name/ar', message: 'must be string' },
            { code: 'E_MISSING_SCREENSHOT', file: 'public/screenshots/02.png', pointer: null, message: 'is listed but missing' },
            { code: 'E_JSON', file: null, pointer: null, message: 'Unexpected token' },
          ],
        }),
    })

    pickZip(makeFile('dawri.zip', 'PK', { type: 'application/zip' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('The package was not accepted')).toBeInTheDocument()
    expect(within(alert).getByText(/The package files do not match the schema\./)).toBeInTheDocument()
    const items = within(within(alert).getByRole('list', { name: 'Details' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['portfolio.json · /project_name/ar · must be string', 'public/screenshots/02.png · is listed but missing', 'Unexpected token'])
    expect(within(alert).getByText('The values themselves are never shown here: the server never sends them back.')).toBeInTheDocument()
  })

  it('shows the Arabic text of a known code, and the server message for an unknown one', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-1')
    const server = mockApi({ 'POST /registry/imports': () => reply(422, { message: 'Slug taken', code: 'E_SLUG_TAKEN', problems: [] }) })
    installFakeXhr()
    renderWithProviders(<UploadCard />, { route: '/imports', lang: 'ar' })

    pickZip(makeFile('dawri.zip', 'PK', { type: 'application/zip' }))
    expect(await screen.findByText(/الرابط المختصر \(slug\) لمشروع آخر استُورد بمعرّف مختلف/)).toBeInTheDocument()

    server.on('POST /registry/imports', () => reply(422, { message: 'Something brand new went wrong', code: 'E_FUTURE', problems: [] }))
    pickZip(makeFile('dawri.zip', 'PK', { type: 'application/zip' }))
    expect(await screen.findByText('Something brand new went wrong')).toBeInTheDocument()
  })

  it('asks for two-step sign-in on a 403 mfa_enrollment_required', async () => {
    setup({ handler: () => reply(403, { message: 'Two-step sign-in is required.', code: 'mfa_enrollment_required' }) })

    pickZip(makeFile('dawri.zip', 'PK', { type: 'application/zip' }))

    expect(await screen.findByText('Turn on two-step sign-in to use imports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open my account' })).toHaveAttribute('href', '/account#mfa')
  })
})

describe('imports: after the upload', () => {
  it('tells on the batch page how many files the zipping skipped', async () => {
    mockApi({ [`GET /registry/imports/${BATCH_ID}`]: () => ({ data: makeBatch() }) })
    renderWithProviders(<ImportBatchPage />, { route: { pathname: `/imports/${BATCH_ID}`, state: { skipped: 3 } }, path: '/imports/:id' })
    expect(await screen.findByText('3 files were skipped when the folder was zipped (extension not accepted).')).toBeInTheDocument()
  })
})
