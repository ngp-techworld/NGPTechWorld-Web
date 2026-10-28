import { cx } from '@/lib/cx'

// public/assets/ngp-logo-white.png, under the deploy prefix (vite.config.js `base`, e.g. /ngp-hq/): an absolute
// '/assets/…' would only resolve when the dashboard happens to be served behind the public site's own domain.
export const logoUrl = () => `${import.meta.env.BASE_URL}assets/ngp-logo-white.png`

/** NGP logo (white PNG from the public site) — `size` = image height in px. */
export function Brand({ size = 32, className }) {
  return <img src={logoUrl()} alt="NGP TechWorld" style={{ height: size }} className={cx('w-auto select-none', className)} draggable="false" />
}
