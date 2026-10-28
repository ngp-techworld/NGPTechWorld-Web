import { AccessSection } from './Access'
import { DataSection } from './Data'
import { DeploymentSection } from './Deployment'
import { DocumentsSection } from './Documents'
import { EnvironmentsSection } from './Environments'
import { FeaturesSection } from './Features'
import { IntegrationsSection } from './Integrations'
import { MaintenanceSection } from './Maintenance'
import { OverviewSection } from './Overview'
import { QualitySection } from './Quality'
import { ScreenshotsSection } from './Screenshots'
import { hasAdministration, TeamSection } from './Team'
import { TechnologiesSection } from './Technologies'

export { SummarySection } from './Summary'

const filled = (value) => value !== null && value !== undefined && value !== '' && value !== false && !(Array.isArray(value) && !value.length)
/** Does this operations group of the record hold anything (a group the caller may not read is absent)? */
const hasGroup = (record, group) => Object.values(record.operations?.[group] ?? {}).some(filled)
const hasRows = (...segments) => ({ data }) => segments.some((segment) => data[segment].rows.length > 0)

/**
 * The sections of the dossier after its summary, in reading order. Each says its tier (whose ability decides whether
 * it exists at all), the collections it reads, the completeness checks it answers for (shown as "not recorded yet"
 * while they are missing) and whether it holds anything: a section with nothing to show and nothing missing is left out.
 */
export const SECTIONS = [
  {
    key: 'overview',
    tier: 'public',
    segments: [],
    hints: ['short_ar', 'short_en', 'description_ar', 'description_en', 'business_problem', 'solution', 'industry'],
    hasData: () => true,
    Component: OverviewSection,
  },
  {
    key: 'team',
    tier: 'internal',
    segments: ['members'],
    hints: ['owner', 'technical_lead'],
    hasData: ({ record, data }) => hasAdministration(record) || data.members.rows.length > 0,
    Component: TeamSection,
  },
  {
    key: 'access',
    tier: 'sensitive',
    segments: ['accounts', 'secret-refs'],
    hints: [],
    hasData: ({ record, data }) => hasGroup(record, 'auth') || hasRows('accounts', 'secret-refs')({ data }),
    Component: AccessSection,
  },
  {
    key: 'environments',
    tier: 'sensitive',
    segments: ['environments', 'endpoints', 'servers'],
    hints: ['environments'],
    hasData: hasRows('environments', 'endpoints', 'servers'),
    Component: EnvironmentsSection,
  },
  {
    key: 'deployment',
    tier: 'sensitive',
    segments: ['repositories', 'commands', 'env-vars'],
    hints: ['repositories', 'deployment_method', 'runbook'],
    hasData: ({ record, data }) => hasGroup(record, 'deployment') || hasRows('repositories', 'commands', 'env-vars')({ data }),
    Component: DeploymentSection,
  },
  {
    key: 'data',
    tier: 'sensitive',
    segments: ['databases', 'backups'],
    hints: ['database', 'backup_strategy'],
    hasData: ({ record, data }) => hasGroup(record, 'data') || hasRows('databases', 'backups')({ data }),
    Component: DataSection,
  },
  { key: 'features', tier: 'public', segments: ['modules', 'features'], hints: ['modules', 'features'], hasData: hasRows('modules', 'features'), Component: FeaturesSection },
  { key: 'quality', tier: 'internal', segments: ['quality-attributes'], hints: [], hasData: hasRows('quality-attributes'), Component: QualitySection },
  { key: 'technologies', tier: 'public', segments: ['technologies'], hints: ['technologies'], hasData: hasRows('technologies'), Component: TechnologiesSection },
  {
    key: 'maintenance',
    tier: 'internal',
    segments: ['maintenance-records'],
    hints: [],
    hasData: ({ record, data }) => hasGroup(record, 'monitoring') || data['maintenance-records'].rows.length > 0,
    Component: MaintenanceSection,
  },
  { key: 'integrations', tier: 'internal', segments: ['integrations'], hints: [], hasData: hasRows('integrations'), Component: IntegrationsSection },
  { key: 'documents', tier: 'internal', segments: ['documents'], hints: [], hasData: hasRows('documents'), Component: DocumentsSection },
  { key: 'screenshots', tier: 'public', segments: ['screenshots'], hints: ['public_screenshot', 'cover'], hasData: hasRows('screenshots'), Component: ScreenshotsSection },
]

/** The completeness checks still missing, from every group of `completeness`. */
export const missingChecks = (completeness) =>
  new Set(
    Object.values(completeness ?? {})
      .filter((group) => group && typeof group === 'object' && Array.isArray(group.missing))
      .flatMap((group) => group.missing),
  )
