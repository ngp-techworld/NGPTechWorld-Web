import { CheckCircle2, Circle, Cpu, Database, FileText, HardDrive, KeyRound, Layers, ListChecks, Plug, Server, ShieldCheck, Terminal, Variable, Wrench } from 'lucide-react'
import {
  ACCOUNT_KINDS,
  ACCOUNT_MFA_STATUSES,
  COMMAND_CLASSES,
  COMMAND_KINDS,
  CONFIDENCES,
  DOCUMENT_TYPES,
  ENDPOINT_KINDS,
  ENVIRONMENTS,
  ENV_VAR_PATTERN,
  FEATURE_STATUSES,
  INTEGRATION_TYPES,
  KEY_PATTERN,
  PUBLIC_FEATURE_STATUSES,
  RECORD_STATUSES,
  RECORD_TYPES,
  REPOSITORY_PROVIDERS,
  REPOSITORY_VISIBILITIES,
  SECRET_STATUSES,
  SEVERITIES,
  TECH_USAGES,
  URL_VERIFICATIONS,
  VAULT_REF_PATTERN,
  VISIBILITIES,
  toOptions,
} from '@/features/registry/kit'
import { Badge, Switch } from '@/ui'

// The collection configs of the project page tabs (see CollectionTab in the registry kit). Each takes `env`:
// { t (registry tab strings), r (registry kit strings), c (common), f (useFormat), pickField }.
// Field rules mirror the backend controllers (app/Http/Controllers/Admin/Registry/*Controller.php).

const TONES = {
  featureStatus: { verified: 'success', implemented_not_tested: 'info', partially_implemented: 'warning', planned: 'neutral', unknown: 'neutral' },
  usage: { active: 'success', dev_only: 'info', unused: 'neutral', unknown: 'neutral' },
  recordStatus: { open: 'warning', in_progress: 'info', done: 'success' },
  severity: { low: 'neutral', medium: 'info', high: 'warning', critical: 'danger' },
  secret: { to_create: 'warning', exists: 'success', unknown: 'neutral' },
  verification: { unverified: 'neutral', confirmed: 'success' },
  mfa: { enabled: 'success', disabled: 'danger', unknown: 'neutral' },
}

export const enumBadge = (value, labels, tones = {}) => (value ? <Badge tone={tones[value] ?? 'neutral'}>{labels?.[value] ?? value}</Badge> : null)
const code = (value) => (value ? <bdi dir="ltr" className="break-all font-mono text-[13px] text-soft">{value}</bdi> : null)
const ltrText = (value) => (value ? <bdi dir="ltr">{value}</bdi> : null)
const clip = (value, max = 90) => (value ? <span dir="auto" className="line-clamp-2 max-w-md text-sm text-soft">{String(value).length > max ? `${String(value).slice(0, max)}…` : value}</span> : null)
const count = (list, r) => (Array.isArray(list) && list.length ? <span className="text-sm text-muted">{r.countItems(list.length)}</span> : null)
const keyField = (t, r) => ({ name: 'key', type: 'text', label: t.key, required: true, max: 80, pattern: KEY_PATTERN, patternMessage: r.keyFormat, hint: t.keyHint, dir: 'ltr' })
const evidenceField = (t) => ({ name: 'evidence', type: 'lines', label: t.evidence, hint: t.evidenceHint, maxItems: 30, itemMax: 300, dir: 'ltr' })
const environmentField = (t, r) => ({ name: 'environment', type: 'select', label: t.environment, options: toOptions(ENVIRONMENTS, r.environments) })
const vaultField = (t, r) => ({ name: 'vault_ref', type: 'text', label: t.vaultRef, hint: t.vaultRefHint, max: 220, pattern: VAULT_REF_PATTERN, patternMessage: r.vaultRefFormat, dir: 'ltr', placeholder: 'vault://' })

// ───────────────────────────────────────────── public: features & tech stack

export const modulesConfig = ({ t, r, pickField }) => ({
  title: t.modulesTitle,
  description: t.modulesDescription,
  itemLabel: t.moduleLabel,
  icon: Layers,
  emptyTitle: t.noModules,
  rowName: (row) => pickField(row, 'name'),
  fields: [
    keyField(t, r),
    { name: 'name', type: 'bilingual', label: t.name, required: true, max: 255 },
    { name: 'description', type: 'bilingual', label: t.description, multiline: true, rows: 3, max: 5000 },
  ],
  columns: () => [
    { key: 'name', header: t.name, cell: (row) => <span className="font-semibold">{pickField(row, 'name')}</span> },
    { key: 'key', header: t.key, cell: (row) => code(row.key) },
    { key: 'description', header: t.description, hideBelow: 'md', cell: (row) => clip(pickField(row, 'description')) },
  ],
})

export const featuresConfig = ({ t, r, pickField }) => ({
  title: t.featuresTitle,
  description: t.featuresDescription,
  itemLabel: t.featureLabel,
  icon: ListChecks,
  emptyTitle: t.noFeatures,
  search: true,
  defaults: { status: 'unknown', is_public: false },
  rowName: (row) => pickField(row, 'name'),
  filters: [
    { name: 'status', label: t.status, options: toOptions(FEATURE_STATUSES, r.featureStatuses) },
    {
      name: 'is_public',
      label: t.isPublic,
      options: [
        { value: '1', label: r.yes },
        { value: '0', label: r.no },
      ],
    },
  ],
  fields: (ctx) => [
    keyField(t, r),
    { name: 'module_id', type: 'select', label: t.module, numeric: true, options: (ctx?.modules ?? []).map((module) => ({ value: String(module.id), label: pickField(module, 'name') })) },
    { name: 'name', type: 'bilingual', label: t.name, required: true, max: 255 },
    { name: 'description', type: 'bilingual', label: t.description, multiline: true, rows: 3, max: 5000 },
    { name: 'status', type: 'select', label: t.status, nullable: false, options: toOptions(FEATURE_STATUSES, r.featureStatuses) },
    { name: 'is_public', type: 'switch', label: t.isPublic, hint: t.isPublicHint },
    { name: 'internal', type: 'section', label: t.internalSection },
    { name: 'business_description', type: 'textarea', label: t.businessDescription, max: 5000 },
    { name: 'user_roles', type: 'tags', label: t.userRoles, maxItems: 20, itemMax: 120 },
    { name: 'main_workflow', type: 'lines', label: t.mainWorkflow, maxItems: 30, itemMax: 500 },
    evidenceField(t),
    { name: 'tests_section', type: 'section', label: t.testsSection },
    { name: 'tests.exist', type: 'switch', label: t.testsExist },
    { name: 'tests.ran', type: 'switch', label: t.testsRan },
    { name: 'tests.passed', type: 'boolSelect', label: t.testsPassed },
    { name: 'tests.paths', type: 'lines', label: t.testsPaths, maxItems: 30, itemMax: 300, dir: 'ltr' },
  ],
  columns: ({ canWrite, update, pendingData, ctx }) => [
    {
      key: 'name',
      header: t.name,
      cell: (row) => {
        const module = (ctx?.modules ?? []).find((item) => item.id === row.module_id)
        return (
          <div className="min-w-0">
            <p className="font-semibold">{pickField(row, 'name')}</p>
            <p className="text-xs text-muted">{module ? pickField(module, 'name') : code(row.key)}</p>
          </div>
        )
      },
    },
    { key: 'status', header: t.status, cell: (row) => enumBadge(row.status, r.featureStatuses, TONES.featureStatus) },
    {
      key: 'is_public',
      header: t.isPublic,
      cell: (row) => {
        const value = pendingData(row)?.is_public ?? row.is_public
        const hidden = value && !PUBLIC_FEATURE_STATUSES.includes(row.status)
        return (
          <div className="flex flex-col items-start gap-1">
            {canWrite ? (
              <Switch checked={Boolean(value)} onChange={(next) => update(row, { is_public: next })} aria-label={t.publicToggle(pickField(row, 'name'))} />
            ) : (
              <Badge tone={value ? 'success' : 'neutral'}>{value ? r.yes : r.no}</Badge>
            )}
            {hidden ? <span className="text-[11px] text-warning">{t.notOnSite}</span> : null}
          </div>
        )
      },
    },
    {
      key: 'evidence',
      header: t.evidence,
      hideBelow: 'md',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-muted">
          {count(row.evidence, r)}
          {row.tests ? <p>{t.testsSummary(Boolean(row.tests.exist), row.tests.passed)}</p> : null}
        </div>
      ),
    },
  ],
})

export const technologiesConfig = ({ t, r }) => ({
  title: t.technologiesTitle,
  description: t.technologiesDescription,
  itemLabel: t.technologyLabel,
  icon: Cpu,
  emptyTitle: t.noTechnologies,
  defaults: { usage: 'active' },
  rowName: (row) => row.technology?.name ?? `#${row.technology_id}`,
  filters: [{ name: 'usage', label: t.usage, options: toOptions(TECH_USAGES, r.techUsages) }],
  fields: (ctx) => [
    {
      name: 'technology_id',
      type: 'select',
      label: t.technology,
      required: true,
      numeric: true,
      hint: t.catalogMissing,
      options: (ctx?.catalog ?? []).map((item) => ({ value: String(item.id), label: `${item.name} · ${r.techCategories[item.category] ?? item.category}` })),
    },
    { name: 'version', type: 'text', label: t.version, max: 60, dir: 'ltr' },
    { name: 'usage', type: 'select', label: t.usage, nullable: false, options: toOptions(TECH_USAGES, r.techUsages) },
    { name: 'component', type: 'text', label: t.componentField, hint: t.componentHint, max: 60, dir: 'ltr' },
    evidenceField(t),
  ],
  columns: () => [
    { key: 'technology', header: t.technology, cell: (row) => <span className="font-semibold">{row.technology?.name ?? `#${row.technology_id}`}</span> },
    { key: 'category', header: t.category, hideBelow: 'sm', cell: (row) => (row.technology ? r.techCategories[row.technology.category] ?? row.technology.category : null) },
    { key: 'version', header: t.version, cell: (row) => ltrText(row.version) },
    { key: 'usage', header: t.usage, cell: (row) => enumBadge(row.usage, r.techUsages, TONES.usage) },
    { key: 'component', header: t.componentField, hideBelow: 'md', cell: (row) => code(row.component) },
  ],
})

export const integrationsConfig = ({ t, r }) => ({
  title: t.integrationsTitle,
  description: t.integrationsDescription,
  itemLabel: t.integrationLabel,
  icon: Plug,
  emptyTitle: t.noIntegrations,
  search: true,
  defaults: { type: 'other' },
  rowName: (row) => row.name,
  fields: [
    { name: 'name', type: 'text', label: t.name, required: true, max: 120 },
    { name: 'type', type: 'select', label: t.type, nullable: false, options: toOptions(INTEGRATION_TYPES, r.integrationTypes) },
    { name: 'env_vars', type: 'tags', label: t.envVars, hint: t.envVarsHint, maxItems: 50, itemMax: 120, itemPattern: ENV_VAR_PATTERN, patternMessage: r.envVarFormat, dir: 'ltr' },
    { name: 'notes', type: 'textarea', label: t.notes, max: 5000 },
  ],
  columns: () => [
    { key: 'name', header: t.name, cell: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'type', header: t.type, cell: (row) => enumBadge(row.type, r.integrationTypes) },
    { key: 'env_vars', header: t.envVars, hideBelow: 'sm', cell: (row) => (row.env_vars?.length ? code(row.env_vars.join(', ')) : null) },
  ],
})

// ───────────────────────────────────────────── internal

export const maintenanceRecordsConfig = ({ t, r, f }) => ({
  title: t.recordsTitle,
  description: t.recordsDescription,
  itemLabel: t.recordLabel,
  icon: Wrench,
  emptyTitle: t.noRecords,
  search: true,
  searchPlaceholder: t.searchRecords,
  sort: { sort: 'created_at', dir: 'desc' },
  defaults: { status: 'open' },
  rowName: (row) => row.title,
  filters: [
    { name: 'type', label: t.type, options: toOptions(RECORD_TYPES, r.recordTypes) },
    { name: 'status', label: t.status, options: toOptions(RECORD_STATUSES, r.recordStatuses) },
    { name: 'severity', label: t.severity, options: toOptions(SEVERITIES, r.severities) },
  ],
  fields: [
    { name: 'type', type: 'select', label: t.type, required: true, options: toOptions(RECORD_TYPES, r.recordTypes) },
    { name: 'status', type: 'select', label: t.status, nullable: false, options: toOptions(RECORD_STATUSES, r.recordStatuses) },
    { name: 'severity', type: 'select', label: t.severity, options: toOptions(SEVERITIES, r.severities) },
    { name: 'occurred_at', type: 'date', label: t.occurredAt },
    { name: 'title', type: 'text', label: t.title, required: true, max: 255, span: 'full' },
    { name: 'body', type: 'textarea', label: t.body, max: 16000, rows: 6 },
  ],
  columns: () => [
    { key: 'title', header: t.title, cell: (row) => <span dir="auto" className="font-semibold">{row.title}</span> },
    { key: 'type', header: t.type, cell: (row) => enumBadge(row.type, r.recordTypes) },
    { key: 'status', header: t.status, cell: (row) => enumBadge(row.status, r.recordStatuses, TONES.recordStatus) },
    { key: 'severity', header: t.severity, hideBelow: 'sm', cell: (row) => enumBadge(row.severity, r.severities, TONES.severity) },
    { key: 'occurred_at', header: t.occurredAt, hideBelow: 'md', cell: (row) => (row.occurred_at ? f.date(row.occurred_at) : null) },
    { key: 'author_name', header: t.author, hideBelow: 'lg', cell: (row) => row.author_name ?? (row.author_id ? t.userN(row.author_id) : null) },
  ],
})

export const DOCUMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'md', 'txt', 'docx', 'xlsx']

export const documentsConfig = ({ t, r, f }) => ({
  title: t.documentsTitle,
  description: t.documentsDescription,
  itemLabel: t.documentLabel,
  icon: FileText,
  emptyTitle: t.noDocuments,
  search: true,
  searchPlaceholder: t.searchDocuments,
  defaults: { type: 'other' },
  rowName: (row) => row.title,
  upload: { label: t.documentFile, hint: t.documentFileHint, accept: DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(','), extensions: DOCUMENT_EXTENSIONS, maxMB: 20 },
  filters: [{ name: 'type', label: t.type, options: toOptions(DOCUMENT_TYPES, r.documentTypes) }],
  fields: [
    { name: 'title', type: 'text', label: t.title, required: true, max: 255 },
    { name: 'type', type: 'select', label: t.type, nullable: false, options: toOptions(DOCUMENT_TYPES, r.documentTypes) },
  ],
  columns: () => [
    { key: 'title', header: t.title, cell: (row) => <span dir="auto" className="font-semibold">{row.title}</span> },
    { key: 'type', header: t.type, cell: (row) => enumBadge(row.type, r.documentTypes) },
    { key: 'original_name', header: t.originalName, hideBelow: 'md', cell: (row) => code(row.original_name) },
    { key: 'size', header: t.size, hideBelow: 'sm', cell: (row) => f.bytes(row.size) },
    { key: 'created_at', header: t.uploadedAt, hideBelow: 'lg', cell: (row) => f.date(row.created_at) },
  ],
})

// ───────────────────────────────────────────── sensitive: accounts & permissions

export const accountsConfig = ({ t, r }) => ({
  title: t.accountsTitle,
  description: t.accountsDescription,
  itemLabel: t.accountLabel,
  icon: KeyRound,
  emptyTitle: t.noAccounts,
  search: true,
  defaults: { mfa_status: 'unknown' },
  rowName: (row) => row.purpose,
  filters: [
    { name: 'environment', label: t.environment, options: toOptions(ENVIRONMENTS, r.environments) },
    { name: 'kind', label: t.kind, options: toOptions(ACCOUNT_KINDS, r.accountKinds) },
    { name: 'mfa_status', label: t.mfaStatus, options: toOptions(ACCOUNT_MFA_STATUSES, r.accountMfaStatuses) },
  ],
  fields: [
    { name: 'purpose', type: 'text', label: t.purpose, required: true, max: 255, span: 'full' },
    { name: 'identifier', type: 'text', label: t.identifier, max: 255, dir: 'ltr' },
    { name: 'kind', type: 'select', label: t.kind, options: toOptions(ACCOUNT_KINDS, r.accountKinds) },
    { name: 'role', type: 'text', label: t.role, max: 120 },
    environmentField(t, r),
    { name: 'owner', type: 'text', label: t.owner, max: 120 },
    { name: 'mfa_status', type: 'select', label: t.mfaStatus, nullable: false, options: toOptions(ACCOUNT_MFA_STATUSES, r.accountMfaStatuses) },
    { name: 'last_verified_at', type: 'date', label: t.lastVerifiedAt },
    { ...vaultField(t, r), span: 'full' },
  ],
  columns: () => [
    {
      key: 'purpose',
      header: t.purpose,
      cell: (row) => (
        <div className="min-w-0">
          <p dir="auto" className="font-semibold">{row.purpose}</p>
          {row.identifier ? <p className="text-xs text-muted">{ltrText(row.identifier)}</p> : null}
        </div>
      ),
    },
    { key: 'kind', header: t.kind, hideBelow: 'sm', cell: (row) => enumBadge(row.kind, r.accountKinds) },
    { key: 'environment', header: t.environment, hideBelow: 'md', cell: (row) => enumBadge(row.environment, r.environments) },
    { key: 'vault_ref', header: t.vaultRef, hideBelow: 'lg', cell: (row) => code(row.vault_ref) },
    { key: 'mfa_status', header: t.mfaStatus, cell: (row) => enumBadge(row.mfa_status, r.accountMfaStatuses, TONES.mfa) },
  ],
})

export const secretRefsConfig = ({ t, r }) => ({
  title: t.secretsTitle,
  description: t.secretsDescription,
  itemLabel: t.secretLabel,
  icon: ShieldCheck,
  emptyTitle: t.noSecrets,
  defaults: { status: 'to_create' },
  rowName: (row) => row.ref,
  filters: [
    { name: 'status', label: t.status, options: toOptions(SECRET_STATUSES, r.secretStatuses) },
    { name: 'environment', label: t.environment, options: toOptions(ENVIRONMENTS, r.environments) },
  ],
  fields: [
    { name: 'ref', type: 'text', label: t.secretRef, required: true, max: 220, pattern: VAULT_REF_PATTERN, patternMessage: r.vaultRefFormat, dir: 'ltr', placeholder: 'vault://', span: 'full' },
    { name: 'status', type: 'select', label: t.status, nullable: false, options: toOptions(SECRET_STATUSES, r.secretStatuses) },
    { name: 'provider', type: 'text', label: t.provider, max: 40 },
    environmentField(t, r),
    { name: 'purpose', type: 'textarea', label: t.purpose, max: 2000 },
    { name: 'related_env_vars', type: 'tags', label: t.relatedEnvVars, maxItems: 50, itemMax: 120, itemPattern: ENV_VAR_PATTERN, patternMessage: r.envVarFormat, dir: 'ltr' },
  ],
  columns: () => [
    {
      key: 'ref',
      header: t.secretRef,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'exists' ? <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-success" /> : <Circle size={16} aria-hidden="true" className="shrink-0 text-warning" />}
          {code(row.ref)}
        </div>
      ),
    },
    { key: 'status', header: t.status, cell: (row) => enumBadge(row.status, r.secretStatuses, TONES.secret) },
    { key: 'purpose', header: t.purpose, hideBelow: 'md', cell: (row) => clip(row.purpose) },
    { key: 'related_env_vars', header: t.relatedEnvVars, hideBelow: 'lg', cell: (row) => (row.related_env_vars?.length ? code(row.related_env_vars.join(', ')) : null) },
  ],
  rowActions: (row, { canWrite, update }) => [
    { key: 'created', label: t.markCreatedOf(row.ref), icon: CheckCircle2, hidden: !canWrite || row.status === 'exists', onClick: () => update(row, { status: 'exists' }) },
  ],
})

// ───────────────────────────────────────────── sensitive: environments & servers

export const environmentsConfig = ({ t, r }) => ({
  title: t.environmentsTitle,
  description: t.environmentsDescription,
  itemLabel: t.environmentLabel,
  icon: Layers,
  emptyTitle: t.noEnvironments,
  rowName: (row) => r.environments[row.name] ?? row.name,
  fields: [
    { name: 'name', type: 'select', label: t.name, required: true, options: toOptions(ENVIRONMENTS, r.environments) },
    { name: 'server_label', type: 'text', label: t.serverLabel, max: 120 },
    { name: 'description', type: 'textarea', label: t.description, max: 5000 },
    { name: 'config_files', type: 'tags', label: t.configFiles, maxItems: 30, itemMax: 255, dir: 'ltr' },
    { name: 'notes', type: 'textarea', label: t.notes, max: 5000 },
  ],
  columns: () => [
    { key: 'name', header: t.name, cell: (row) => enumBadge(row.name, r.environments) },
    { key: 'description', header: t.description, cell: (row) => clip(row.description) },
    { key: 'server_label', header: t.serverLabel, hideBelow: 'sm', cell: (row) => row.server_label },
    { key: 'config_files', header: t.configFiles, hideBelow: 'md', cell: (row) => count(row.config_files, r) },
  ],
})

export const endpointsConfig = ({ t, r, f }) => ({
  title: t.endpointsTitle,
  description: t.endpointsDescription,
  itemLabel: t.endpointLabel,
  icon: Plug,
  emptyTitle: t.noEndpoints,
  search: true,
  defaults: { visibility: 'private' },
  rowName: (row) => row.url,
  filters: [
    { name: 'kind', label: t.kind, options: toOptions(ENDPOINT_KINDS, r.endpointKinds) },
    { name: 'environment', label: t.environment, options: toOptions(ENVIRONMENTS, r.environments) },
    { name: 'verification_status', label: t.verification, options: toOptions(URL_VERIFICATIONS, r.urlVerifications) },
  ],
  fields: [
    { name: 'url', type: 'url', label: t.url, required: true, max: 500, span: 'full' },
    { name: 'kind', type: 'select', label: t.kind, required: true, options: toOptions(ENDPOINT_KINDS, r.endpointKinds) },
    environmentField(t, r),
    { name: 'visibility', type: 'select', label: t.visibility, nullable: false, options: toOptions(VISIBILITIES, r.visibilities) },
    { name: 'auth_required', type: 'boolSelect', label: t.authRequired },
    { name: 'purpose', type: 'textarea', label: t.purpose, max: 2000 },
    evidenceField(t),
  ],
  columns: ({ ctx }) => [
    {
      key: 'url',
      header: t.url,
      cell: (row) => (
        <div className="min-w-0">
          {code(row.url)}
          {row.purpose ? <p className="mt-0.5 line-clamp-1 text-xs text-muted" dir="auto">{row.purpose}</p> : null}
        </div>
      ),
    },
    { key: 'kind', header: t.kind, hideBelow: 'sm', cell: (row) => enumBadge(row.kind, r.endpointKinds) },
    { key: 'environment', header: t.environment, hideBelow: 'md', cell: (row) => enumBadge(row.environment, r.environments) },
    {
      key: 'verification_status',
      header: t.verification,
      cell: (row) => (
        <div className="space-y-1">
          {enumBadge(row.verification_status, r.urlVerifications, TONES.verification)}
          {row.verification_status === 'confirmed' && row.last_verified_at ? (
            <p className="text-[11px] text-muted">
              {t.verifiedBy(row.verified_by_name ?? (row.verified_by ? (ctx?.userName?.(row.verified_by) ?? t.userN(row.verified_by)) : '—'), f.dateTime(row.last_verified_at))}
            </p>
          ) : null}
        </div>
      ),
    },
  ],
  rowActions: (row, { canWrite, update }) => [
    {
      key: 'verify',
      label: row.verification_status === 'confirmed' ? t.markUnverifiedOf(row.url) : t.markVerifiedOf(row.url),
      icon: row.verification_status === 'confirmed' ? Circle : CheckCircle2,
      hidden: !canWrite,
      onClick: () => update(row, { verification_status: row.verification_status === 'confirmed' ? 'unverified' : 'confirmed' }),
    },
  ],
})

const SERVER_TEXT = [
  ['hosting_provider', 'hostingProvider'],
  ['cloud_platform', 'cloudPlatform'],
  ['os', 'os'],
  ['runtime', 'runtime'],
  ['cpu', 'cpu'],
  ['ram', 'ram'],
  ['storage_type', 'storageType'],
  ['region', 'region'],
  ['public_hostname', 'publicHostname', 'ltr'],
  ['internal_hostname', 'internalHostname', 'ltr'],
  ['ssh_access_method', 'sshAccessMethod'],
  ['responsible_administrator', 'responsibleAdministrator'],
  ['reverse_proxy', 'reverseProxy'],
  ['tls_management', 'tlsManagement'],
  ['containerization', 'containerization'],
  ['domain_provider', 'domainProvider'],
  ['dns_provider', 'dnsProvider'],
]

export const serversConfig = ({ t, r }) => ({
  title: t.serversTitle,
  description: t.serversDescription,
  itemLabel: t.serverItem,
  icon: Server,
  emptyTitle: t.noServers,
  search: true,
  modalSize: 'xl',
  rowName: (row) => row.label || row.identifier || row.public_hostname || `#${row.id}`,
  filters: [{ name: 'environment', label: t.environment, options: toOptions(ENVIRONMENTS, r.environments) }],
  fields: [
    { name: 'label', type: 'text', label: t.label, max: 120 },
    { name: 'identifier', type: 'text', label: t.serverIdentifier, max: 120, dir: 'ltr' },
    environmentField(t, r),
    { name: 'confidence', type: 'select', label: t.confidence, options: toOptions(CONFIDENCES, r.confidences) },
    { name: 'ip', type: 'text', label: t.ip, max: 64, dir: 'ltr' },
    { name: 'ssh_port', type: 'number', label: t.sshPort, min: 1, maxValue: 65535 },
    ...SERVER_TEXT.map(([name, label, dir]) => ({ name, type: 'text', label: t[label], max: 255, dir })),
    evidenceField(t),
    { name: 'notes', type: 'textarea', label: t.notes, max: 5000 },
  ],
  columns: () => [
    {
      key: 'label',
      header: t.label,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold">{row.label || row.identifier || '—'}</p>
          {row.label && row.identifier ? <p className="text-xs text-muted">{ltrText(row.identifier)}</p> : null}
        </div>
      ),
    },
    { key: 'environment', header: t.environment, cell: (row) => enumBadge(row.environment, r.environments) },
    { key: 'hosting_provider', header: t.hostingProvider, hideBelow: 'sm', cell: (row) => row.hosting_provider },
    { key: 'public_hostname', header: t.publicHostname, hideBelow: 'md', cell: (row) => code(row.public_hostname) },
    { key: 'ip', header: t.ip, hideBelow: 'lg', cell: (row) => code(row.ip) },
  ],
})

// ───────────────────────────────────────────── sensitive: deployment

export const repositoriesConfig = ({ t, r, f }) => ({
  title: t.repositoriesTitle,
  description: t.repositoriesDescription,
  itemLabel: t.repositoryLabel,
  icon: HardDrive,
  emptyTitle: t.noRepositories,
  defaults: { provider: 'unknown', visibility: 'unknown' },
  rowName: (row) => row.url,
  fields: (ctx, record) => [
    { name: 'url', type: 'text', label: t.url, required: true, max: 500, dir: 'ltr', placeholder: 'https://github.com/…', span: 'full' },
    { name: 'provider', type: 'select', label: t.provider, nullable: false, options: toOptions(REPOSITORY_PROVIDERS, r.repositoryProviders) },
    { name: 'visibility', type: 'select', label: t.visibility, nullable: false, options: toOptions(REPOSITORY_VISIBILITIES, r.repositoryVisibilities) },
    { name: 'component', type: 'text', label: t.componentField, max: 60, dir: 'ltr' },
    { name: 'main_branch', type: 'text', label: t.mainBranch, max: 100, dir: 'ltr' },
    { name: 'development_branch', type: 'text', label: t.developmentBranch, max: 100, dir: 'ltr' },
    { name: 'production_branch', type: 'text', label: t.productionBranch, max: 100, dir: 'ltr' },
    { name: 'notes', type: 'textarea', label: t.notes, max: 5000 },
    {
      name: 'snapshot_view',
      type: 'readonly',
      label: t.snapshot,
      // written by the import (git facts at discovery time); shown, never edited here
      render: () => {
        const snapshot = record?.snapshot
        if (!snapshot) return null
        return (
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
            {Object.entries(snapshot)
              .filter(([, value]) => value !== null && value !== '' && !(Array.isArray(value) && !value.length))
              .map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-faint">{key}</dt>
                  <dd dir="ltr" className="break-all font-mono text-soft">
                    {Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? String(value) : /date/.test(key) ? f.date(value) : String(value)}
                  </dd>
                </div>
              ))}
          </dl>
        )
      },
    },
  ],
  columns: () => [
    {
      key: 'url',
      header: t.url,
      cell: (row) => (
        <div className="min-w-0">
          {code(row.url)}
          {row.component ? <p className="text-xs text-muted">{ltrText(row.component)}</p> : null}
        </div>
      ),
    },
    { key: 'provider', header: t.provider, hideBelow: 'sm', cell: (row) => enumBadge(row.provider, r.repositoryProviders) },
    { key: 'visibility', header: t.visibility, hideBelow: 'md', cell: (row) => enumBadge(row.visibility, r.repositoryVisibilities) },
    { key: 'main_branch', header: t.mainBranch, hideBelow: 'lg', cell: (row) => code(row.main_branch) },
  ],
})

export const commandsConfig = ({ t, r }) => ({
  title: t.commandsTitle,
  description: t.commandsDescription,
  itemLabel: t.commandLabel,
  icon: Terminal,
  emptyTitle: t.noCommands,
  defaults: { classification: 'suggested' },
  rowName: (row) => row.command,
  filters: [
    { name: 'kind', label: t.kind, options: toOptions(COMMAND_KINDS, r.commandKinds) },
    { name: 'classification', label: t.classification, options: toOptions(COMMAND_CLASSES, r.commandClasses) },
  ],
  fields: [
    { name: 'kind', type: 'select', label: t.kind, required: true, options: toOptions(COMMAND_KINDS, r.commandKinds) },
    { name: 'classification', type: 'select', label: t.classification, nullable: false, options: toOptions(COMMAND_CLASSES, r.commandClasses) },
    { name: 'command', type: 'textarea', label: t.command, required: true, max: 2000, rows: 2, dir: 'ltr' },
    { name: 'component', type: 'text', label: t.componentField, max: 60, dir: 'ltr' },
    { name: 'evidence', type: 'text', label: t.evidence, max: 300, dir: 'ltr' },
    { name: 'purpose', type: 'textarea', label: t.purpose, max: 1000 },
  ],
  columns: () => [
    { key: 'kind', header: t.kind, cell: (row) => enumBadge(row.kind, r.commandKinds) },
    { key: 'command', header: t.command, cell: (row) => <code dir="ltr" className="block max-w-md truncate rounded-md bg-white/[.05] px-2 py-1 font-mono text-[12.5px] text-soft">{row.command}</code> },
    { key: 'component', header: t.componentField, hideBelow: 'md', cell: (row) => code(row.component) },
    { key: 'classification', header: t.classification, hideBelow: 'sm', cell: (row) => enumBadge(row.classification, r.commandClasses) },
  ],
})

export const envVarsConfig = ({ t, r }) => ({
  title: t.envVarsTitle,
  description: t.envVarsDescription,
  itemLabel: t.envVarLabel,
  icon: Variable,
  emptyTitle: t.noEnvVars,
  search: true,
  defaults: { is_secret: false },
  rowName: (row) => row.name,
  filters: [
    {
      name: 'is_secret',
      label: t.isSecret,
      options: [
        { value: '1', label: r.yes },
        { value: '0', label: r.no },
      ],
    },
  ],
  fields: [
    { name: 'name', type: 'text', label: t.envVarName, required: true, max: 120, pattern: ENV_VAR_PATTERN, patternMessage: r.envVarFormat, dir: 'ltr' },
    { name: 'component', type: 'text', label: t.componentField, max: 60, dir: 'ltr' },
    { name: 'required', type: 'boolSelect', label: t.required },
    { name: 'source_file', type: 'text', label: t.sourceFile, max: 255, dir: 'ltr' },
    { name: 'is_secret', type: 'switch', label: t.isSecret, hint: t.isSecretHint },
    { ...vaultField(t, r) },
    { name: 'purpose', type: 'textarea', label: t.purpose, max: 1000 },
  ],
  columns: () => [
    { key: 'name', header: t.envVarName, cell: (row) => code(row.name) },
    { key: 'component', header: t.componentField, hideBelow: 'sm', cell: (row) => code(row.component) },
    { key: 'purpose', header: t.purpose, hideBelow: 'md', cell: (row) => clip(row.purpose, 70) },
    { key: 'is_secret', header: t.isSecret, cell: (row) => (row.is_secret ? <Badge tone="warning">{t.isSecret}</Badge> : null) },
    { key: 'vault_ref', header: t.vaultRef, hideBelow: 'lg', cell: (row) => code(row.vault_ref) },
  ],
})

// ───────────────────────────────────────────── sensitive: database & backups

export const databasesConfig = ({ t, r }) => ({
  title: t.databasesTitle,
  description: t.databasesDescription,
  itemLabel: t.databaseLabel,
  icon: Database,
  emptyTitle: t.noDatabases,
  rowName: (row) => [row.engine, row.logical_name].filter(Boolean).join(' · '),
  fields: [
    { name: 'engine', type: 'text', label: t.engine, required: true, max: 40, dir: 'ltr', placeholder: 'PostgreSQL' },
    { name: 'version', type: 'text', label: t.version, max: 40, dir: 'ltr' },
    { name: 'logical_name', type: 'text', label: t.logicalName, max: 120, dir: 'ltr' },
    { name: 'component', type: 'text', label: t.componentField, max: 60, dir: 'ltr' },
    { name: 'orm', type: 'text', label: t.orm, max: 60, dir: 'ltr' },
    { name: 'migration_system', type: 'text', label: t.migrationSystem, max: 60, dir: 'ltr' },
    { name: 'migration_count', type: 'number', label: t.migrationCount, min: 0, maxValue: 100000 },
    { name: 'hosting', type: 'textarea', label: t.hosting, max: 1000 },
    { name: 'tables', type: 'tags', label: t.tables, maxItems: 1000, itemMax: 120, dir: 'ltr' },
    evidenceField(t),
    { name: 'notes', type: 'textarea', label: t.notes, max: 5000 },
  ],
  columns: () => [
    {
      key: 'engine',
      header: t.engine,
      cell: (row) => (
        <span className="font-semibold">
          {ltrText([row.engine, row.version].filter(Boolean).join(' '))}
        </span>
      ),
    },
    { key: 'logical_name', header: t.logicalName, cell: (row) => code(row.logical_name) },
    { key: 'component', header: t.componentField, hideBelow: 'sm', cell: (row) => code(row.component) },
    { key: 'orm', header: t.orm, hideBelow: 'md', cell: (row) => row.orm },
    { key: 'tables', header: t.tables, hideBelow: 'md', cell: (row) => count(row.tables, r) },
  ],
})

export const backupsConfig = ({ t, f }) => ({
  title: t.backupsTitle,
  description: t.backupsDescription,
  itemLabel: t.backupLabel,
  icon: HardDrive,
  emptyTitle: t.noBackups,
  rowName: (row) => row.scope || `#${row.id}`,
  fields: (ctx) => [
    {
      name: 'database_id',
      type: 'select',
      label: t.database,
      numeric: true,
      options: (ctx?.databases ?? []).map((item) => ({ value: String(item.id), label: [item.engine, item.logical_name].filter(Boolean).join(' · ') })),
    },
    { name: 'scope', type: 'text', label: t.scope, max: 120 },
    { name: 'frequency', type: 'text', label: t.frequency, max: 120 },
    { name: 'retention', type: 'text', label: t.retention, max: 120 },
    { name: 'last_tested_at', type: 'date', label: t.lastTestedAt },
    { name: 'strategy', type: 'textarea', label: t.strategy, max: 5000 },
    { name: 'recovery_procedure', type: 'textarea', label: t.recoveryProcedure, max: 10000, rows: 5 },
    { name: 'monitoring', type: 'textarea', label: t.monitoring, max: 2000 },
  ],
  columns: ({ ctx }) => [
    { key: 'scope', header: t.scope, cell: (row) => <span dir="auto" className="font-semibold">{row.scope || '—'}</span> },
    {
      key: 'database_id',
      header: t.database,
      hideBelow: 'sm',
      cell: (row) => {
        const database = (ctx?.databases ?? []).find((item) => item.id === row.database_id)
        return database ? ltrText([database.engine, database.logical_name].filter(Boolean).join(' · ')) : null
      },
    },
    { key: 'frequency', header: t.frequency, cell: (row) => row.frequency },
    { key: 'retention', header: t.retention, hideBelow: 'md', cell: (row) => row.retention },
    { key: 'last_tested_at', header: t.lastTestedAt, hideBelow: 'lg', cell: (row) => (row.last_tested_at ? f.date(row.last_tested_at) : null) },
  ],
})
