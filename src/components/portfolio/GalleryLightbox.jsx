import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../i18n/LanguageContext'
import { Chevron, CloseIcon } from './icons'

const SWIPE_MIN = 50 // px of horizontal travel before a touch counts as a swipe

/** The widest `NNNw` candidate in a srcset, or 0. */
const widestVariant = (srcSet) => Math.max(0, ...String(srcSet ?? '').split(',')
  .map((part) => Number.parseInt((part.trim().match(/\s(\d+)w$/) ?? [])[1], 10))
  .filter(Number.isFinite))

/**
 * The srcset, plus the original file at its own width when the API gave one. The variants stop
 * below the original (the backend never upscales), so without it a large screen could only pick
 * a 480px variant and blow it up.
 */
function withOriginal(item) {
  if (!item.srcSet) return null
  if (!item.width || item.srcSet.includes(`${item.src} `)) return item.srcSet
  return `${item.srcSet}, ${item.src} ${item.width}w`
}

/**
 * The most the picture may be drawn at: the frame (100%), and never more than its own pixels —
 * the original's size when known, else the widest variant. With a srcset the browser's idea of the
 * image's size comes from `sizes` (100vw), not from the file, so this cap is what keeps a small
 * screenshot from being stretched.
 */
function sizeCap(item) {
  const width = item.width || widestVariant(item.srcSet) || null
  const height = item.width && item.height ? item.height : null
  return {
    maxWidth: width ? `min(100%, ${width}px)` : '100%',
    maxHeight: height ? `min(100%, ${height}px)` : '100%',
  }
}
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Full-screen viewer for a project's screenshots.
 *
 * - Arrow keys follow the reading direction: in Arabic the next screenshot is to the left, so
 *   ArrowLeft is "next" there, and the swipe that means "next" is reversed to match.
 * - Escape and the close button close it; focus then goes back to whatever opened it.
 * - Tab is held inside the dialog while it is open, and the page behind it does not scroll.
 *
 * Portalled to <body> so no ancestor's transform or stacking context can trap it under the navbar.
 * The site's other Lightbox (offers, the old portfolio modal) is left as it was.
 *
 * `items`: [{ src, srcSet?, title?, description? }]
 */
export default function GalleryLightbox({ items, startIndex = 0, label, onClose }) {
  const { t, dir } = useLang()
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), items.length - 1))
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const frameRef = useRef(null)
  const touch = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  const count = items.length
  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count])

  // Focus in on open, back out on close; the page behind stays put while it is open.
  useEffect(() => {
    const returnTo = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus()
    }
  }, [])

  useEffect(() => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return }
      if (e.key === forward && count > 1) { e.preventDefault(); go(1); return }
      if (e.key === backward && count > 1) { e.preventDefault(); go(-1); return }
      if (e.key === 'Tab') {
        const nodes = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
        if (nodes.length === 0) { e.preventDefault(); return }
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const inside = dialogRef.current.contains(document.activeElement)
        if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dir, count, go])

  const onTouchStart = (e) => {
    const p = e.touches?.[0]
    touch.current = p ? { x: p.clientX, y: p.clientY } : null
  }
  const onTouchEnd = (e) => {
    const start = touch.current
    const p = e.changedTouches?.[0]
    touch.current = null
    if (!start || !p || count < 2) return
    const dx = p.clientX - start.x
    const dy = p.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return
    // Dragging the picture towards the reading direction's start reveals the next one.
    const towardsStart = dir === 'rtl' ? dx > 0 : dx < 0
    go(towardsStart ? 1 : -1)
  }

  const item = items[index]
  const alt = item.title || `${label} ${index + 1}`
  const candidates = withOriginal(item)

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={label} className="pf-lightbox" dir={dir}>
      <div className="pf-lightbox__bar">
        <span data-testid="pf-counter" className="pf-lightbox__counter" aria-live="polite">{t.pfCounter(index + 1, count)}</span>
        <button ref={closeRef} type="button" className="pf-lightbox__icon" onClick={() => onCloseRef.current()} aria-label={t.oClose}>
          <CloseIcon size={20} />
        </button>
      </div>

      <div
        data-testid="pf-stage"
        className="pf-lightbox__stage"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        // A click on the dark area around the picture closes it, as on the site's other viewer.
        onClick={(e) => { if (e.target === e.currentTarget || e.target === frameRef.current) onCloseRef.current() }}
      >
        {count > 1 && (
          <button type="button" className="pf-lightbox__icon pf-lightbox__nav pf-lightbox__nav--prev" onClick={() => go(-1)} aria-label={t.pfPrev}>
            <Chevron back size={22} />
          </button>
        )}
        {/* The box the picture is fitted into: everything between the bar and the caption, minus the
            room the arrows need. See .pf-lightbox__frame. */}
        <div ref={frameRef} data-testid="pf-frame" className="pf-lightbox__frame">
          <img
            key={index}
            src={item.src}
            srcSet={candidates || undefined}
            sizes={candidates ? '100vw' : undefined}
            alt={alt}
            className="pf-lightbox__img"
            style={sizeCap(item)}
            decoding="async"
          />
        </div>
        {count > 1 && (
          <button type="button" className="pf-lightbox__icon pf-lightbox__nav pf-lightbox__nav--next" onClick={() => go(1)} aria-label={t.pfNext}>
            <Chevron size={22} />
          </button>
        )}
      </div>

      <div className="pf-lightbox__caption">
        {item.title && <p className="pf-lightbox__title">{item.title}</p>}
        {item.description && <p className="pf-lightbox__desc">{item.description}</p>}
      </div>
    </div>,
    document.body,
  )
}
