import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext'
import { useSections } from '../lib/SiteSettings'
import LanguageMenu from './LanguageMenu'

const linkClass = 'text-soft hover:text-white transition-colors text-[15px] cursor-pointer'

export default function Navbar() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const burgerRef = useRef(null)
  const shown = useSections()

  // Escape closes the open mobile menu and hands focus back to the button that opened it, as the
  // dashboard's sidebar does. Listened for only while the menu is open.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      burgerRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const links = [
    ['/', t.navHome], ['/services', t.navServices, 'services'], ['/portfolio', t.navPortfolio, 'portfolio'],
    ['/team', t.navTeam, 'team'], ['/offers', t.navOffers, 'offers'], ['/library', t.navLibrary, 'library'], ['/about', t.navAbout, 'about'], ['/contact', t.navContact],
  ].filter(([, , section]) => !section || shown(section))
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]" style={{ backdropFilter: 'blur(16px)', background: 'rgba(26,15,38,.78)' }}>
      <div className="mx-auto flex max-w-site items-center gap-4 px-[18px] py-3.5 sm:gap-5 sm:px-[26px]">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
          <img src="/assets/ngp-logo-white.png" alt="NGP TechWorld" className="h-[30px] w-auto sm:h-[34px]" />
        </Link>
        <div data-navlinks className="mx-auto flex items-center gap-6">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass}>{label}</NavLink>
          ))}
        </div>
        <div data-navctrls className="flex items-center gap-3 sm:gap-4">
          <LanguageMenu />
          <Link to="/contact" data-navcta className="btn-p rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
            {t.navCta}
          </Link>
          <button
            ref={burgerRef}
            data-burger
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="items-center justify-center rounded-lg border border-white/15 p-2 text-ink"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div data-mobilemenu className="border-t border-[var(--border)] px-[18px] py-3" style={{ background: 'rgba(26,15,38,.97)' }}>
          <div className="mx-auto flex max-w-site flex-col gap-1">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-[16px] text-soft hover:bg-white/5 hover:text-white"
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
