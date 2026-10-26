import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import common from '@/i18n/common'
import { ApiError } from '@/lib/api'
import { setToken } from '@/lib/storage'
import { mockApi, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AuthImage, apiPathOf } from './AuthImage'
import { actionErrorText, localizeErrors, publicationLabels } from './serverErrors'
import strings from './strings'

const c = common.en
const r = strings.en
const unprocessable = (errors) => new ApiError({ status: 422, message: 'The given data was invalid.', errors })

describe('server errors', () => {
  it('replaces the vault guard message and leaves other messages alone', () => {
    const err = localizeErrors(
      unprocessable({ notes: ['The notes looks like it contains a password, key or token. Store it in the vault and record its vault:// reference instead.'], key: ['Taken.'] }),
      r,
    )
    expect(err.errors.notes).toEqual([r.secretDetected])
    expect(err.errors.key).toEqual(['Taken.'])
    expect(err.status).toBe(422)
  })

  it('gives publication keys their human labels', () => {
    expect(publicationLabels(['name_en', 'cover'], r)).toEqual(['English name', 'A cover image or at least one public screenshot'])
  })

  it('explains the "last public image" refusal and catalog guards in words', () => {
    expect(actionErrorText(unprocessable({ publication: ['cover'] }), r, c)).toBe(r.lastPublicImage)
    expect(actionErrorText(unprocessable({ industry: ['A project still uses this industry.'] }), r, c)).toBe(r.industryInUse)
    expect(actionErrorText(new ApiError({ status: 403 }), r, c)).toBe(c.forbidden)
  })
})

describe('AuthImage', () => {
  it('knows an authorized stream from a public URL', () => {
    expect(apiPathOf('http://localhost:8000/api/admin/registry/files/screenshots/5?w=480')).toBe('/registry/files/screenshots/5?w=480')
    expect(apiPathOf('http://localhost:8000/media/projects/screenshots/a.webp')).toBeNull()
  })

  it('fetches a private screenshot with the bearer token and shows it from an object URL', async () => {
    setToken('secret-token')
    const api = mockApi({ 'GET /registry/files/screenshots/:id': () => reply(200, { fake: 'image' }) })
    renderWithProviders(<AuthImage src="http://localhost/api/admin/registry/files/screenshots/5?w=480" alt="Login page" />)

    expect(await screen.findByRole('img', { name: 'Login page' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
    await waitFor(() => expect(api.calls('GET', '/registry/files/screenshots/5')).toHaveLength(1))
    expect(api.calls('GET', '/registry/files/screenshots/5')[0].headers.authorization).toBe('Bearer secret-token')
    expect(api.calls('GET', '/registry/files/screenshots/5')[0].query).toEqual({ w: '480' })
  })

  it('uses a public URL directly', () => {
    const api = mockApi({})
    renderWithProviders(<AuthImage src="http://localhost/media/projects/screenshots/a.webp" alt="Home" />)
    expect(screen.getByRole('img', { name: 'Home' })).toHaveAttribute('src', 'http://localhost/media/projects/screenshots/a.webp')
    expect(api.requests).toHaveLength(0)
  })
})
