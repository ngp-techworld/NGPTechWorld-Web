import { unzipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { MAX_FILES, MAX_FOLDER_BYTES, MAX_ZIP_BYTES, PackageInputError, checkZip, entriesFromFileList, extensionOf, normalizePath, planFolder, readDrop, readDroppedEntries } from './packaging'
import { zipPackage } from './zipPackage'
import { dirEntry, fileEntry, folderFile, makeFile } from './testUtils'

const errorOf = (fn) => {
  try {
    fn()
  } catch (err) {
    return err
  }
  return null
}

describe('paths and extensions', () => {
  it('keeps relative paths with / separators only and drops what climbs out', () => {
    expect(normalizePath('ngp-portfolio\\public\\screenshots\\01.png')).toBe('ngp-portfolio/public/screenshots/01.png')
    expect(normalizePath('/ngp-portfolio/./portfolio.json')).toBe('ngp-portfolio/portfolio.json')
    expect(normalizePath('a//b/')).toBe('a/b')
    expect(normalizePath('ngp-portfolio/../secrets.json')).toBeNull()
    expect(normalizePath('')).toBeNull()
  })

  it('reads the extension case-insensitively and ignores dot files', () => {
    expect(extensionOf('public/Shot.PNG')).toBe('png')
    expect(extensionOf('PORTFOLIO_AR.md')).toBe('md')
    expect(extensionOf('.DS_Store')).toBe('')
    expect(extensionOf('LICENSE')).toBe('')
  })
})

describe('planFolder', () => {
  it('keeps the accepted files, stores images, compresses json/md and counts what it skipped', () => {
    const plan = planFolder(
      entriesFromFileList([
        folderFile('dawri/portfolio.json', '{}'),
        folderFile('dawri/operational.json', '{}'),
        folderFile('dawri/PORTFOLIO_AR.md', '# x'),
        folderFile('dawri/public/screenshots/01-home.png', 'png'),
        folderFile('dawri/internal/screenshots/02-admin.webp', 'webp'),
        folderFile('dawri/.DS_Store', 'x'),
        folderFile('dawri/notes.txt', 'x'),
        folderFile('dawri/build.zip', 'x'),
      ]),
    )

    expect(plan.files.map((item) => [item.path, item.store])).toEqual([
      ['dawri/portfolio.json', false],
      ['dawri/operational.json', false],
      ['dawri/PORTFOLIO_AR.md', false],
      ['dawri/public/screenshots/01-home.png', true],
      ['dawri/internal/screenshots/02-admin.webp', true],
    ])
    expect(plan.skipped).toEqual(['dawri/.DS_Store', 'dawri/notes.txt', 'dawri/build.zip'])
    expect(plan.name).toBe('dawri.zip')
  })

  it('names the ZIP ngp-portfolio.zip when the files are the folder’s contents', () => {
    const plan = planFolder([
      { path: 'portfolio.json', file: makeFile('portfolio.json', '{}') },
      { path: 'public/screenshots/01.png', file: makeFile('01.png', 'x') },
    ])
    expect(plan.name).toBe('ngp-portfolio.zip')
  })

  it('refuses more than 300 accepted files before zipping', () => {
    const entries = Array.from({ length: MAX_FILES + 1 }, (_, index) => ({ path: `p/${index}.json`, file: makeFile(`${index}.json`, '{}') }))
    const err = errorOf(() => planFolder(entries))
    expect(err).toBeInstanceOf(PackageInputError)
    expect(err.code).toBe('too_many_files')
    expect(err.details).toMatchObject({ count: 301, max: 300 })
    // skipped files do not count
    expect(() => planFolder([...entries.slice(0, MAX_FILES), { path: 'p/extra.txt', file: makeFile('extra.txt', 'x') }])).not.toThrow()
  })

  it('refuses more than 200 MB before zipping, and images that alone exceed the 50 MB upload', () => {
    const big = (path, size) => ({ path, file: makeFile(path, 'x', { size }) })
    expect(errorOf(() => planFolder([big('p/a.json', MAX_FOLDER_BYTES), big('p/b.md', 1)])).code).toBe('too_large')
    const images = errorOf(() => planFolder([big('p/a.png', MAX_ZIP_BYTES), big('p/b.jpg', 1)]))
    expect(images.code).toBe('zip_too_large')
  })

  it('refuses a folder without any accepted file', () => {
    const err = errorOf(() => planFolder([{ path: 'p/readme.txt', file: makeFile('readme.txt', 'x') }]))
    expect(err.code).toBe('empty')
    expect(err.details.skipped).toEqual(['p/readme.txt'])
  })
})

describe('checkZip', () => {
  it('lets a ZIP through as it is, and refuses other files or one over 50 MB', () => {
    const zip = makeFile('dawri.zip', 'PK', { type: 'application/zip' })
    expect(checkZip(zip)).toBe(zip)
    expect(errorOf(() => checkZip(makeFile('dawri.rar', 'x'))).code).toBe('not_zip')
    expect(errorOf(() => checkZip(makeFile('big.zip', 'x', { size: MAX_ZIP_BYTES + 1 }))).code).toBe('zip_too_large')
  })
})

describe('dropped folders', () => {
  it('walks directories recursively, reading every batch of entries', async () => {
    const root = dirEntry('ngp-portfolio', [
      fileEntry('/ngp-portfolio/portfolio.json', '{}'),
      dirEntry('ngp-portfolio/public', [dirEntry('ngp-portfolio/public/screenshots', [fileEntry('/ngp-portfolio/public/screenshots/01.png', 'x'), fileEntry('/ngp-portfolio/public/screenshots/02.png', 'x')])]),
    ], { batchSize: 1 })

    const found = await readDroppedEntries([root])

    expect(found.map((item) => normalizePath(item.path))).toEqual(['ngp-portfolio/portfolio.json', 'ngp-portfolio/public/screenshots/01.png', 'ngp-portfolio/public/screenshots/02.png'])
  })

  it('gives up on a huge folder', async () => {
    const many = dirEntry('repo', Array.from({ length: 12 }, (_, index) => fileEntry(`/repo/${index}.js`, 'x')))
    await expect(readDroppedEntries([many], { maxEntries: 10 })).rejects.toMatchObject({ code: 'too_many_scanned' })
  })

  it('tells a dropped ZIP from a dropped folder, synchronously', () => {
    const zipFile = makeFile('dawri.zip', 'PK', { type: 'application/zip' })
    const zipItem = { kind: 'file', webkitGetAsEntry: () => ({ isFile: true, isDirectory: false, name: 'dawri.zip' }), getAsFile: () => zipFile }
    expect(readDrop({ items: [zipItem], files: [zipFile] })).toEqual({ kind: 'zip', file: zipFile })

    const folder = dirEntry('dawri', [])
    const folderItem = { kind: 'file', webkitGetAsEntry: () => folder, getAsFile: () => null }
    expect(readDrop({ items: [folderItem], files: [] })).toEqual({ kind: 'entries', entries: [folder] })

    expect(() => readDrop({ items: [zipItem, folderItem], files: [zipFile] })).toThrow(PackageInputError)
  })
})

describe('zipPackage', () => {
  it('keeps the relative paths, stores images and deflates json and md, reporting progress', async () => {
    const plan = planFolder(
      entriesFromFileList([
        folderFile('dawri/portfolio.json', JSON.stringify({ project_id: 'x', text: 'a'.repeat(400) })),
        folderFile('dawri/PORTFOLIO_EN.md', '# Dawri\n'.repeat(40)),
        folderFile('dawri/public/screenshots/01 الرئيسية.png', 'not really a png'),
      ]),
    )
    const onProgress = vi.fn()

    const zip = await zipPackage(plan.files, { name: plan.name, onProgress })

    expect(zip.name).toBe('dawri.zip')
    expect(zip.type).toBe('application/zip')
    const seen = []
    const unzipped = unzipSync(new Uint8Array(await zip.arrayBuffer()), { filter: (info) => seen.push(info) > 0 })
    expect(Object.keys(unzipped)).toEqual(['dawri/portfolio.json', 'dawri/PORTFOLIO_EN.md', 'dawri/public/screenshots/01 الرئيسية.png'])
    expect(Object.keys(unzipped).every((path) => !path.includes('\\'))).toBe(true)
    expect(seen.map((info) => info.compression)).toEqual([8, 8, 0]) // 8 = deflate, 0 = stored
    expect(new TextDecoder().decode(unzipped['dawri/public/screenshots/01 الرئيسية.png'])).toBe('not really a png')
    expect(onProgress.mock.calls.map(([ratio]) => ratio).at(0)).toBe(0)
    expect(onProgress.mock.calls.map(([ratio]) => ratio).at(-1)).toBe(1)
  })

  it('stops between files when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(zipPackage([{ path: 'a.json', file: makeFile('a.json', '{}'), store: false }], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
