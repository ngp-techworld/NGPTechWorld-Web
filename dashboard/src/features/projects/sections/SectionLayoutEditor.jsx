import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { ApiError } from '@/lib/api'
import { cx } from '@/lib/cx'
import { Alert, Badge, Button, Card, IconButton, SortableList, Switch } from '@/ui'
import strings from './strings'

/** The orderable sections of a public project page, in their built-in order (backend contract). */
export const SECTION_KEYS = ['overview', 'problem_solution', 'features', 'modules', 'highlights', 'technologies', 'gallery', 'video', 'team', 'links', 'demo']

/**
 * A stored layout (`[{key, visible}]`, or null for "the default") → every known section once, in order: unknown keys
 * are dropped, a repeated key keeps its first place, and keys the layout does not mention yet (new sections) are
 * appended, visible.
 */
export function normalizeLayout(value) {
  const seen = new Set()
  const items = []
  for (const entry of Array.isArray(value) ? value : []) {
    if (!SECTION_KEYS.includes(entry?.key) || seen.has(entry.key)) continue
    seen.add(entry.key)
    items.push({ key: entry.key, visible: entry.visible !== false })
  }
  SECTION_KEYS.forEach((key) => {
    if (!seen.has(key)) items.push({ key, visible: true })
  })
  return items
}

const toBody = (useDefault, items) => (useDefault ? null : items.map(({ key, visible }) => ({ key, visible })))

/**
 * Order and visibility of the public project page's sections, used twice: on a project (`field` = `section_layout`,
 * `PUT /projects/{id}`; null = follow the site default) and in the site settings (`portfolio_sections`,
 * `PUT /settings`; null = every section, in the built-in order).
 *
 * `value` = the stored layout (or null), `defaultLayout` = what "default" means here (shown read-only while the
 * switch is on), `onSave(layoutOrNull)` returns a promise; a 422 (`errors.<field>`, `errors.<field>.N.key`) is shown
 * in the card, on the row it names. Without `canWrite` everything is read-only.
 */
export function SectionLayoutEditor({ title, description, field, value, defaultLayout = null, defaultHint, onSave, canWrite = false, saving = false }) {
  const c = useCommon()
  const t = useStrings(strings)
  const storedDefault = value === null || value === undefined
  const [useDefault, setUseDefault] = useState(storedDefault)
  const [items, setItems] = useState(() => normalizeLayout(storedDefault ? defaultLayout : value))
  const baseline = useRef(JSON.stringify(toBody(storedDefault, normalizeLayout(storedDefault ? defaultLayout : value))))
  const [errors, setErrors] = useState({ list: [], rows: {} })
  const body = toBody(useDefault, items)
  const dirty = JSON.stringify(body) !== baseline.current
  const shown = useDefault ? normalizeLayout(defaultLayout) : items
  const name = (key) => t.sections[key] ?? key

  const move = (index, delta) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    setItems(next)
  }
  const toggle = (key) => setItems(items.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)))

  const save = async () => {
    setErrors({ list: [], rows: {} })
    try {
      await onSave(body)
      baseline.current = JSON.stringify(body)
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 422) return
      const list = []
      const rows = {}
      Object.entries(err.errors).forEach(([key, messages]) => {
        const match = new RegExp(`^${field}\\.(\\d+)(?:\\.|$)`).exec(key)
        // `section_layout.3.key` → the row of the section that was sent at position 3
        const sectionKey = match ? body?.[Number(match[1])]?.key : null
        if (sectionKey) rows[sectionKey] = messages[0]
        else list.push(messages[0])
      })
      setErrors({ list, rows })
    }
  }

  const row = (item, index, handle) => (
    <div className={cx('flex items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2', !item.visible && 'opacity-60')}>
      {handle}
      <span className="w-6 text-center text-xs font-bold tabular-nums text-muted">{t.position(index + 1)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name(item.key)}</p>
        {errors.rows[item.key] ? <p className="text-xs font-medium text-danger">{errors.rows[item.key]}</p> : null}
      </div>
      {!item.visible ? <Badge tone="neutral">{t.hidden}</Badge> : null}
      {canWrite && !useDefault ? (
        <div className="flex items-center gap-0.5">
          <IconButton size="sm" icon={ArrowUp} label={t.moveUp(name(item.key))} onClick={() => move(index, -1)} disabled={index === 0} />
          <IconButton size="sm" icon={ArrowDown} label={t.moveDown(name(item.key))} onClick={() => move(index, 1)} disabled={index === items.length - 1} />
          <IconButton size="sm" icon={item.visible ? Eye : EyeOff} label={item.visible ? t.hide(name(item.key)) : t.show(name(item.key))} aria-pressed={!item.visible} onClick={() => toggle(item.key)} />
        </div>
      ) : null}
    </div>
  )

  return (
    <Card title={title} description={description} aria-label={title}>
      <div className="space-y-4">
        <Switch
          checked={useDefault}
          onChange={(next) => {
            setUseDefault(next)
            if (!next && storedDefault) setItems(normalizeLayout(defaultLayout)) // start a custom order from the default
          }}
          label={t.useDefault}
          description={useDefault ? defaultHint : undefined}
          disabled={!canWrite}
        />
        {errors.list.length ? (
          <Alert tone="danger" title={t.errorsTitle}>
            <ul className="list-inside list-disc">
              {errors.list.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {canWrite && !useDefault ? (
          <SortableList
            items={items}
            getId={(item) => item.key}
            ariaLabel={t.listLabel}
            onReorder={setItems}
            renderItem={(item, { handle, index }) => row(item, index, handle)}
          />
        ) : (
          <ol aria-label={t.listLabel} className="space-y-2">
            {shown.map((item, index) => (
              <li key={item.key}>{row(item, index, null)}</li>
            ))}
          </ol>
        )}
        {canWrite ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!useDefault ? (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setItems(normalizeLayout(defaultLayout))}>
                {t.reset}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} loading={saving} disabled={!dirty || saving}>
              {saving ? c.saving : c.save}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
