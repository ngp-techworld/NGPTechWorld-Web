import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ltr, withLtr } from './bidi'

describe('bidi helpers', () => {
  it('isolates a left-to-right snippet in a plain string (LRI … PDI), invisibly', () => {
    expect(ltr('vault://')).toBe('\u2066vault://\u2069')
    expect(`مرجعه ${ltr('vault://')} فقط`).toContain('\u2066vault://\u2069')
  })

  it('fills a template with <bdi dir="ltr"> snippets for JSX', () => {
    render(<p data-testid="step">{withLtr('اسحب ({0}، أو {1}) هنا.', ['ngp-portfolio/', 'intake/<slug>/'], 'font-mono')}</p>)
    expect(screen.getByTestId('step')).toHaveTextContent('اسحب (ngp-portfolio/، أو intake/<slug>/) هنا.')
    const snippet = screen.getByText('ngp-portfolio/')
    expect(snippet.tagName).toBe('BDI')
    expect(snippet).toHaveAttribute('dir', 'ltr')
    expect(snippet).toHaveClass('font-mono')
  })
})
