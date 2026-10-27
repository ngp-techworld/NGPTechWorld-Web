import { createContext, useContext, useMemo } from 'react'
import * as collections from '@/features/projects/registry/collections'
import * as groups from '@/features/projects/registry/groups'
import { useRegistryEnv } from '@/features/projects/registry/useRegistryEnv'
import projectStrings from '@/features/projects/strings'
import { useStrings } from '@/i18n'

// Field labels of the preview: the project page's own labels where the keys match (the collection configs, the
// operations group field lists and the project form), otherwise the key humanized. The configs are looked up by name
// (`collections[name]`), so a renamed or removed one only falls back to the humanized key.

/** Preview section → collection config of the project page (projects/registry/collections.jsx). */
const COLLECTION_CONFIGS = {
  modules: 'modulesConfig',
  features: 'featuresConfig',
  technologies: 'technologiesConfig',
  integrations: 'integrationsConfig',
  maintenance: 'maintenanceRecordsConfig',
  accounts: 'accountsConfig',
  secret_refs: 'secretRefsConfig',
  environments: 'environmentsConfig',
  endpoints: 'endpointsConfig',
  servers: 'serversConfig',
  repositories: 'repositoriesConfig',
  commands: 'commandsConfig',
  env_vars: 'envVarsConfig',
  databases: 'databasesConfig',
  backups: 'backupsConfig',
}

/** Preview section → operations group field list (projects/registry/groups.js). */
const GROUP_FIELDS = {
  administration: 'administrationFields',
  monitoring: 'monitoringFields',
  auth: 'authFields',
  deployment: 'deploymentFields',
  data: 'dataFields',
}

/** 'deploy_method' → 'Deploy method', 'tests.exist' → 'Tests exist'. */
export function humanize(key) {
  const text = String(key ?? '')
    .replace(/[._|-]+/g, ' ')
    .trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

/** A field list of the registry kit → { name: label } (a bilingual field gives `name_ar` / `name_en` too). */
function fromFieldList(fields, languages) {
  const map = {}
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!field?.name || !field.label || field.type === 'section') continue
    map[field.name] = field.label
    if (field.type === 'bilingual') {
      map[`${field.name}_ar`] = `${field.label} (${languages.ar})`
      map[`${field.name}_en`] = `${field.label} (${languages.en})`
    }
  }
  return map
}

function safely(build) {
  try {
    return build() ?? {}
  } catch {
    return {}
  }
}

/** { sectionKey: { field: label } } in the current language. */
function buildLabels(env, pt) {
  const { t: rt, c, r } = env
  const languages = { ar: c.arabic, en: c.english }
  const maps = {}

  for (const [section, name] of Object.entries(COLLECTION_CONFIGS)) {
    maps[section] = safely(() => {
      const config = collections[name]?.(env)
      const fields = typeof config?.fields === 'function' ? config.fields({}, {}) : config?.fields
      return fromFieldList(fields, languages)
    })
  }
  for (const [section, name] of Object.entries(GROUP_FIELDS)) maps[section] = safely(() => fromFieldList(groups[name]?.(env), languages))

  maps.project = {
    name: pt.name,
    short: pt.short,
    description: pt.descriptionField,
    slug: pt.slug,
    category: pt.category,
    client: pt.client,
    year: pt.year,
    featured: pt.featured,
    cover_image: pt.cover,
    gallery: pt.gallery,
    video_url: pt.video,
    status: c.status,
    industry: rt.industry,
    industry_id: rt.industry,
    development_status: rt.developmentStatus,
    deployment_status: rt.deploymentStatus,
    public_demo_url: rt.publicDemoUrl,
    platforms: rt.platforms,
    business_problem: rt.businessProblem,
    solution: rt.solution,
    target_customers: rt.targetCustomers,
    target_users: rt.targetUsers,
    highlights: rt.highlights,
    technical_highlights: rt.technicalHighlights,
    nonfunctional_highlights: rt.nonfunctionalHighlights,
  }
  maps.quality = { implemented: rt.implemented, verified: rt.verified, assumptions: rt.assumptions, recommendations: rt.recommendations }

  return { maps, languages, qualityNames: r.qualityAttributes ?? {} }
}

function resolve({ maps, languages }, section, field) {
  const map = maps[section] ?? {}
  const key = String(field ?? '')
  if (map[key]) return map[key]
  const pair = /^(.+)_(ar|en)$/.exec(key)
  if (pair && map[pair[1]]) return `${map[pair[1]]} (${languages[pair[2]]})`
  return humanize(key)
}

function makeLabels(env, pt) {
  const built = buildLabels(env, pt)
  return {
    fieldLabel: (section, field) => resolve(built, section, field),
    refLabel: (section, ref) => {
      if (ref === null || ref === undefined || ref === '') return null
      if (section === 'quality' && built.qualityNames[ref]) return built.qualityNames[ref]
      return String(ref).split('|').join(' · ')
    },
  }
}

const LabelsContext = createContext(null)

/** Builds the labels once for a whole preview or report (every row reads them through `useFieldLabels`). */
export function FieldLabelsProvider({ children }) {
  const env = useRegistryEnv()
  const pt = useStrings(projectStrings)
  const value = useMemo(() => makeLabels(env, pt), [env, pt])
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>
}

/**
 * `const { fieldLabel, refLabel } = useFieldLabels()`:
 *   fieldLabel('features', 'name_ar') → 'Name (Arabic)'   ·   fieldLabel('deployment', 'deploy_method') → 'Deployment method'
 *   refLabel('quality', 'security') → 'Security'           ·   refLabel('env_vars', 'backend|DB_HOST') → 'backend · DB_HOST'
 * Inside a FieldLabelsProvider the shared tables are used; elsewhere they are built for the caller.
 */
export function useFieldLabels() {
  const shared = useContext(LabelsContext)
  const env = useRegistryEnv()
  const pt = useStrings(projectStrings)
  return useMemo(() => shared ?? makeLabels(env, pt), [shared, env, pt])
}

/** `<section>.<ref>.<field>` / `<section>.<field>` → `{ ref, field }` (only to label an error; paths stay opaque). */
export function splitPath(path, section) {
  const parts = String(path ?? '').split('.')
  if (parts[0] === section) parts.shift()
  if (parts.length <= 1) return { ref: null, field: parts[0] ?? '' }
  return { ref: parts.slice(0, -1).join('.'), field: parts.at(-1) }
}
