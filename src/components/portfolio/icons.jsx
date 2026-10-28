/**
 * The portfolio pages' line icons, drawn on the same 24px grid and stroke as components/Icon.jsx.
 * Generic shapes only — no vendor logos — so a platform reads by its label as much as its glyph.
 */

const svg = (size, children, extra = {}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...extra}
  >
    {children}
  </svg>
)

const PLATFORM_PATHS = {
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  android: <><path d="M5.5 17V11a6.5 6.5 0 0 1 13 0v6z" /><path d="M8.5 5.6 7 3.5M15.5 5.6 17 3.5M5.5 13.5h13" /><circle cx="9.5" cy="10" r=".4" fill="currentColor" /><circle cx="14.5" cy="10" r=".4" fill="currentColor" /></>,
  ios: <><rect x="6.5" y="2.5" width="11" height="19" rx="3" /><path d="M10.5 5.2h3" /></>,
  windows: <><rect x="3" y="4" width="18" height="12" rx="1.6" /><path d="M8.5 20h7M12 16v4" /></>,
  macos: <><rect x="5" y="5" width="14" height="10" rx="1.6" /><path d="M2.5 19h19" /></>,
  linux: <><rect x="4" y="3.5" width="16" height="7" rx="1.6" /><rect x="4" y="13.5" width="16" height="7" rx="1.6" /><path d="M8 7h.01M8 17h.01" /></>,
  api: <path d="M8 4C6 4 5 5 5 7v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3" />,
  cli: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7.5 9.5 3 2.5-3 2.5M13 15h4" /></>,
  other: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
}

export function PlatformGlyph({ platform, size = 17 }) {
  return svg(size, PLATFORM_PATHS[platform] ?? PLATFORM_PATHS.other)
}

/** Points along the reading direction: right in English, left in Arabic (via .pf-dir). */
export function Chevron({ size = 16, back = false }) {
  return svg(size, <path d={back ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />, { className: 'pf-dir' })
}

export function ExternalIcon({ size = 14 }) {
  return svg(size, <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />)
}

export function SearchIcon({ size = 18 }) {
  return svg(size, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>)
}

export function CloseIcon({ size = 18 }) {
  return svg(size, <path d="M6 6l12 12M18 6 6 18" />)
}

export function DesktopIcon({ size = 16 }) {
  return PlatformGlyph({ platform: 'windows', size })
}

export function MobileIcon({ size = 16 }) {
  return PlatformGlyph({ platform: 'ios', size })
}

/** The small hexagon marker — the logo's silhouette, used as a list bullet. */
export function HexDot() {
  return <span className="pf-hexdot" aria-hidden="true" />
}
