import { Zip, ZipDeflate, ZipPassThrough } from 'fflate'

// Zips a planned folder (packaging.js `planFolder`) in the browser. Loaded with `import('./zipPackage')` the first
// time a folder is dropped, so fflate is only downloaded by those who need it.

const DEFLATE_LEVEL = 6

/** File → bytes (jsdom and older engines lack `Blob.arrayBuffer`). */
function readBytes(file) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// lets the browser paint the progress bar between files
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * `files`: `[{ path, file, store }]`. Images (`store: true`) are stored as they are, `.json` and `.md` are deflated;
 * the paths are kept exactly (relative, `/` only). `onProgress(ratio)` runs after each file with the share of bytes
 * done; `signal` stops between files with an AbortError. Resolves a `File` (`application/zip`) named `name`.
 */
export async function zipPackage(files, { name = 'ngp-portfolio.zip', onProgress, signal } = {}) {
  const chunks = []
  let fail
  let finish
  const done = new Promise((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      fail(err)
      return
    }
    chunks.push(chunk)
    if (final) finish()
  })

  const total = files.reduce((sum, item) => sum + (item.file.size ?? 0), 0) || 1
  let processed = 0
  onProgress?.(0)
  for (const { path, file, store } of files) {
    if (signal?.aborted) {
      zip.terminate()
      throw new DOMException('The zipping was aborted.', 'AbortError')
    }
    const entry = store ? new ZipPassThrough(path) : new ZipDeflate(path, { level: DEFLATE_LEVEL })
    zip.add(entry)
    entry.push(await readBytes(file), true)
    processed += file.size ?? 0
    onProgress?.(Math.min(1, processed / total))
    await nextTask()
  }
  zip.end()
  await done
  return new File(chunks, name, { type: 'application/zip' })
}
