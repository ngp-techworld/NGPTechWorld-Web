import { useRef } from 'react'
import { useLanguage } from '@/i18n'
import { cx } from '@/lib/cx'
import { focusRing } from '@/ui'

const tabId = (prefix, key) => `${prefix}-tab-${key}`
const panelId = (prefix, key) => `${prefix}-panel-${key}`

function TabGroup({ group, value, onChange, idPrefix, showLabel }) {
  const { dir } = useLanguage()
  const refs = useRef({})
  const tabs = group.tabs
  // one tab of every group is reachable with Tab: the selected one, or the group's first
  const focusKey = tabs.some((tab) => tab.key === value) ? value : tabs[0]?.key
  const GroupIcon = group.icon

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === event.target.dataset.key) // the focused tab
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    let next = null
    if (event.key === forward) next = tabs[(index + 1) % tabs.length]
    else if (event.key === backward) next = tabs[(index - 1 + tabs.length) % tabs.length]
    else if (event.key === 'Home') next = tabs[0]
    else if (event.key === 'End') next = tabs[tabs.length - 1]
    if (!next) return
    event.preventDefault()
    onChange(next.key)
    refs.current[next.key]?.focus()
  }

  return (
    <div className="min-w-0 max-w-full">
      {showLabel ? (
        <p className={cx('mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider', group.tone === 'danger' ? 'text-gold' : 'text-faint')} title={group.hint}>
          {GroupIcon ? <GroupIcon size={12} aria-hidden="true" /> : null}
          {group.label}
        </p>
      ) : null}
      <div role="tablist" aria-label={group.hint ? `${group.label} — ${group.hint}` : group.label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = tab.key === value
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              ref={(node) => {
                refs.current[tab.key] = node
              }}
              type="button"
              role="tab"
              data-key={tab.key}
              id={tabId(idPrefix, tab.key)}
              aria-selected={selected}
              aria-controls={panelId(idPrefix, tab.key)}
              tabIndex={tab.key === focusKey ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cx(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors',
                focusRing,
                selected ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {Icon ? <Icon size={16} aria-hidden="true" /> : null}
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null ? <span className="rounded-full bg-white/10 px-1.5 text-[11px] font-bold text-soft">{tab.badge}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The project page's tab bar: one tablist per group (Public content · Internal · Sensitive), sharing one selected
 * tab. Arrow keys (mirrored in RTL), Home and End move inside a group; Tab moves between groups. The group titles are
 * shown only when there is more than one group. Pairs with the kit's <TabPanel> (same `idPrefix`).
 *
 * groups = [{ key, label, hint?, icon?, tone?, tabs: [{ key, label, icon?, badge? }] }]
 */
export function GroupedTabs({ groups, value, onChange, idPrefix }) {
  const shown = groups.filter((group) => group.tabs.length)
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-white/[.08]">
      {shown.map((group) => (
        <TabGroup key={group.key} group={group} value={value} onChange={onChange} idPrefix={idPrefix} showLabel={shown.length > 1} />
      ))}
    </div>
  )
}
