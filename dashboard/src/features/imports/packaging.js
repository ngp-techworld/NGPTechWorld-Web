// What the upload step sends: a ZIP the user picked (as is), or a folder the browser zips first (zipPackage.js).
// Everything here is plain logic, without fflate, so it stays in the page chunk and is tested on its own.

/** The only files a package folder contributes (contract: "Dashboard notes"). The rest is skipped and counted. */
export const ALLOWED_EXTENSIONS = ['json', 'md', 'png', 'jpg', 'jpeg', 'webp']
/** Already compressed: stored in the ZIP as they are. JSON and Markdown are deflated. */
export const STORED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

export const MAX_FILES = 300
export const MAX_FOLDER_BYTES = 200 * 1024 * 1024
/** `POST imports` takes a ZIP of at most 50 MB. */
export const MAX_ZIP_BYTES = 50 * 1024 * 1024
/** A folder walk gives up after this many entries (someone dropped the whole repository, node_modules included). */
export const MAX_SCANNED = 5000

const DEFAULT_ROOT = 'ngp-portfolio'

/** A refusal before anything is sent: `code` is a key of `strings.inputErrors`, `details` its numbers. */
export class PackageInputError extends Error {
  constructor(code, details = {}) {
    super(code)
    this.name = 'PackageInputError'
    this.code = code
    this.details = details
  }
}

/** 'Public/Shot.PNG' → 'png'; a dot file ('.DS_Store') or a name without a dot → ''. */
export function extensionOf(path) {
  const name = String(path).split('/').pop()
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * A relative path with `/` separators only: backslashes become `/`, leading `/` and `.` segments are dropped. A path
 * that climbs out (`..`) or is empty gives null, and the file is skipped.
 */
export function normalizePath(raw) {
  const segments = String(raw ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
  if (!segments.length || segments.includes('..')) return null
  return segments.join('/')
}

export const isZipFile = (file) => Boolean(file) && (/\.zip$/i.test(file.name ?? '') || ['application/zip', 'application/x-zip-compressed'].includes(file.type))

/** Files of `<input type="file" webkitdirectory>` (or a plain multi-file pick) → `[{ path, file }]`. */
export const entriesFromFileList = (fileList) => Array.from(fileList ?? []).map((file) => ({ path: file.webkitRelativePath || file.name, file }))

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject))
const readBatch = (reader) => new Promise((resolve, reject) => reader.readEntries(resolve, reject))

/**
 * Walks dropped `FileSystemEntry`s (`DataTransferItem.webkitGetAsEntry()`) recursively → `[{ path, file }]`.
 * `readEntries` answers in batches (100 in Chrome), so a directory is read until it returns an empty batch.
 */
export async function readDroppedEntries(entries, { maxEntries = MAX_SCANNED } = {}) {
  const found = []
  let scanned = 0
  async function walk(entry) {
    scanned += 1
    if (scanned > maxEntries) throw new PackageInputError('too_many_scanned', { max: maxEntries })
    if (entry.isFile) {
      const file = await fileOf(entry)
      found.push({ path: entry.fullPath || file.name, file })
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      for (;;) {
        const batch = await readBatch(reader)
        if (!batch.length) break
        for (const child of batch) await walk(child)
      }
    }
  }
  for (const entry of entries) await walk(entry)
  return found
}

/**
 * What a drop holds, read synchronously inside the drop event (the browser empties `dataTransfer` afterwards):
 * `{ kind: 'zip', file }`, `{ kind: 'entries', entries }` (folders and files to walk) or `{ kind: 'files', files }`
 * (a browser without `webkitGetAsEntry`). Throws `PackageInputError('one_item')` for a ZIP dropped with other things.
 */
export function readDrop(dataTransfer) {
  const items = Array.from(dataTransfer?.items ?? []).filter((item) => item.kind === 'file')
  const files = Array.from(dataTransfer?.files ?? [])
  const entries = items.map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))

  if (entries.length && entries.every(Boolean)) {
    const zips = entries.filter((entry) => entry.isFile && /\.zip$/i.test(entry.name))
    if (zips.length && entries.length > 1) throw new PackageInputError('one_item')
    if (zips.length) {
      const file = items[0].getAsFile?.() ?? files[0]
      if (!file) throw new PackageInputError('read_failed')
      return { kind: 'zip', file }
    }
    return { kind: 'entries', entries }
  }

  if (!files.length) throw new PackageInputError('read_failed')
  if (files.some(isZipFile)) {
    if (files.length > 1) throw new PackageInputError('one_item')
    return { kind: 'zip', file: files[0] }
  }
  return { kind: 'files', files }
}

/** The ZIP's name: the folder all paths sit in (`dawri/…` → `dawri.zip`), otherwise `ngp-portfolio.zip`. */
function zipNameOf(paths) {
  const firsts = new Set(paths.map((path) => path.split('/')[0]))
  const nested = paths.every((path) => path.includes('/'))
  const root = firsts.size === 1 && nested ? [...firsts][0] : DEFAULT_ROOT
  return `${root}.zip`
}

/**
 * `[{ path, file }]` → what will be zipped: `{ files: [{ path, file, store }], skipped: [paths], totalBytes, name }`.
 * Paths are normalized (`/` only, never `..`), duplicates kept once, files outside ALLOWED_EXTENSIONS skipped.
 * Throws `PackageInputError` with `empty`, `too_many_files` (> 300), `too_large` (> 200 MB) or `zip_too_large` (the
 * images alone, stored as they are, already exceed what can be uploaded).
 */
export function planFolder(entries) {
  const files = []
  const skipped = []
  const seen = new Set()
  for (const { path: raw, file } of entries) {
    const path = normalizePath(raw)
    if (!path) {
      skipped.push(String(raw ?? ''))
      continue
    }
    if (seen.has(path)) continue
    seen.add(path)
    const extension = extensionOf(path)
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      skipped.push(path)
      continue
    }
    files.push({ path, file, store: STORED_EXTENSIONS.includes(extension) })
  }

  if (!files.length) throw new PackageInputError('empty', { skipped })
  if (files.length > MAX_FILES) throw new PackageInputError('too_many_files', { count: files.length, max: MAX_FILES, skipped })
  const totalBytes = files.reduce((sum, item) => sum + (item.file.size ?? 0), 0)
  if (totalBytes > MAX_FOLDER_BYTES) throw new PackageInputError('too_large', { bytes: totalBytes, max: MAX_FOLDER_BYTES, skipped })
  const storedBytes = files.filter((item) => item.store).reduce((sum, item) => sum + (item.file.size ?? 0), 0)
  if (storedBytes > MAX_ZIP_BYTES) throw new PackageInputError('zip_too_large', { bytes: storedBytes, max: MAX_ZIP_BYTES, skipped })

  return { files, skipped, totalBytes, name: zipNameOf(files.map((item) => item.path)) }
}

/** A ZIP picked or dropped as is: only its size is checked here, the server checks the rest. */
export function checkZip(file) {
  if (!isZipFile(file)) throw new PackageInputError('not_zip')
  if (file.size > MAX_ZIP_BYTES) throw new PackageInputError('zip_too_large', { bytes: file.size, max: MAX_ZIP_BYTES })
  return file
}
