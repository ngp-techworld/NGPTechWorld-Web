import { describe, expect, it, vi } from 'vitest'
import { installFakeXhr } from '@/test/fakeXhr'
import { mockApi, reply, replyText, validationError } from '@/test/mockApi'
import { ApiError, UNREADABLE_RESPONSE, api, buildQuery, isUnreadableResponse, saveBlob, setUnauthorizedHandler } from './api'
import { TOKEN_KEY } from './storage'

describe('buildQuery', () => {
  it('drops empty values, turns booleans into 1/0 and repeats arrays', () => {
    expect(buildQuery({ page: 2, search: '', sort: undefined, extra: null, is_active: true, off: false, ids: [1, 2] })).toBe('?page=2&is_active=1&off=0&ids%5B%5D=1&ids%5B%5D=2')
    expect(buildQuery({})).toBe('')
    expect(buildQuery(undefined)).toBe('')
  })
})

describe('api client', () => {
  it('calls /api/admin/<path> with JSON + bearer headers', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-123')
    const server = mockApi({ 'GET /faqs': { data: [], meta: {} } })

    await api.get('/faqs', { page: 2, search: 'x' })

    const [url, init] = server.fetch.mock.calls[0]
    expect(url).toBe('/api/admin/faqs?page=2&search=x')
    expect(init.method).toBe('GET')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.headers.Authorization).toBe('Bearer tok-123')
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('sends JSON bodies with a content type', async () => {
    const server = mockApi({ 'POST /faqs': ({ body }) => reply(201, { data: { id: 1, ...body } }) })

    const res = await api.post('/faqs', { question_en: 'Q' })

    expect(res).toEqual({ data: { id: 1, question_en: 'Q' } })
    expect(server.fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
    expect(server.calls('POST', '/faqs')[0].body).toEqual({ question_en: 'Q' })
  })

  it('does not add an Authorization header without a token or with auth:false', async () => {
    const server = mockApi({ 'POST /auth/login': { data: { token: 't' } } })
    localStorage.setItem(TOKEN_KEY, 'tok')

    await api.post('/auth/login', { email: 'a' }, { auth: false })
    expect(server.requests[0].headers.authorization).toBeUndefined()

    localStorage.clear()
    await api.post('/auth/login', { email: 'a' })
    expect(server.requests[1].headers.authorization).toBeUndefined()
  })

  it('honours VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/')
    const server = mockApi({ 'GET /faqs': { data: [] } })

    await api.get('/faqs')

    expect(server.fetch.mock.calls[0][0]).toBe('https://api.example.com/api/admin/faqs')
  })

  it('returns null for 204 responses', async () => {
    mockApi({ 'DELETE /faqs/:id': () => null })
    await expect(api.delete('/faqs/3')).resolves.toBeNull()
  })

  it('normalises Laravel 422 errors into an ApiError', async () => {
    mockApi({ 'POST /faqs': () => validationError({ question_ar: ['required'] }, 'The question ar field is required.') })

    const error = await api.post('/faqs', {}).catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, message: 'The question ar field is required.', errors: { question_ar: ['required'] } })
  })

  it('gives every failure a message and an errors object, and exposes Retry-After', async () => {
    mockApi({
      'GET /a': () => reply(404, null),
      'GET /b': () => reply(500, { message: 'Server Error' }),
      'POST /auth/login': () => reply(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '42' }),
    })

    await expect(api.get('/a')).rejects.toMatchObject({ status: 404, message: 'Not found.', errors: {} })
    await expect(api.get('/b')).rejects.toMatchObject({ status: 500, message: 'Server Error' })
    await expect(api.post('/auth/login', {}, { auth: false })).rejects.toMatchObject({ status: 429, retryAfter: 42 })
  })

  describe('a 2xx answer whose body is not JSON', () => {
    // what the demo's PHP sent for every multipart request: a notice printed in front of the JSON
    const NOTICE = `<br />\n<b>Notice</b>:  PHP Request Startup: file created in the system's temporary directory<br />\n{"data":{"id":9}}`

    it('rejects with an ApiError the caller can recognise, and warns in the console', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockApi({ 'POST /registry/projects/:id/screenshots': () => replyText(201, NOTICE) })

      const error = await api.post('/registry/projects/7/screenshots', new FormData()).catch((err) => err)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 201, code: UNREADABLE_RESPONSE, method: 'POST', errors: {} })
      expect(isUnreadableResponse(error)).toBe(true)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('POST /registry/projects/7/screenshots answered 201'), expect.stringContaining('Notice'))
    })

    it('does the same through XMLHttpRequest (uploads with progress)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockApi({ 'POST /registry/imports': () => replyText(201, NOTICE) })
      installFakeXhr()

      await expect(api.post('/registry/imports', new FormData(), { onUploadProgress: () => {} })).rejects.toMatchObject({ code: UNREADABLE_RESPONSE, status: 201 })
    })

    it('still resolves null for an empty 2xx body, and leaves error answers as they were', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockApi({ 'POST /a': () => replyText(200, ''), 'GET /b': () => replyText(500, '<html>Server Error</html>') })

      await expect(api.post('/a')).resolves.toBeNull()
      const error = await api.get('/b').catch((err) => err)
      expect(error).toMatchObject({ status: 500, code: null })
      expect(isUnreadableResponse(error)).toBe(false)
    })
  })

  it('turns a network failure into ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.get('/faqs')).rejects.toMatchObject({ name: 'ApiError', status: 0 })
  })

  it('on 401 clears the token and calls the unauthorized handler', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockApi({ 'GET /faqs': () => reply(401, { message: 'Unauthenticated.' }) })

    await expect(api.get('/faqs')).rejects.toMatchObject({ status: 401 })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('a 401 on an auth:false call (login) does not log anybody out', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockApi({ 'POST /auth/login': () => reply(401, { message: 'nope' }) })

    await expect(api.post('/auth/login', {}, { auth: false })).rejects.toMatchObject({ status: 401 })

    expect(handler).not.toHaveBeenCalled()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok')
  })

  it('403 does not log out', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockApi({ 'GET /faqs': () => reply(403, { message: 'Forbidden' }) })

    await expect(api.get('/faqs')).rejects.toMatchObject({ status: 403 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('setUnauthorizedHandler returns an unsubscribe function', async () => {
    const handler = vi.fn()
    const off = setUnauthorizedHandler(handler)
    off()
    mockApi({ 'GET /faqs': () => reply(401, {}) })
    const assign = vi.fn()
    vi.stubGlobal('location', { pathname: '/login', assign })

    await api.get('/faqs').catch(() => {})

    expect(handler).not.toHaveBeenCalled()
  })

  describe('upload', () => {
    it('posts multipart form data (file + folder) and resolves { path, url }', async () => {
      localStorage.setItem(TOKEN_KEY, 'tok')
      const server = mockApi({ 'POST /uploads': () => reply(201, { data: { path: 'partners/a.png', url: 'http://x/media/partners/a.png' } }) })
      const file = new File(['img'], 'a.png', { type: 'image/png' })

      const result = await api.upload(file, 'partners')

      expect(result).toEqual({ path: 'partners/a.png', url: 'http://x/media/partners/a.png' })
      const [url, init] = server.fetch.mock.calls[0]
      expect(url).toBe('/api/admin/uploads')
      expect(init.body).toBeInstanceOf(FormData)
      expect(init.body.get('folder')).toBe('partners')
      expect(init.body.get('file')).toBeInstanceOf(File)
      expect(init.headers['Content-Type']).toBeUndefined() // the browser adds the multipart boundary
      expect(init.headers.Authorization).toBe('Bearer tok')
    })

    it('surfaces upload validation errors', async () => {
      mockApi({ 'POST /uploads': () => validationError({ file: ['The file must be an image.'] }) })
      const error = await api.upload(new File(['x'], 'a.txt'), 'misc').catch((err) => err)
      expect(error.errors.file[0]).toBe('The file must be an image.')
    })

    it('deleteUpload sends the path as JSON', async () => {
      const server = mockApi({ 'DELETE /uploads': () => null })
      await api.deleteUpload('partners/a.png')
      expect(server.calls('DELETE', '/uploads')[0].body).toEqual({ path: 'partners/a.png' })
    })
  })

  describe('onUploadProgress', () => {
    it('sends the request through XMLHttpRequest with the same headers and reports the bytes sent', async () => {
      localStorage.setItem(TOKEN_KEY, 'tok')
      const server = mockApi({ 'POST /registry/imports': () => reply(201, { data: { id: 'b1' } }) })
      const xhr = installFakeXhr({ progress: [0.25, 1] })
      const body = new FormData()
      body.append('file', new File(['z'.repeat(100)], 'dawri.zip', { type: 'application/zip' }))
      const onUploadProgress = vi.fn()

      const result = await api.post('/registry/imports', body, { onUploadProgress })

      expect(result).toEqual({ data: { id: 'b1' } })
      expect(onUploadProgress.mock.calls.map(([event]) => event.loaded / event.total)).toEqual([0.25, 1])
      expect(xhr.instances[0].requestHeaders).toEqual({ Accept: 'application/json', Authorization: 'Bearer tok' })
      expect(server.calls('POST', '/registry/imports')[0].body.get('file').name).toBe('dawri.zip')
    })

    it('throws the same ApiError as fetch, 401 handling included', async () => {
      localStorage.setItem(TOKEN_KEY, 'tok')
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      mockApi({
        'POST /a': () => reply(422, { message: 'Bad package', code: 'E_SCHEMA', problems: [] }),
        'POST /b': () => reply(401, { message: 'Unauthenticated.' }),
      })
      installFakeXhr()

      await expect(api.post('/a', new FormData(), { onUploadProgress: () => {} })).rejects.toMatchObject({ status: 422, message: 'Bad package', data: { code: 'E_SCHEMA' } })
      await expect(api.post('/b', new FormData(), { onUploadProgress: () => {} })).rejects.toMatchObject({ status: 401 })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('rejects with an AbortError when the signal aborts', async () => {
      mockApi({ 'POST /a': () => ({ data: {} }) })
      installFakeXhr({ hold: true })
      const controller = new AbortController()
      const pending = api.post('/a', new FormData(), { onUploadProgress: () => {}, signal: controller.signal })
      controller.abort()
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })
  })

  describe('download', () => {
    it('resolves the blob and the filename of a Content-Disposition header', async () => {
      const server = mockApi({
        'GET /requests/export': () => reply(200, null, {}),
      })
      server.fetch.mockResolvedValueOnce(new Response('a,b', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="requests.csv"' } }))

      const result = await api.download('/requests/export', { status: 'new' })

      expect(result.filename).toBe('requests.csv')
      expect(result.contentType).toBe('text/csv')
      expect(await result.blob.text()).toBe('a,b')
    })

    it('saveBlob clicks a temporary link', () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      saveBlob(new Blob(['x']), 'x.csv')
      expect(click).toHaveBeenCalledTimes(1)
    })
  })
})
