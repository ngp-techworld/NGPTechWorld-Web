// Fixtures of the project profile tests (not imported by the app).
import { ABILITIES, registryRoutes } from '@/features/projects/registryTestUtils'
import { paginated } from '@/test/mockApi'

const base = '/registry/projects/7'

export const account = (id, over = {}) => ({
  id,
  project_id: 7,
  purpose: `Account ${id}`,
  identifier: `user${id}@acme.test`,
  kind: 'administrator',
  role: 'admin',
  environment: 'production',
  owner: 'Layla',
  vault_ref: `vault://ngp/acme/production/account-${id}`,
  mfa_status: 'enabled',
  last_verified_at: null,
  order: id,
  ...over,
})
export const envVar = (id, name, over = {}) => ({ id, project_id: 7, name, component: 'backend', purpose: `Purpose of ${name}`, required: true, is_secret: false, source_file: '.env.example', vault_ref: null, order: id, ...over })
export const feature = (id, over = {}) => ({
  id,
  project_id: 7,
  module_id: 1,
  key: `feature-${id}`,
  name_ar: `ميزة ${id}`,
  name_en: `Feature ${id}`,
  description_ar: null,
  description_en: null,
  status: 'verified',
  is_public: true,
  evidence: [],
  tests: null,
  order: id,
  ...over,
})

/** The collections of a full project, by segment (the others answer empty). */
export const COLLECTIONS = {
  modules: [{ id: 1, project_id: 7, key: 'orders', name_ar: 'الطلبات', name_en: 'Orders', order: 1 }],
  features: [feature(1, { name_en: 'Online ordering' }), feature(2, { name_en: 'Gift cards', status: 'planned', is_public: false })],
  technologies: [{ id: 1, project_id: 7, technology_id: 5, version: '12', usage: 'active', component: 'backend', technology: { id: 5, name: 'Laravel', slug: 'laravel', category: 'backend' } }],
  'maintenance-records': [
    { id: 1, project_id: 7, type: 'risk', status: 'open', severity: 'low', title: 'Low risk: logs fill the disk', body: null, order: 1 },
    { id: 2, project_id: 7, type: 'risk', status: 'open', severity: 'critical', title: 'Critical risk: no backups', body: 'Set up backups.', order: 2 },
  ],
  accounts: [account(1), account(2, { purpose: 'Staging owner', vault_ref: 'vault://ngp/acme/staging/owner' })],
  'secret-refs': [{ id: 1, project_id: 7, ref: 'vault://ngp/acme/production/app-key', status: 'to_create', purpose: 'Laravel APP_KEY', environment: 'production', related_env_vars: ['APP_KEY'], order: 1 }],
  'env-vars': [envVar(1, 'APP_NAME'), envVar(2, 'DB_HOST'), envVar(3, 'DB_PASSWORD', { is_secret: true, vault_ref: 'vault://ngp/acme/production/database' })],
  endpoints: [
    { id: 1, project_id: 7, url: 'https://acme.test', kind: 'public_site', environment: 'production', visibility: 'public', verification_status: 'confirmed', purpose: 'The shop', order: 1 },
    { id: 2, project_id: 7, url: 'https://acme.test/admin', kind: 'admin', environment: 'production', visibility: 'private', verification_status: 'unverified', purpose: null, order: 2 },
  ],
  environments: [{ id: 1, project_id: 7, name: 'production', description: 'The live site', config_files: ['.env'], order: 1 }],
}

/** Every request of the profile of project 7: `collections` by segment, `extra` routes first. */
export function profileRoutes({ abilities = ABILITIES.superAdmin, over, collections = COLLECTIONS, extra = {} } = {}) {
  const lists = Object.fromEntries(Object.entries(collections).map(([segment, rows]) => [`GET ${base}/${segment}`, () => paginated(rows, { perPage: 200 })]))
  return registryRoutes({ abilities, over, extra: { ...lists, ...extra } })
}
