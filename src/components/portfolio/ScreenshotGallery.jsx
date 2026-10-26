import { useState } from 'react'
import { useLang } from '../../i18n/LanguageContext'
import SmartImage from '../fx/SmartImage'
import GalleryLightbox from './GalleryLightbox'
import PfSection from './PfSection'
import { DesktopIcon, MobileIcon } from './icons'

// A phone-shaped capture is laid out as a phone; desktop and tablet share the wide grid.
const MOBILE_PLATFORMS = new Set(['mobile', 'mobile-web'])

// What each thumbnail is drawn at, so the browser picks the smallest variant that is sharp enough.
const SIZES = {
  desktop: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px',
  mobile: '(max-width: 640px) 46vw, 200px',
}

/**
 * The public screenshots, as a grid of thumbnails that open the lightbox.
 *
 * Reads `screenshots[]` (with srcset variants and captions); a project that has none yet but still
 * carries the legacy `gallery[]` of plain URLs gets those, as desktop shots without captions.
 */
function readShots(project, pick) {
  const shots = (project.screenshots ?? [])
    .filter((s) => s && s.url)
    .map((s) => ({
      src: s.url,
      srcSet: s.srcset || null,
      title: pick(s, 'title') || '',
      description: pick(s, 'description') || '',
      view: MOBILE_PLATFORMS.has(s.platform) ? 'mobile' : 'desktop',
    }))
  if (shots.length > 0) return shots
  return (project.gallery ?? []).filter(Boolean).map((src) => ({ src, srcSet: null, title: '', description: '', view: 'desktop' }))
}

export default function ScreenshotGallery({ project }) {
  const { t, pick } = useLang()
  const shots = readShots(project, pick)
  const desktop = shots.filter((s) => s.view === 'desktop')
  const mobile = shots.filter((s) => s.view === 'mobile')
  const [view, setView] = useState(desktop.length > 0 ? 'desktop' : 'mobile')
  const [open, setOpen] = useState(null)

  if (shots.length === 0) return null

  const both = desktop.length > 0 && mobile.length > 0
  const list = view === 'mobile' ? mobile : desktop

  const switcher = both && (
    <div role="group" aria-label={t.pfScreenSize} className="pf-switch">
      <button type="button" aria-pressed={view === 'desktop'} onClick={() => setView('desktop')}>
        <DesktopIcon />{t.pfDesktop}
      </button>
      <button type="button" aria-pressed={view === 'mobile'} onClick={() => setView('mobile')}>
        <MobileIcon />{t.pfMobile}
      </button>
    </div>
  )

  return (
    <PfSection title={t.dGallery} count={shots.length} action={switcher}>
      <ul className={`pf-shots pf-shots--${view}`}>
        {list.map((shot, i) => (
          <li key={`${view}-${i}`}>
            <button type="button" className="pf-shot" onClick={() => setOpen(i)} aria-label={shot.title || t.pfOpenShot(i + 1)}>
              <span className="pf-shot__frame block">
                <SmartImage src={shot.src} srcSet={shot.srcSet} sizes={SIZES[view]} className="absolute inset-0" />
              </span>
              {shot.title && <span className="pf-shot__caption">{shot.title}</span>}
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <GalleryLightbox
          items={list}
          startIndex={open}
          label={`${t.dGallery}: ${pick(project, 'name')}`}
          onClose={() => setOpen(null)}
        />
      )}
    </PfSection>
  )
}
