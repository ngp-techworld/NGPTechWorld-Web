import { Link } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext'
import { useSections, useSiteSettings } from '../lib/SiteSettings'
import VisitCounter from './VisitCounter'
import SocialLinks from './SocialLinks'

export default function Footer() {
  const { t } = useLang()
  const settings = useSiteSettings()
  const shown = useSections()
  return (
    <footer className="mt-5 border-t border-[var(--border)]" style={{ background: 'rgba(0,0,0,.22)' }}>
      <div data-grid3 className="mx-auto grid max-w-site gap-[30px] px-[26px] pb-[30px] pt-[46px]" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <div>
          <img src="/assets/ngp-logo-white.png" alt="NGP TechWorld" className="mb-3.5 h-[38px] w-auto" />
          <p className="max-w-[280px] text-[14px] leading-[1.7] text-faint">{t.footTagline}</p>
        </div>
        <div>
          <div className="mb-3.5 text-[15px] font-semibold">{t.footQuick}</div>
          <div className="flex flex-col gap-2.5 text-[14px] text-muted">
            <Link to="/" className="hover:text-white">{t.navHome}</Link>
            {shown('services') && <Link to="/services" className="hover:text-white">{t.navServices}</Link>}
            {shown('portfolio') && <Link to="/portfolio" className="hover:text-white">{t.navPortfolio}</Link>}
            {shown('team') && <Link to="/team" className="hover:text-white">{t.navTeam}</Link>}
            {shown('offers') && <Link to="/offers" className="hover:text-white">{t.navOffers}</Link>}
            {shown('library') && <Link to="/library" className="hover:text-white">{t.navLibrary}</Link>}
            {shown('about') && <Link to="/about" className="hover:text-white">{t.navAbout}</Link>}
          </div>
        </div>
        <div>
          <div className="mb-3.5 text-[15px] font-semibold">{t.navContact}</div>
          <div className="flex flex-col gap-2.5 text-[14px] text-muted">
            {settings.email && <span dir="ltr">{settings.email}</span>}
            {settings.phone && <span dir="ltr">{settings.phone}</span>}
          </div>
          {/* Renders nothing at all when the dashboard has no social URLs set, so the column
              keeps its shape instead of ending in an empty heading. */}
          <SocialLinks className="mt-6" />
        </div>
      </div>
      {/* The rights line and the counter share the bottom bar: side by side where there is room,
          stacked on a phone. `justify-center` rather than `between` so that with the counter
          switched off the rights line stays centred exactly as it was. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[.06] px-[26px] py-5 text-center text-[13px] text-[#6B5A80]">
        <span>{t.footRights}</span>
        <VisitCounter />
      </div>
    </footer>
  )
}
