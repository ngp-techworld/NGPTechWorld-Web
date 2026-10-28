import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SocialLinks from './SocialLinks'
import { LanguageProvider } from '../i18n/LanguageContext'
import { SiteSettingsProvider } from '../lib/SiteSettings'
import { api } from '../lib/api'
import { ui } from '../i18n/ui'

vi.mock('../lib/api', () => ({
  api: { getSettings: vi.fn(), getContent: vi.fn() },
}))

const t = ui.ar

// The settings provider caches its answer in localStorage, so without this each test would
// start with the networks the one before it set.
beforeEach(() => localStorage.clear())

function show(settings) {
  api.getSettings.mockResolvedValue(settings)
  api.getContent.mockResolvedValue(null)
  return render(
    <LanguageProvider>
      <SiteSettingsProvider>
        <SocialLinks />
      </SiteSettingsProvider>
    </LanguageProvider>,
  )
}

describe('the social buttons', () => {
  it('shows only the networks the dashboard filled in', async () => {
    show({ facebook: 'https://facebook.com/ngp', linkedin: 'https://linkedin.com/company/ngp' })

    expect(await screen.findByLabelText('Facebook')).toHaveAttribute('href', 'https://facebook.com/ngp')
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('WhatsApp')).not.toBeInTheDocument()
  })

  it('renders nothing when none are set, rather than an empty heading', () => {
    const { container } = show({})
    expect(container).toBeEmptyDOMElement()
  })

  it('names each button for a screen reader, since the mark carries no text', async () => {
    show({ whatsapp: 'https://wa.me/963900000000' })

    const link = await screen.findByLabelText('WhatsApp')
    expect(link).toHaveAttribute('title', 'WhatsApp')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('opens in a new tab without handing the target window a reference back', async () => {
    show({ x: 'https://x.com/ngp' })

    const link = await screen.findByLabelText('X')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('drops anything that is not a plain http link', async () => {
    // toHttpUrl refuses javascript: and data:, and a bare host too — the dashboard requires a
    // scheme on the way in, so a value without one is a broken row rather than a shorthand.
    show({ instagram: 'javascript:alert(1)', facebook: 'instagram.com/ngp', linkedin: 'https://linkedin.com/company/ngp' })

    expect(await screen.findByLabelText('LinkedIn')).toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Facebook')).not.toBeInTheDocument()
  })

  it('carries the heading in the reading language', async () => {
    show({ facebook: 'https://facebook.com/ngp' })
    expect(await screen.findByText(t.cFollow)).toBeInTheDocument()
  })
})
