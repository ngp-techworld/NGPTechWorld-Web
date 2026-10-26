import { describe, expect, it, vi } from 'vitest'
import { NAV_GROUPS, buildNav, buildRoutes, collectFeatures, features } from './features'

const icon = () => null

describe('collectFeatures', () => {
  it('sorts features by nav order and skips invalid or duplicated ones (with a warning)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = collectFeatures({
      './b/index.jsx': { default: { id: 'b', nav: { order: 20 }, routes: [] } },
      './a/index.jsx': { default: { id: 'a', nav: { order: 10 }, routes: [] } },
      './broken/index.jsx': { default: { nope: true } },
      './dup/index.jsx': { default: { id: 'a', nav: { order: 5 }, routes: [] } },
      './nodefault/index.jsx': {},
    })
    expect(list.map((feature) => feature.id)).toEqual(['a', 'b'])
    expect(warn).toHaveBeenCalledTimes(3)
  })
})

describe('buildNav / buildRoutes', () => {
  const list = [
    { id: 'dash', nav: { order: 10, group: 'main', label: { ar: 'أ', en: 'A' }, to: '/' }, routes: [{ index: true }] },
    { id: 'faqs', nav: { order: 80, group: 'content', icon, label: { ar: 'ب', en: 'B' }, to: '/faqs' }, routes: [{ path: 'faqs' }, { path: 'faqs/new' }] },
    { id: 'users', nav: { order: 110, group: 'system', label: { ar: 'ج', en: 'C' }, to: '/users' }, routes: [{ path: 'users' }] },
    { id: 'hidden', routes: [{ path: 'hidden' }] },
  ]

  it('groups nav items in main / content / system order and omits features without nav', () => {
    const groups = buildNav(list)
    expect(groups.map((group) => group.group)).toEqual(['main', 'content', 'system'])
    expect(groups[1].items[0]).toMatchObject({ id: 'faqs', to: '/faqs', order: 80 })
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).not.toContain('hidden')
  })

  it('flattens every feature route', () => {
    expect(buildRoutes(list).map((route) => route.path ?? 'index')).toEqual(['index', 'faqs', 'faqs/new', 'users', 'hidden'])
  })

  it('keeps a page offered by two features once (the first one wins)', () => {
    const first = { path: 'projects/:id', element: 'first' }
    const shared = [
      { id: 'registry', routes: [{ path: 'registry' }, first] },
      { id: 'projects', routes: [{ path: 'projects' }, { path: 'projects/:id', element: 'second' }] },
    ]
    const routes = buildRoutes(shared)
    expect(routes.map((route) => route.path)).toEqual(['registry', 'projects/:id', 'projects'])
    expect(routes[1]).toBe(first)
  })
})

describe('the real features folder (import.meta.glob)', () => {
  const planned = {
    dashboard: [10, 'main'],
    requests: [20, 'main'],
    projects: [30, 'content'],
    services: [40, 'content'],
    stats: [50, 'content'],
    testimonials: [60, 'content'],
    partners: [70, 'content'],
    faqs: [80, 'content'],
    'page-content': [90, 'content'],
    settings: [100, 'system'],
    users: [110, 'system'],
  }

  it('registers every planned area, each id once (extra features are fine)', () => {
    const ids = features.map((feature) => feature.id)
    expect(ids).toEqual(expect.arrayContaining(Object.keys(planned)))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('follows the nav orders / groups of docs/PLAN.md §7.1 and gives every entry a bilingual label and an icon', () => {
    for (const feature of features) {
      if (!feature.nav) continue
      if (planned[feature.id]) expect([feature.nav.order, feature.nav.group]).toEqual(planned[feature.id])
      expect(NAV_GROUPS).toContain(feature.nav.group)
      expect(feature.nav.label.ar).toBeTruthy()
      expect(feature.nav.label.en).toBeTruthy()
      expect(feature.nav.icon).toBeTruthy()
      expect(feature.nav.to.startsWith('/')).toBe(true)
    }
  })

  it('serves the dashboard at the index route', () => {
    const dashboard = features.find((feature) => feature.id === 'dashboard')
    expect(dashboard.nav.to).toBe('/')
    expect(dashboard.routes.some((route) => route.index === true)).toBe(true)
  })

  it('no two features claim the same route path, unless they offer the very same page', () => {
    // the project page belongs to `projects` and to `registry` (a registry-only account has no `projects` section):
    // a shared path is fine when every feature renders the same component there, anything else is a collision
    const byPath = new Map()
    for (const feature of features) {
      for (const route of feature.routes) {
        const key = route.index ? '(index)' : route.path
        byPath.set(key, [...(byPath.get(key) ?? []), route.element?.type])
      }
    }
    for (const [path, pages] of byPath) expect(new Set(pages).size, path).toBe(1)
  })
})
