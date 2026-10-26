// Fixtures of the registry tests of the project page (not imported by the app).
import { PROJECT_ABILITIES } from '@/features/registry/kit'
import { paginated } from '@/test/mockApi'
import { showProject } from './testUtils'

const stamp = '2026-10-20T10:00:00.000000Z'

const allow = (names) => Object.fromEntries(PROJECT_ABILITIES.map((name) => [name, names.includes(name)]))

/** The abilities each kind of caller gets (ProjectPolicy), for a project they are or are not a member of. */
export const ABILITIES = {
  superAdmin: allow(PROJECT_ABILITIES),
  managerMember: allow(['view', 'updatePublic', 'publish', 'viewInternal', 'updateInternal', 'viewSensitive', 'updateSensitive', 'manageMembers', 'archive', 'restore']),
  developerMember: allow(['view', 'updatePublic', 'viewInternal', 'updateInternal', 'viewSensitive', 'updateSensitive']),
  viewer: allow(['view', 'viewInternal']),
  contentEditor: allow(['view', 'updatePublic', 'publish']),
}

export const emptyOperations = {
  administration: {
    owner_name: 'Layla',
    technical_lead_name: null,
    project_manager_name: null,
    assigned_developers: null,
    customer_name: null,
    responsible_admin_name: null,
    maintenance_responsibility: null,
    development_stage: null,
    priority: null,
    support_status: null,
    last_maintenance_date: null,
    ngp_role: null,
    responsible_team: null,
    initial_development_date: null,
    last_meaningful_update: null,
    components: null,
  },
  monitoring: { health_check: null, logging: null, error_monitoring: null, server_monitoring: null, uptime_monitoring: null, backup_monitoring: null, scheduled_jobs: null, queue_workers: null, cron_jobs: null, procedures: null },
  verification: { verification_status: null, public_field_provenance: null },
  auth: { auth_method: null, mfa: null, provisioning: null, recovery: null, account_roles: null },
  deployment: {
    deploy_method: null,
    ci_cd_provider: null,
    workflows: null,
    build_artifacts: null,
    release_strategy: null,
    release_version: null,
    rollback_procedure: null,
    deploy_verification: null,
    deploy_permissions: null,
    deploy_responsible_admin: null,
    run_requirements: null,
  },
  data: { storage_service: null, upload_handling: null, no_database: false },
}

const INTERNAL = ['administration', 'monitoring', 'verification']
const SENSITIVE = ['auth', 'deployment', 'data']

/** The registry fields the original admin record also carries (ProjectAdminResource). */
export const registryColumns = {
  project_uid: '7d0c5f4e-1111-2222-3333-444455556666',
  industry_id: null,
  business_problem_ar: null,
  business_problem_en: null,
  solution_ar: null,
  solution_en: null,
  target_customers_ar: null,
  target_customers_en: null,
  target_users_ar: null,
  target_users_en: null,
  platforms: [],
  highlights: [],
  technical_highlights: [],
  nonfunctional_highlights: [],
  development_status: 'completed',
  deployment_status: 'production',
  publication_status: 'draft',
  published_at: null,
  archived_at: null,
  public_demo_url: null,
  last_imported_at: null,
}

export const legacyProject = (over = {}) =>
  showProject(7, { slug: 'acme-portal', name_ar: 'بوابة أكمي', name_en: 'Acme Portal', client: 'Acme', ...registryColumns, ...over })

/** GET /registry/projects/{id}: the project, the operations groups the abilities allow, completeness, abilities. */
export function registryRecord({ abilities = ABILITIES.superAdmin, over = {}, publication } = {}) {
  const operations = Object.fromEntries(
    Object.entries(emptyOperations).filter(([group]) => (INTERNAL.includes(group) ? abilities.viewInternal : SENSITIVE.includes(group) ? abilities.viewSensitive : false)),
  )
  const { team_members, links, ...rest } = legacyProject(over)
  return {
    ...rest,
    operations,
    completeness: {
      documentation: { complete: false, missing: ['business_problem', 'modules'] },
      screenshots: { complete: true, missing: [] },
      operations: { complete: false, missing: ['repositories'] },
      score: 86,
    },
    abilities,
    ...(publication ? { publication } : {}),
    ...over,
  }
}

export const stampOf = stamp

/**
 * Every request the project page may make, answering empty lists. `extra` routes come first (mockApi answers with the
 * first pattern that matches), so a specific `GET /registry/projects/:id/modules` wins over the generic one.
 */
export function registryRoutes({ abilities, over, publication, extra = {} } = {}) {
  const record = registryRecord({ abilities, over, publication })
  const defaults = {
    'GET /projects/:id': () => ({ data: legacyProject(over) }),
    'GET /registry/projects/:id': () => ({ data: record }),
    'GET /registry/industries': () => paginated([{ id: 3, key: 'retail', name_ar: 'التجزئة', name_en: 'Retail', order: 0 }]),
    'GET /registry/technologies': () => paginated([]),
    'GET /registry/projects/:id/:segment': () => paginated([]),
    'GET /projects/:id/:segment': () => paginated([]),
    'GET /users': () => paginated([]),
  }
  const routes = { ...extra }
  Object.entries(defaults).forEach(([key, handler]) => {
    if (!(key in routes)) routes[key] = handler
  })
  return routes
}
