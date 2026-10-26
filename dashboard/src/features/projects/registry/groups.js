import { ACCOUNT_KINDS, DEVELOPER_SOURCES, MFA_LEVELS, PRIORITIES, SUPPORT_STATUSES, toOptions } from '@/features/registry/kit'

// Field lists of the operations groups (`PUT /registry/projects/{id}/operations/{group}`), mirroring
// RegistryProjectController::groupRules. They take `env` (see useRegistryEnv): `t` registry tab strings, `r` kit strings.

export const administrationFields = ({ t, r }) => [
  { name: 'owner_name', type: 'text', label: t.ownerName, max: 255 },
  { name: 'technical_lead_name', type: 'text', label: t.technicalLeadName, max: 255 },
  { name: 'project_manager_name', type: 'text', label: t.projectManagerName, max: 255 },
  { name: 'customer_name', type: 'text', label: t.customerName, max: 255 },
  { name: 'responsible_admin_name', type: 'text', label: t.responsibleAdminName, max: 255 },
  { name: 'responsible_team', type: 'text', label: t.responsibleTeam, max: 255 },
  { name: 'ngp_role', type: 'text', label: t.ngpRole, max: 255 },
  { name: 'development_stage', type: 'text', label: t.developmentStage, max: 255 },
  { name: 'priority', type: 'select', label: t.priority, options: toOptions(PRIORITIES, r.priorities) },
  { name: 'support_status', type: 'select', label: t.supportStatus, options: toOptions(SUPPORT_STATUSES, r.supportStatuses) },
  { name: 'initial_development_date', type: 'date', label: t.initialDevelopmentDate },
  { name: 'last_meaningful_update', type: 'date', label: t.lastMeaningfulUpdate },
  { name: 'last_maintenance_date', type: 'date', label: t.lastMaintenanceDate },
  { name: 'maintenance_responsibility', type: 'textarea', label: t.maintenanceResponsibility, max: 2000 },
  {
    name: 'assigned_developers',
    type: 'objectList',
    label: t.assignedDevelopers,
    itemLabel: t.developer,
    maxItems: 100,
    fields: [
      { name: 'name', type: 'text', label: t.developerName, required: true, max: 120 },
      { name: 'source', type: 'select', label: t.developerSource, options: toOptions(DEVELOPER_SOURCES, r.developerSources) },
      { name: 'commits', type: 'number', label: t.developerCommits, min: 0 },
    ],
  },
  {
    name: 'components',
    type: 'objectList',
    label: t.components,
    itemLabel: t.component,
    maxItems: 30,
    fields: [
      { name: 'key', type: 'text', label: t.componentKey, required: true, max: 60, dir: 'ltr' },
      { name: 'type', type: 'text', label: t.componentType, max: 30, dir: 'ltr' },
      { name: 'path', type: 'text', label: t.componentPath, max: 255, dir: 'ltr' },
      { name: 'stack', type: 'text', label: t.componentStack, max: 255, dir: 'ltr' },
    ],
  },
]

export const monitoringFields = ({ t }) => [
  { name: 'health_check', type: 'textarea', label: t.healthCheck, max: 2000 },
  { name: 'logging', type: 'textarea', label: t.logging, max: 2000 },
  { name: 'error_monitoring', type: 'textarea', label: t.errorMonitoring, max: 2000 },
  { name: 'server_monitoring', type: 'textarea', label: t.serverMonitoring, max: 2000 },
  { name: 'uptime_monitoring', type: 'textarea', label: t.uptimeMonitoring, max: 2000 },
  { name: 'backup_monitoring', type: 'textarea', label: t.backupMonitoring, max: 2000 },
  { name: 'scheduled_jobs', type: 'lines', label: t.scheduledJobs, maxItems: 50, itemMax: 500 },
  { name: 'queue_workers', type: 'lines', label: t.queueWorkers, maxItems: 50, itemMax: 500 },
  { name: 'cron_jobs', type: 'lines', label: t.cronJobs, maxItems: 50, itemMax: 500, dir: 'ltr' },
  { name: 'procedures', type: 'lines', label: t.procedures, maxItems: 50, itemMax: 2000, rows: 5 },
]

export const authFields = ({ t, r }) => [
  { name: 'auth_method', type: 'textarea', label: t.authMethod, max: 2000 },
  { name: 'mfa', type: 'select', label: t.mfa, options: toOptions(MFA_LEVELS, r.mfaLevels) },
  { name: 'provisioning', type: 'textarea', label: t.provisioning, max: 2000 },
  { name: 'recovery', type: 'textarea', label: t.recovery, max: 2000 },
  {
    name: 'account_roles',
    type: 'objectList',
    label: t.accountRoles,
    itemLabel: t.accountRole,
    maxItems: 50,
    fields: [
      { name: 'role', type: 'text', label: t.roleName, required: true, max: 120 },
      { name: 'kind', type: 'select', label: t.roleKind, options: toOptions(ACCOUNT_KINDS, r.accountKinds) },
      { name: 'description', type: 'textarea', label: t.roleDescription, max: 2000 },
      { name: 'permissions_summary', type: 'textarea', label: t.rolePermissions, max: 2000 },
    ],
  },
]

export const deploymentFields = ({ t }) => [
  { name: 'deploy_method', type: 'textarea', label: t.deployMethod, max: 2000 },
  { name: 'ci_cd_provider', type: 'text', label: t.ciCdProvider, max: 120 },
  { name: 'release_version', type: 'text', label: t.releaseVersion, max: 60, dir: 'ltr' },
  { name: 'deploy_responsible_admin', type: 'text', label: t.deployResponsibleAdmin, max: 255 },
  { name: 'release_strategy', type: 'textarea', label: t.releaseStrategy, max: 2000 },
  { name: 'rollback_procedure', type: 'textarea', label: t.rollbackProcedure, max: 5000, rows: 4 },
  { name: 'deploy_verification', type: 'textarea', label: t.deployVerification, max: 2000 },
  { name: 'deploy_permissions', type: 'textarea', label: t.deployPermissions, max: 2000 },
  { name: 'build_artifacts', type: 'lines', label: t.buildArtifacts, maxItems: 30, itemMax: 255, dir: 'ltr' },
  {
    name: 'workflows',
    type: 'objectList',
    label: t.workflows,
    itemLabel: t.workflow,
    maxItems: 30,
    fields: [
      { name: 'file', type: 'text', label: t.workflowFile, required: true, max: 255, dir: 'ltr' },
      { name: 'trigger', type: 'text', label: t.workflowTrigger, max: 255, dir: 'ltr' },
      { name: 'steps_summary', type: 'textarea', label: t.workflowSteps, max: 2000 },
    ],
  },
  {
    name: 'run_requirements.software',
    type: 'objectList',
    label: t.software,
    itemLabel: t.softwareItem,
    maxItems: 30,
    fields: [
      { name: 'name', type: 'text', label: t.softwareName, required: true, max: 60, dir: 'ltr' },
      { name: 'version', type: 'text', label: t.softwareVersion, max: 60, dir: 'ltr' },
      { name: 'evidence', type: 'text', label: t.softwareEvidence, max: 255, dir: 'ltr' },
    ],
  },
  { name: 'run_requirements.package_managers', type: 'tags', label: t.packageManagers, maxItems: 10, itemMax: 40, dir: 'ltr' },
]

export const dataFields = ({ t }) => [
  { name: 'storage_service', type: 'textarea', label: t.storageService, max: 2000 },
  { name: 'upload_handling', type: 'textarea', label: t.uploadHandling, max: 2000 },
  { name: 'no_database', type: 'switch', label: t.noDatabase, hint: t.noDatabaseHint },
]
