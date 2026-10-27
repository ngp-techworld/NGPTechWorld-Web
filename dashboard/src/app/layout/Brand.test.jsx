import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Brand } from './Brand'

describe('Brand', () => {
  it('loads the logo under the deploy prefix, not from the site root', () => {
    vi.stubEnv('BASE_URL', '/ngp-hq/') // vite.config.js `base` (vitest itself serves from '/')
    render(<Brand />)
    expect(screen.getByRole('img', { name: 'NGP TechWorld' })).toHaveAttribute('src', '/ngp-hq/assets/ngp-logo-white.png')
  })
})
