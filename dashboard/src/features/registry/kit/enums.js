// Value lists of the project registry — mirrors of the backend's `App\Registry\Enums` (and the operations groups of
// `App\Models\ProjectOperations`). The API stays the source of truth: an unknown value is refused there with a 422.
export const CATEGORIES = ['web', 'mobile', 'ai', 'design', 'erp']
export const DEVELOPMENT_STATUSES = ['idea', 'planning', 'in_development', 'testing', 'completed', 'maintenance', 'paused', 'archived']
export const DEPLOYMENT_STATUSES = ['not_deployed', 'internal', 'staging', 'production', 'unknown']
export const PUBLICATION_STATUSES = ['draft', 'published']
export const PLATFORMS = ['web', 'android', 'ios', 'windows', 'macos', 'linux', 'api', 'cli', 'other']
export const FEATURE_STATUSES = ['verified', 'implemented_not_tested', 'partially_implemented', 'planned', 'unknown']
/** Only features in these statuses ever reach the public site, whatever their `is_public` says. */
export const PUBLIC_FEATURE_STATUSES = ['verified', 'implemented_not_tested']
export const TECH_CATEGORIES = [
  'frontend', 'backend', 'language', 'database', 'orm', 'authentication', 'authorization', 'api', 'integration', 'storage',
  'cloud', 'containerization', 'ci_cd', 'monitoring', 'testing', 'mobile', 'tooling', 'other',
]
export const TECH_USAGES = ['active', 'dev_only', 'unused', 'unknown']
export const SCREENSHOT_PLATFORMS = ['desktop', 'mobile', 'mobile-web', 'tablet']
export const CONTENT_LANGUAGES = ['ar', 'en']
export const MEMBER_ROLES = ['owner', 'manager', 'tech_lead', 'developer', 'designer', 'qa', 'other']
export const ENVIRONMENTS = ['local', 'development', 'staging', 'demo', 'production']
export const ENDPOINT_KINDS = ['public_site', 'production', 'staging', 'demo', 'admin', 'api', 'api_docs', 'docs', 'store_android', 'store_ios', 'other']
export const VISIBILITIES = ['public', 'private']
export const URL_VERIFICATIONS = ['unverified', 'confirmed']
export const MFA_LEVELS = ['none', 'optional', 'required', 'unknown']
export const ACCOUNT_KINDS = ['super_administrator', 'administrator', 'staff', 'customer', 'test', 'other']
export const ACCOUNT_MFA_STATUSES = ['enabled', 'disabled', 'unknown']
export const SECRET_STATUSES = ['to_create', 'exists', 'unknown']
export const PRIORITIES = ['low', 'medium', 'high', 'critical']
export const SUPPORT_STATUSES = ['active', 'limited', 'ended']
export const SEVERITIES = ['low', 'medium', 'high', 'critical']
export const RECORD_TYPES = ['maintenance', 'incident', 'risk', 'task', 'note']
export const RECORD_STATUSES = ['open', 'in_progress', 'done']
export const DOCUMENT_TYPES = ['architecture', 'manual', 'specification', 'report', 'diagram', 'contract', 'other']
export const COMMAND_KINDS = ['install', 'dev', 'build', 'start', 'test', 'migrate', 'seed', 'other']
export const COMMAND_CLASSES = ['confirmed_in_repo', 'tested', 'suggested']
export const QUALITY_ATTRIBUTES = [
  'security', 'performance', 'scalability', 'reliability', 'availability', 'maintainability', 'usability', 'accessibility',
  'localization', 'compatibility', 'logging', 'monitoring', 'backup', 'disaster_recovery', 'testing', 'deployment_automation',
]
export const INTEGRATION_TYPES = ['payment', 'email', 'sms', 'push', 'maps', 'analytics', 'storage', 'auth', 'ai', 'other']
export const REPOSITORY_PROVIDERS = ['github', 'gitlab', 'bitbucket', 'azure', 'self_hosted', 'none', 'unknown']
export const REPOSITORY_VISIBILITIES = ['public', 'private', 'unknown']
export const CONFIDENCES = ['confirmed', 'inferred', 'missing']
export const DEVELOPER_SOURCES = ['git', 'user']

/** Completeness groups and the keys of their checks (`App\Registry\Completeness`). */
export const COMPLETENESS_GROUPS = ['documentation', 'screenshots', 'operations']
export const COMPLETENESS_CHECKS = {
  documentation: ['name_ar', 'name_en', 'short_ar', 'short_en', 'description_ar', 'description_en', 'business_problem', 'solution', 'industry', 'modules', 'features', 'technologies'],
  screenshots: ['public_screenshot', 'cover'],
  operations: ['owner', 'technical_lead', 'repositories', 'environments', 'deployment_method', 'database', 'backup_strategy', 'runbook'],
}

/** What publishing needs (the keys of a publish 422 `errors.publication`, plus `archived`). */
export const PUBLICATION_REQUIREMENTS = ['name_ar', 'name_en', 'short_ar', 'short_en', 'description_ar', 'description_en', 'category', 'cover']

/** Operations groups that can be edited (`PUT …/operations/{group}`) and the tier that guards each. */
export const GROUP_TIERS = { administration: 'internal', monitoring: 'internal', auth: 'sensitive', deployment: 'sensitive', data: 'sensitive' }

/** The per-project abilities every registry payload carries (`ProjectPolicy::PROJECT_ABILITIES`). */
export const PROJECT_ABILITIES = ['view', 'updatePublic', 'publish', 'viewInternal', 'updateInternal', 'viewSensitive', 'updateSensitive', 'manageMembers', 'archive', 'restore', 'delete']

/** Development statuses grouped the way the overview counts them (`RegistryProjectController::overview`). */
export const STATUS_GROUPS = {
  active: ['planning', 'in_development', 'testing', 'maintenance'],
  under_development: ['in_development', 'testing'],
}

export const AUDIT_ACTIONS = ['created', 'updated', 'deleted', 'published', 'unpublished', 'featured', 'unfeatured', 'archived', 'restored', 'reordered', 'member_added', 'member_removed', 'viewed_sensitive']
export const AUDIT_SUBJECTS = [
  'Project', 'ProjectModule', 'ProjectFeature', 'ProjectTechnology', 'ProjectScreenshot', 'ProjectMember', 'Industry', 'Technology',
  'TeamMember', 'ProjectLink', 'User', 'ProjectOperations', 'ProjectQualityAttribute', 'ProjectMaintenanceRecord', 'ProjectDocument',
  'ProjectIntegration', 'ProjectRepository', 'ProjectEnvironment', 'ProjectEndpoint', 'ProjectServer', 'ProjectAccount',
  'ProjectSecretRef', 'ProjectDatabase', 'ProjectBackup', 'ProjectEnvVar', 'ProjectCommand',
]

export const KEY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
export const ENV_VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
export const VAULT_REF_PATTERN = /^vault:\/\/[a-z0-9][a-z0-9/_.-]{2,200}$/
