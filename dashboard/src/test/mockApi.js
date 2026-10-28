import { vi } from 'vitest'

/** Builds a { data, links, meta } Laravel-style page from an array of rows. */
export function paginated(rows, { page = 1, perPage = 15, total = rows.length } = {}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  return {
    data: rows,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total,
      from: rows.length ? (page - 1) * perPage + 1 : null,
      to: rows.length ? (page - 1) * perPage + rows.length : null,
    },
  }
}

/** Return `reply(422, { message, errors })` from a handler to answer with a specific status / body / headers. */
export const reply = (status, body = null, headers = {}) => ({ __reply: true, status, body, headers })

/**
 * A raw (non-JSON) body: `replyText(201, '<b>Notice</b>: …{"data":{}}')` — e.g. a PHP notice printed in front of the
 * JSON, which the api client must turn into an ApiError (`UNREADABLE_RESPONSE`) instead of hanging the caller.
 */
export const replyText = (status, text, headers = {}) => ({ __reply: true, status, raw: String(text), headers })

/** 422 in Laravel's shape: validationError({ question_ar: ['The question ar field is required.'] }) */
export const validationError = (errors, message = 'The given data was invalid.') => reply(422, { message, errors })

const toRegex = (pattern) => new RegExp(`^${pattern.replace(/:[A-Za-z_]+/g, '([^/]+)').replace(/\/+$/, '')}/?$`)
const paramNames = (pattern) => [...pattern.matchAll(/:([A-Za-z_]+)/g)].map((match) => match[1])

/**
 * Replaces `fetch` with a fake Laravel admin API. Keys are 'METHOD /path' relative to /api/admin, `:param`
 * segments are captured. A handler receives `{ method, path, params, query, body, headers, url }` and returns:
 *   - a plain value  → 200 JSON of that value       - null / undefined → 204 No Content
 *   - reply(status, body, headers) → any status (errors, 201…); replyText(status, text) → a raw, non-JSON body
 *   - a function is also accepted for a key to be re-defined later with `api.on(key, handler)`.
 * Unmatched requests answer 404 JSON and are listed in `api.unmatched`.
 *
 *   const api = mockApi({
 *     'GET /faqs': () => paginated([faq1, faq2]),
 *     'GET /faqs/:id': ({ params }) => ({ data: { ...faq1, id: Number(params.id) } }),
 *     'POST /faqs': ({ body }) => reply(201, { data: { id: 9, ...body } }),
 *     'DELETE /faqs/:id': () => null,
 *   })
 *   …
 *   expect(api.calls('POST', '/faqs')[0].body).toEqual({ … })
 *
 * Every call is recorded in `api.requests` (also with Authorization headers), so tests exercise the real api client.
 */
export function mockApi(routes = {}) {
  const table = []
  const requests = []
  const unmatched = []

  const on = (key, handler) => {
    const [method, ...rest] = key.split(' ')
    const pattern = rest.join(' ')
    const index = table.findIndex((entry) => entry.method === method && entry.pattern === pattern)
    const entry = { method, pattern, regex: toRegex(pattern), names: paramNames(pattern), handler }
    if (index >= 0) table[index] = entry
    else table.push(entry)
  }
  Object.entries(routes).forEach(([key, handler]) => on(key, handler))

  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = new URL(String(input), 'http://localhost')
    const path = url.pathname.replace(/^.*?\/api\/admin/, '') || '/'
    const method = (init.method || 'GET').toUpperCase()
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([key, value]) => [key.toLowerCase(), value]))

    let body = init.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        /* keep the raw string */
      }
    }
    const query = Object.fromEntries(url.searchParams.entries())
    const record = { method, path, query, body, headers, url: url.toString() }
    requests.push(record)

    const entry = table.find((item) => item.method === method && item.regex.test(path))
    if (!entry) {
      unmatched.push(record)
      return new Response(JSON.stringify({ message: `No mock for ${method} ${path}` }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const match = entry.regex.exec(path)
    const params = Object.fromEntries(entry.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]))
    const result = typeof entry.handler === 'function' ? await entry.handler({ ...record, params }) : entry.handler

    if (result && result.__reply && 'raw' in result) {
      return new Response(result.raw, { status: result.status, headers: { 'Content-Type': 'text/html; charset=UTF-8', ...result.headers } })
    }
    if (result && result.__reply) {
      const status = result.status
      const noBody = status === 204 || result.body === null
      return new Response(noBody ? null : JSON.stringify(result.body), { status, headers: { ...(noBody ? {} : { 'Content-Type': 'application/json' }), ...result.headers } })
    }
    if (result === null || result === undefined) return new Response(null, { status: 204 })
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    fetch: fetchMock,
    requests,
    unmatched,
    on,
    /** Recorded requests, optionally filtered: calls('POST', '/faqs') */
    calls: (method, path) => requests.filter((request) => (!method || request.method === method) && (!path || request.path === path)),
    reset: () => {
      requests.length = 0
      unmatched.length = 0
    },
  }
}
