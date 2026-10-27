import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read from disk: Vitest does not process CSS, so an import would not hand over the source (and
// under jsdom import.meta.url is not a file URL). Tests run from the project root.
const css = readFileSync(resolve(process.cwd(), 'src/styles/portfolio.css'), 'utf8')

/**
 * jsdom does no layout, so this guards the rules that keep long content inside a phone screen.
 *
 * The bug it pins: below the first breakpoint a grid with no `grid-template-columns` gets one
 * implicit `auto` column, which grows to the content's min-content width. A technology called
 * `Microsoft.AspNetCore.Authentication.JwtBearer`, or an unspaced name, then made a card 388px wide
 * in a 338px column — clipped, unseen, by App.jsx's `overflow-x: hidden`.
 */

/** [selector, declarations] for every rule outside @media / @keyframes, one entry per selector. */
function topLevelRules(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open === -1) break
    const selector = text.slice(i, open).trim()
    let depth = 1
    let j = open + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1
      else if (text[j] === '}') depth -= 1
      j += 1
    }
    if (!selector.startsWith('@')) {
      for (const s of selector.split(',')) rules.push([s.trim(), text.slice(open + 1, j - 1)])
    }
    i = j
  }
  return rules
}

const RULES = topLevelRules(css)
const declarationsOf = (selector) =>
  RULES.filter(([s]) => s === selector).map(([, body]) => body).join(';').replace(/\s+/g, ' ')

describe('portfolio.css keeps long content inside narrow screens', () => {
  it.each([
    '.pf-grid', '.pf-overview', '.pf-ps', '.pf-group', '.pf-two', '.pf-stack__row', '.pf-features', '.pf-modules',
  ])('%s has a base column that can shrink below its content (minmax(0, 1fr))', (selector) => {
    expect(declarationsOf(selector)).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  it('cuts a technology chip with an ellipsis rather than letting it widen the card', () => {
    const chip = declarationsOf('.pf-chip')
    expect(chip).toMatch(/max-width:\s*100%/)
    expect(chip).toMatch(/overflow:\s*hidden/)
    expect(chip).toMatch(/text-overflow:\s*ellipsis/)
    expect(chip).toMatch(/display:\s*inline-block/) // text-overflow needs a block container
  })

  it('wraps a section heading and its controls instead of squeezing them', () => {
    expect(declarationsOf('.pf-section__head')).toMatch(/flex-wrap:\s*wrap/)
    expect(declarationsOf('.pf-switch button')).toMatch(/white-space:\s*nowrap/)
  })

  it('lets a phone pinch-zoom a screenshot in the lightbox', () => {
    expect(declarationsOf('.pf-lightbox__stage')).toMatch(/touch-action:\s*pan-y pinch-zoom/)
  })

  it('lays the spec rail out with logical padding, without a right-to-left copy of it', () => {
    expect(declarationsOf('.pf-spec__cell')).not.toMatch(/padding:\s*\S+ \S+ \S+ \S+/)
    expect(RULES.some(([s]) => s.includes("[dir='rtl'] .pf-spec__cell"))).toBe(false)
  })

  it.each([
    '.pf-hero__title', '.pf-card__title', '.pf-card__short', '.pf-card__highlight', '.pf-feature-card__name',
    '.pf-detail-hero__title', '.pf-detail-hero__lead', '.pf-prose', '.pf-ps__text', '.pf-feature__name',
    '.pf-feature__desc', '.pf-module__name', '.pf-module__desc', '.pf-group__name', '.pf-quality__title',
    '.pf-quality__desc', '.pf-ticks li', '.pf-aside__text', '.pf-band__title', '.pf-band__sub',
    '.pf-lightbox__title', '.pf-lightbox__desc', '.pf-shot__caption',
  ])('%s may break an unspaced word anywhere', (selector) => {
    expect(declarationsOf(selector)).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('the lightbox fits its picture between the bar and the caption (QA I1)', () => {
  it('stacks bar, stage and caption in a column whose middle can shrink', () => {
    expect(declarationsOf('.pf-lightbox')).toMatch(/display:\s*flex/)
    expect(declarationsOf('.pf-lightbox')).toMatch(/flex-direction:\s*column/)
    expect(declarationsOf('.pf-lightbox__stage')).toMatch(/min-height:\s*0/)
    expect(declarationsOf('.pf-lightbox__stage')).toMatch(/flex:\s*1 1 auto/)
    expect(declarationsOf('.pf-lightbox__frame')).toMatch(/min-height:\s*0/)
  })

  it('sizes the picture against a definite box, never past it', () => {
    const img = declarationsOf('.pf-lightbox__img')
    expect(img).toMatch(/position:\s*absolute/)
    expect(img).toMatch(/max-width:\s*100%/)
    expect(img).toMatch(/max-height:\s*100%/)
    expect(img).toMatch(/object-fit:\s*contain/)
  })

  it('keeps the arrows above the picture', () => {
    expect(declarationsOf('.pf-lightbox__nav')).toMatch(/z-index:\s*[1-9]/)
  })
})
