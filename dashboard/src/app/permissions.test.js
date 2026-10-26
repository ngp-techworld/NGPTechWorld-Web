import { describe, expect, it } from 'vitest'
import { REGISTRY_ROLES, SECTIONS, canAccessFeature, canCreateProjects, filterFeaturesByUser } from './permissions'

const feature = (id) => ({ id, routes: [] })
const superAdmin = { is_super_admin: true, permissions: [] }
const limited = (permissions = [], registry_role = null) => ({ is_super_admin: false, permissions, registry_role })

describe('canAccessFeature', () => {
  it('denies everything when there is no signed-in user', () => {
    expect(canAccessFeature(feature('requests'), null)).toBe(false)
    expect(canAccessFeature(feature('dashboard'), null)).toBe(false)
  })

  it('lets a super admin into every section, including users', () => {
    expect(canAccessFeature(feature('users'), superAdmin)).toBe(true)
    for (const id of SECTIONS) expect(canAccessFeature(feature(id), superAdmin)).toBe(true)
  })

  it('lets a limited admin into only the sections they were given', () => {
    const user = limited(['requests', 'projects'])
    expect(canAccessFeature(feature('requests'), user)).toBe(true)
    expect(canAccessFeature(feature('projects'), user)).toBe(true)
    expect(canAccessFeature(feature('services'), user)).toBe(false)
  })

  it('always allows account, even with zero permissions', () => {
    expect(canAccessFeature(feature('account'), limited([]))).toBe(true)
  })

  it('never lets a limited admin into users or the dashboard overview, even with every section granted', () => {
    const user = limited(['users', 'dashboard', ...SECTIONS])
    expect(canAccessFeature(feature('users'), user)).toBe(false)
    expect(canAccessFeature(feature('dashboard'), user)).toBe(false)
  })

  it('shows my-portfolio only when a team profile is linked to the account — with zero section permissions, and even for a super admin without a link', () => {
    expect(canAccessFeature(feature('my-portfolio'), limited([]))).toBe(false)
    expect(canAccessFeature(feature('my-portfolio'), { ...limited([]), team_profile_id: 7 })).toBe(true)
    expect(canAccessFeature(feature('my-portfolio'), { ...superAdmin, team_profile_id: null })).toBe(false)
  })
})

describe('filterFeaturesByUser', () => {
  it('keeps only what the signed-in admin can see, in the original order', () => {
    const features = ['dashboard', 'requests', 'services', 'users', 'account'].map(feature)

    expect(filterFeaturesByUser(features, limited(['requests'])).map((f) => f.id)).toEqual(['requests', 'account'])
    expect(filterFeaturesByUser(features, superAdmin).map((f) => f.id)).toEqual(['dashboard', 'requests', 'services', 'users', 'account'])
    expect(filterFeaturesByUser(features, null)).toEqual([])
  })
})

describe('registry features', () => {
  it('shows the registry to super admins and to every registry role, never to a section-only admin', () => {
    expect(canAccessFeature(feature('registry'), superAdmin)).toBe(true)
    for (const role of REGISTRY_ROLES) expect(canAccessFeature(feature('registry'), limited([], role))).toBe(true)
    expect(canAccessFeature(feature('registry'), limited(['projects', ...SECTIONS]))).toBe(false)
    expect(canAccessFeature(feature('registry'), limited([]))).toBe(false)
  })

  it('shows the catalogs to super admins, every registry role and the projects section', () => {
    expect(canAccessFeature(feature('catalogs'), superAdmin)).toBe(true)
    expect(canAccessFeature(feature('catalogs'), limited([], 'viewer'))).toBe(true)
    expect(canAccessFeature(feature('catalogs'), limited(['projects']))).toBe(true)
    expect(canAccessFeature(feature('catalogs'), limited(['services', 'requests']))).toBe(false)
  })

  it('keeps the audit log for super admins only, whatever the registry role or sections', () => {
    expect(canAccessFeature(feature('audit-log'), superAdmin)).toBe(true)
    expect(canAccessFeature(feature('audit-log'), limited(['audit-log', ...SECTIONS], 'manager'))).toBe(false)
  })

  it('keeps every section rule for registry users: a registry role grants no content section', () => {
    const manager = limited([], 'manager')
    expect(canAccessFeature(feature('projects'), manager)).toBe(false)
    expect(canAccessFeature(feature('services'), manager)).toBe(false)
    expect(canAccessFeature(feature('users'), manager)).toBe(false)
    expect(canAccessFeature(feature('account'), manager)).toBe(true)
    expect(canAccessFeature(feature('projects'), limited(['projects'], 'viewer'))).toBe(true)
  })

  it('lets super admins, the projects section and registry managers create projects (and edit the catalogs)', () => {
    expect(canCreateProjects(superAdmin)).toBe(true)
    expect(canCreateProjects(limited(['projects']))).toBe(true)
    expect(canCreateProjects(limited([], 'manager'))).toBe(true)
    expect(canCreateProjects(limited([], 'developer'))).toBe(false)
    expect(canCreateProjects(limited([], 'viewer'))).toBe(false)
    expect(canCreateProjects(null)).toBe(false)
  })
})
