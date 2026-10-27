import { clearToken, getToken } from './storage'

/**
 * Failure of an API call. `errors` is Laravel's `{ field: [messages] }` map (422), `data` the raw JSON body.
 * status 0 = the request never reached the server (offline / CORS / server down).
 */
export class ApiError extends Error {
  constructor({ status = 0, message, errors, data = null, retryAfter = null } = {}) {
    super(message || `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors && typeof errors === 'object' ? errors : {}
    this.data = data
    this.retryAfter = retryAfter
  }
}

const DEFAULT_MESSAGES = {
  0: 'Network error',
  401: 'Unauthenticated.',
  403: 'Forbidden.',
  404: 'Not found.',
  422: 'The given data was invalid.',
  429: 'Too many requests.',
}

const apiRoot = () => `${String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')}/admin`

let unauthorizedHandler = null

/** AuthProvider registers itself here. Returns an unsubscribe function. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
  return () => {
    if (unauthorizedHandler === fn) unauthorizedHandler = null
  }
}

function handleUnauthorized() {
  clearToken()
  if (unauthorizedHandler) unauthorizedHandler()
  else if (typeof window !== 'undefined') {
    // Fallback only (AuthProvider is normally mounted and handles this through the router instead): raw
    // navigation, so it must carry the deploy prefix itself — BASE_URL already ends in '/' (e.g. '/ngp-hq/').
    const loginUrl = `${import.meta.env.BASE_URL}login`
    if (window.location.pathname !== loginUrl) window.location.assign(loginUrl)
  }
}

/** { page: 2, search: '', is_active: true, ids: [1,2] } → '?page=2&is_active=1&ids[]=1&ids[]=2' (empty values are dropped). */
export function buildQuery(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => search.append(`${key}[]`, String(item)))
    else search.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function parseBody(res) {
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** `xhr.getAllResponseHeaders()` → Headers. */
function parseXhrHeaders(raw) {
  const headers = new Headers()
  for (const line of String(raw || '').split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon > 0) headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
  }
  return headers
}

/**
 * The same request through XMLHttpRequest, which (unlike fetch) reports upload progress. Resolves a `Response`, so the
 * caller handles it exactly like a fetch answer. `onUploadProgress({ loaded, total })`: `total` is null when unknown.
 */
function sendWithProgress(url, init, onUploadProgress) {
  return new Promise((resolve, reject) => {
    if (init.signal?.aborted) {
      reject(new DOMException('The request was aborted.', 'AbortError'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open(init.method, url)
    Object.entries(init.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => onUploadProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : null })
    }
    xhr.onload = () => {
      const empty = [204, 205, 304].includes(xhr.status)
      resolve(new Response(empty ? null : xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers: parseXhrHeaders(xhr.getAllResponseHeaders()) }))
    }
    xhr.onerror = () => reject(new ApiError({ status: 0, message: DEFAULT_MESSAGES[0] }))
    xhr.onabort = () => reject(new DOMException('The request was aborted.', 'AbortError'))
    init.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(init.body ?? null)
  })
}

async function send(method, path, { params, body, signal, auth = true, headers = {}, onUploadProgress } = {}) {
  const url = `${apiRoot()}${path.startsWith('/') ? path : `/${path}`}${buildQuery(params)}`
  const init = { method, signal, headers: { Accept: 'application/json', ...headers } }

  const token = auth ? getToken() : null
  if (token) init.headers.Authorization = `Bearer ${token}`

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    init.body = body // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  if (typeof onUploadProgress === 'function' && typeof XMLHttpRequest !== 'undefined') return sendWithProgress(url, init, onUploadProgress)

  let res
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError({ status: 0, message: DEFAULT_MESSAGES[0] })
  }
  return res
}

async function request(method, path, options = {}) {
  const res = await send(method, path, options)
  const data = await parseBody(res)

  if (!res.ok) {
    if (res.status === 401 && options.auth !== false) handleUnauthorized()
    const retryAfter = Number(res.headers.get('Retry-After'))
    throw new ApiError({
      status: res.status,
      message: data?.message || DEFAULT_MESSAGES[res.status] || `Request failed (${res.status})`,
      errors: data?.errors,
      data,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    })
  }
  return data
}

/** Binary download (e.g. CSV export) with the bearer token. Resolves `{ blob, filename, contentType }`. */
async function download(path, params, options = {}) {
  const res = await send('GET', path, { ...options, params, headers: { Accept: '*/*', ...options.headers } })
  if (!res.ok) {
    if (res.status === 401 && options.auth !== false) handleUnauthorized()
    const data = await parseBody(res).catch(() => null)
    throw new ApiError({ status: res.status, message: data?.message || DEFAULT_MESSAGES[res.status], errors: data?.errors, data })
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return {
    blob: await res.blob(),
    filename: match ? decodeURIComponent(match[1]) : null,
    contentType: res.headers.get('Content-Type') || '',
  }
}

/**
 * Every method returns the parsed JSON body exactly as Laravel sent it (`{ data, meta, links }` for lists,
 * `{ data }` for a record, `null` for 204) and throws ApiError otherwise. `options`: { signal, auth, headers, onUploadProgress }.
 * `auth: false` = no bearer token and a 401 does not log the user out (used by login). `onUploadProgress({ loaded,
 * total })` sends the request through XMLHttpRequest instead of fetch, to report how much of the body was sent.
 */
export const api = {
  request,
  get: (path, params, options) => request('GET', path, { ...options, params }),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
  download,

  /** multipart POST /uploads → `{ path, url }` (store `path` on the record, preview with `url`). */
  async upload(file, folder = 'misc', options) {
    const body = new FormData()
    body.append('file', file)
    body.append('folder', folder)
    const res = await request('POST', '/uploads', { ...options, body })
    return res.data
  },

  /** DELETE /uploads {path} (204). Only needed for files that were never saved on a record. */
  deleteUpload: (path, options) => request('DELETE', '/uploads', { ...options, body: { path } }),
}

/** Save a Blob from `api.download` as a file in the browser. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
