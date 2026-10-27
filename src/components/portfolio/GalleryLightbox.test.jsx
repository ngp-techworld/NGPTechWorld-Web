import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { useState } from 'react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import GalleryLightbox from './GalleryLightbox'

const items = [
  { src: 'https://x.test/1.png', srcSet: 'https://x.test/1-480.webp 480w, https://x.test/1-960.webp 960w', title: 'Dashboard', description: 'Orders at a glance' },
  { src: 'https://x.test/2.png', srcSet: null, title: 'Checkout', description: '' },
  { src: 'https://x.test/3.png', srcSet: null, title: '', description: '' },
]

/** An opener button and the lightbox, the way the gallery uses them. */
function Harness({ start = 0 }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open gallery</button>
      {open && <GalleryLightbox items={items} startIndex={start} label="Screenshots" onClose={() => setOpen(false)} />}
    </>
  )
}

function renderIn(lang, start) {
  localStorage.setItem('ngp.lang', lang)
  const result = render(<LanguageProvider><Harness start={start} /></LanguageProvider>)
  const opener = screen.getByRole('button', { name: 'open gallery' })
  opener.focus()
  fireEvent.click(opener)
  return { ...result, opener, t: ui[lang] }
}

const key = (k, extra = {}) => fireEvent.keyDown(document.activeElement || document.body, { key: k, ...extra })
const counter = () => screen.getByTestId('pf-counter').textContent

afterEach(() => localStorage.clear())

describe('the gallery lightbox', () => {
  test('opens as a modal dialog on the chosen screenshot, with its caption and srcset', () => {
    const { t } = renderIn('en', 0)
    const dialog = screen.getByRole('dialog', { name: 'Screenshots' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(counter()).toBe(t.pfCounter(1, 3))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Orders at a glance')).toBeInTheDocument()
    const img = screen.getByRole('img', { name: 'Dashboard' })
    expect(img).toHaveAttribute('src', 'https://x.test/1.png')
    expect(img).toHaveAttribute('srcset', items[0].srcSet)
    expect(img).toHaveAttribute('sizes', '100vw')
  })

  test('in a left-to-right language, → is next and ← is previous, wrapping at the ends', () => {
    const { t } = renderIn('en', 0)
    key('ArrowRight')
    expect(counter()).toBe(t.pfCounter(2, 3))
    key('ArrowLeft')
    expect(counter()).toBe(t.pfCounter(1, 3))
    key('ArrowLeft')
    expect(counter()).toBe(t.pfCounter(3, 3))
  })

  test('in Arabic, ← is next and → is previous', () => {
    const { t } = renderIn('ar', 0)
    key('ArrowLeft')
    expect(counter()).toBe(t.pfCounter(2, 3))
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    key('ArrowRight')
    expect(counter()).toBe(t.pfCounter(1, 3))
  })

  test('the next and previous buttons step through the screenshots', () => {
    const { t } = renderIn('en', 1)
    fireEvent.click(screen.getByRole('button', { name: t.pfNext }))
    expect(counter()).toBe(t.pfCounter(3, 3))
    fireEvent.click(screen.getByRole('button', { name: t.pfPrev }))
    expect(counter()).toBe(t.pfCounter(2, 3))
  })

  test('a swipe follows the reading direction', () => {
    const { t, unmount } = renderIn('en', 0)
    const stage = screen.getByTestId('pf-stage')
    fireEvent.touchStart(stage, { touches: [{ clientX: 300, clientY: 200 }] })
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 120, clientY: 210 }] }) // finger moves left
    expect(counter()).toBe(t.pfCounter(2, 3))
    unmount()
    localStorage.clear()

    const ar = renderIn('ar', 0)
    const arStage = screen.getByTestId('pf-stage')
    fireEvent.touchStart(arStage, { touches: [{ clientX: 300, clientY: 200 }] })
    fireEvent.touchEnd(arStage, { changedTouches: [{ clientX: 120, clientY: 210 }] }) // same gesture, RTL: previous
    expect(counter()).toBe(ar.t.pfCounter(3, 3))
  })

  test('ignores a mostly vertical swipe, which is a scroll', () => {
    const { t } = renderIn('en', 0)
    const stage = screen.getByTestId('pf-stage')
    fireEvent.touchStart(stage, { touches: [{ clientX: 300, clientY: 100 }] })
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 240, clientY: 400 }] })
    expect(counter()).toBe(t.pfCounter(1, 3))
  })

  test('Escape closes it and gives focus back to the button that opened it', () => {
    const { opener } = renderIn('en', 0)
    expect(document.activeElement).not.toBe(opener) // focus moved into the dialog

    key('Escape')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  test('the close button closes it too', () => {
    const { t, opener } = renderIn('en', 0)
    fireEvent.click(screen.getByRole('button', { name: t.oClose }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  test('keeps keyboard focus inside the dialog', () => {
    const { t } = renderIn('en', 0)
    const close = screen.getByRole('button', { name: t.oClose })
    const next = screen.getByRole('button', { name: t.pfNext })
    expect(document.activeElement).toBe(close)

    next.focus()
    key('Tab') // past the last control: back to the first
    expect(document.activeElement).toBe(close)

    key('Tab', { shiftKey: true }) // before the first: round to the last
    expect(document.activeElement).toBe(next)
  })

  test('stops the page behind it from scrolling, and lets it scroll again on close', () => {
    renderIn('en', 0)
    expect(document.body.style.overflow).toBe('hidden')
    key('Escape')
    expect(document.body.style.overflow).toBe('')
  })

  test('shows no arrows or counter steps for a single screenshot', () => {
    localStorage.setItem('ngp.lang', 'en')
    render(<LanguageProvider><GalleryLightbox items={[items[0]]} startIndex={0} label="Screenshots" onClose={() => {}} /></LanguageProvider>)
    expect(screen.queryByRole('button', { name: ui.en.pfNext })).toBeNull()
    key('ArrowRight')
    expect(counter()).toBe(ui.en.pfCounter(1, 1))
  })
})

describe('fitting the picture (QA I1)', () => {
  const render1 = (item) => {
    localStorage.setItem('ngp.lang', 'en')
    return render(<LanguageProvider><GalleryLightbox items={[item]} startIndex={0} label="Screenshots" onClose={() => {}} /></LanguageProvider>)
  }

  test('never draws a screenshot beyond its own size, and offers the original as the sharpest candidate', () => {
    render1({ src: 'https://x.test/tall.png', srcSet: 'https://x.test/tall-480.webp 480w', width: 780, height: 1688, title: 'Tall' })
    const img = screen.getByRole('img', { name: 'Tall' })
    expect(img.style.maxWidth).toBe('min(100%, 780px)')
    expect(img.style.maxHeight).toBe('min(100%, 1688px)')
    expect(img).toHaveAttribute('srcset', 'https://x.test/tall-480.webp 480w, https://x.test/tall.png 780w')
  })

  test('caps by the largest variant when the original size is unknown', () => {
    render1({ src: 'https://x.test/a.png', srcSet: 'https://x.test/a-480.webp 480w, https://x.test/a-960.webp 960w', title: 'A' })
    const img = screen.getByRole('img', { name: 'A' })
    expect(img.style.maxWidth).toBe('min(100%, 960px)')
    expect(img).toHaveAttribute('srcset', 'https://x.test/a-480.webp 480w, https://x.test/a-960.webp 960w')
  })

  test('a click on the dark area around the picture still closes it', () => {
    localStorage.setItem('ngp.lang', 'en')
    const onClose = vi.fn()
    render(<LanguageProvider><GalleryLightbox items={items} startIndex={0} label="Screenshots" onClose={onClose} /></LanguageProvider>)
    fireEvent.click(screen.getByTestId('pf-frame'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('img', { name: 'Dashboard' })) // the picture itself does not close it
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
