import { vi } from 'vitest'

const sizeOf = (body) => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return [...body.values()].reduce((sum, value) => sum + (typeof value === 'string' ? value.length : value.size ?? 0), 0) || 1
  }
  return typeof body === 'string' ? body.length || 1 : 1
}

/**
 * Replaces XMLHttpRequest (used by `api` when a request passes `onUploadProgress`) with a fake that reports upload
 * progress and then hands the request to `fetch` — so `mockApi()` answers it, records it and its handlers apply.
 *
 *   const server = mockApi({ 'POST /registry/imports': () => reply(201, { data: batch }) })
 *   const xhr = installFakeXhr({ progress: [0.4], hold: true })   // stops after 40 % until xhr.release()
 *   … expect(progressbar).toHaveAttribute('aria-valuenow', '40'); xhr.release()
 *
 * `progress`: the ratios reported, in order (default [0.5, 1]). `hold`: wait for `release()` before answering.
 */
export function installFakeXhr({ progress = [0.5, 1], hold = false } = {}) {
  const instances = []
  let release = () => {}
  const gate = hold ? new Promise((resolve) => (release = resolve)) : null

  class FakeXMLHttpRequest {
    constructor() {
      this.upload = { onprogress: null }
      this.requestHeaders = {}
      this.status = 0
      this.statusText = ''
      this.responseText = ''
      this.responseHeaders = ''
      this.aborted = false
      instances.push(this)
    }

    open(method, url) {
      this.method = method
      this.url = url
    }

    setRequestHeader(name, value) {
      this.requestHeaders[name] = value
    }

    getAllResponseHeaders() {
      return this.responseHeaders
    }

    abort() {
      if (this.aborted) return
      this.aborted = true
      this.onabort?.()
    }

    async send(body) {
      this.body = body
      const total = sizeOf(body)
      for (const ratio of progress) {
        await Promise.resolve()
        if (this.aborted) return
        this.upload.onprogress?.({ loaded: Math.round(total * ratio), total, lengthComputable: true })
      }
      if (gate) await gate
      if (this.aborted) return
      try {
        const res = await globalThis.fetch(this.url, { method: this.method, headers: this.requestHeaders, body })
        this.status = res.status
        this.statusText = res.statusText
        this.responseText = await res.text()
        this.responseHeaders = [...res.headers.entries()].map(([name, value]) => `${name}: ${value}`).join('\r\n')
        this.onload?.()
      } catch {
        this.onerror?.()
      }
    }
  }

  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
  return { instances, release: () => release() }
}
