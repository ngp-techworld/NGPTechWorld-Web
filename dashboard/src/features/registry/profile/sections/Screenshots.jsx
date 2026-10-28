import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Lock, Star } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { Badge, Button, Modal, flipRtl } from '@/ui'
import { AuthImage } from '../../kit'
import { useProfileEnv } from '../env'
import { MissingHint, Part, ProfileSection, Prose } from '../parts'

// A private thumbnail is one request to the file stream (60 a minute): the grid starts with this many.
export const FIRST_SCREENSHOTS = 24

function Lightbox({ rows, index, onIndex, onClose }) {
  const { p, t, r, pickField } = useProfileEnv()
  const { dir } = useLanguage()
  const row = index === null ? null : rows[index]
  const count = rows.length
  const go = (step) => onIndex((index + step + count) % count)

  useEffect(() => {
    if (index === null) return undefined
    // the arrows follow the reading direction: in Arabic the next picture is to the left
    const onKey = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const forward = (event.key === 'ArrowRight') === (dir === 'ltr')
      onIndex((index + (forward ? 1 : -1) + count) % count)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, count, dir, onIndex])

  if (!row) return null
  const name = pickField(row, 'title') || `${t.untitled} #${row.id}`
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={name}
      description={p.screenshotN(index + 1, count)}
      footer={
        count > 1 ? (
          <>
            <Button variant="secondary" size="sm" icon={ChevronLeft} iconClassName={flipRtl} onClick={() => go(-1)}>
              {p.previous}
            </Button>
            <Button variant="secondary" size="sm" iconEnd={ChevronRight} iconClassName={flipRtl} onClick={() => go(1)}>
              {p.next}
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black/40">
          <AuthImage key={row.id} src={row.url ?? row.thumbnail_url} alt={name} className="absolute inset-0" imgClassName="!object-contain" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.is_public ? 'success' : 'neutral'}>{row.is_public ? t.publicScreenshot : t.privateScreenshot}</Badge>
          {row.platform ? <Badge>{r.screenshotPlatforms[row.platform] ?? row.platform}</Badge> : null}
          {row.is_cover ? <Badge tone="gold">{t.coverBadge}</Badge> : null}
        </div>
        <Prose text={pickField(row, 'description')} className="text-sm text-soft" />
      </div>
    </Modal>
  )
}

/** Every screenshot, private ones included (streamed with the token), in a grid that opens a simple lightbox. */
export function ScreenshotsSection({ data, missing }) {
  const { p, t, r, pickField } = useProfileEnv()
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(null)
  return (
    <ProfileSection id="screenshots" tier="public" icon={ImageIcon} title={p.sections.screenshots}>
      <Part query={data.screenshots} label={t.screenshotsTitle} lines={3}>
        {(rows) => {
          if (!rows.length) return null
          const shown = all ? rows : rows.slice(0, FIRST_SCREENSHOTS)
          return (
            <>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {shown.map((row, index) => {
                  const name = pickField(row, 'title') || `${t.untitled} #${row.id}`
                  return (
                    <li key={row.id} className="min-w-0" data-profile-block="">
                      <button
                        type="button"
                        onClick={() => setOpen(index)}
                        aria-label={p.viewScreenshot(name)}
                        className="group block w-full overflow-hidden rounded-xl border border-white/[.08] bg-white/[.03] text-start transition-colors hover:border-accent-light/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
                      >
                        <span className="relative block aspect-video bg-white/[.04]">
                          <AuthImage src={row.thumbnail_url ?? row.url} alt="" className="absolute inset-0" />
                          <span className="absolute start-1.5 top-1.5 flex flex-wrap gap-1">
                            {!row.is_public ? (
                              <Badge>
                                <Lock size={10} aria-hidden="true" />
                                {t.privateScreenshot}
                              </Badge>
                            ) : null}
                            {row.is_cover ? (
                              <Badge tone="gold">
                                <Star size={10} aria-hidden="true" />
                                {t.coverBadge}
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                        <span className="block px-2.5 py-2">
                          <span dir="auto" className="block truncate text-xs font-semibold text-ink">
                            {name}
                          </span>
                          <span className="block text-[11px] text-muted">{r.screenshotPlatforms[row.platform] ?? row.platform}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!all && rows.length > FIRST_SCREENSHOTS ? (
                <Button variant="secondary" size="sm" onClick={() => setAll(true)} data-print-hide="">
                  {p.showAll(rows.length)}
                </Button>
              ) : null}
              <Lightbox rows={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
            </>
          )
        }}
      </Part>
      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
