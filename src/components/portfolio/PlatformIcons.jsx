import { useLang } from '../../i18n/LanguageContext'
import { PlatformGlyph } from './icons'

/** A project's platforms as a row of labelled glyphs (the label is the accessible name and the tooltip). */
export default function PlatformIcons({ platforms, size = 17, className = '' }) {
  const { t } = useLang()
  const list = [...new Set(Array.isArray(platforms) ? platforms : [])]
  if (list.length === 0) return null

  return (
    <ul className={'pf-platforms ' + className} aria-label={t.pfPlatforms}>
      {list.map((p) => {
        const label = t.platformLabels[p] ?? p
        return (
          <li key={p}>
            <span role="img" aria-label={label} title={label}>
              <PlatformGlyph platform={p} size={size} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
