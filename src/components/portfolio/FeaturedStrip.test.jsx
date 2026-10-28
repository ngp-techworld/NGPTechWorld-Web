import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import FeaturedStrip from './FeaturedStrip'

const t = ui.ar
const project = (slug) => ({ id: slug, slug, category: 'web', name_ar: `مشروع ${slug}`, name_en: slug, short_ar: '', short_en: '', cover_image: null })

// jsdom does no layout: stand in for the track's widths, as a browser would report them.
const original = {
  scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth'),
}
let trackWidths = { scroll: 0, client: 0 }
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get() { return this.classList.contains('pf-strip__track') ? trackWidths.scroll : 0 } })
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get() { return this.classList.contains('pf-strip__track') ? trackWidths.client : 0 } })
})
afterAll(() => {
  Object.defineProperty(Element.prototype, 'scrollWidth', original.scrollWidth)
  Object.defineProperty(Element.prototype, 'clientWidth', original.clientWidth)
})
beforeEach(() => localStorage.clear())

const renderStrip = (projects) =>
  render(<LanguageProvider><MemoryRouter><FeaturedStrip projects={projects} /></MemoryRouter></LanguageProvider>)

test('shows no arrows when every featured project already fits (QA X1)', () => {
  trackWidths = { scroll: 1148, client: 1148 }
  renderStrip([project('a'), project('b')])
  expect(screen.queryByRole('button', { name: t.pfNext })).toBeNull()
  expect(screen.queryByRole('button', { name: t.pfPrev })).toBeNull()
})

test('shows the arrows when the strip scrolls, and follows the window as it is resized', () => {
  trackWidths = { scroll: 1400, client: 360 }
  renderStrip([project('a'), project('b'), project('c')])
  expect(screen.getByRole('button', { name: t.pfNext })).toBeInTheDocument()

  trackWidths = { scroll: 1148, client: 1148 } // the window grew: everything fits now
  act(() => { window.dispatchEvent(new Event('resize')) })
  expect(screen.queryByRole('button', { name: t.pfNext })).toBeNull()

  trackWidths = { scroll: 1400, client: 360 } // and shrank again
  act(() => { window.dispatchEvent(new Event('resize')) })
  expect(screen.getByRole('button', { name: t.pfPrev })).toBeInTheDocument()
})
