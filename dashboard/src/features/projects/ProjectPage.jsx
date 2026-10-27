import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'
import { Cpu, Database, FileStack, FileText, Gauge, Image as ImageIcon, Images, KeyRound, Link2, ListChecks, Rocket, Server, ShieldAlert, Users, Wrench } from 'lucide-react'
import { GroupForm, industriesCatalog, localizeErrors, registryStrings } from '@/features/registry/kit'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { ApiError } from '@/lib/api'
import { Alert, FormActions, PageSpinner, TabPanel } from '@/ui'
import { GroupedTabs } from './GroupedTabs'
import { LinksTab } from './LinksTab'
import { GeneralFields, MediaFields } from './ProjectFields'
import { RegistryPublicFields } from './RegistryPublicFields'
import { ProjectSectionsCard } from './sections/ProjectSectionsCard'
import { TeamTab } from './TeamTab'
import { OVERVIEW_FIELDS, changedOverviewPayload, makeOverviewSchema, toFormErrorKey, toOverviewValues } from './overviewSchema'
import { MediaScreenshotsNote } from './registry/MediaScreenshotsNote'
import { MembersCard } from './registry/MembersCard'
import { PublicationCard } from './registry/PublicationCard'
import { administrationFields } from './registry/groups'
import registryTabStrings from './registry/strings'
import { useRegistryEnv } from './registry/useRegistryEnv'
import { TAB_FIELDS, changedPayload, makeProjectSchema, toFormValues } from './schema'
import strings from './strings'

// The registry tabs are loaded when first opened (most visits only need the Overview): one chunk for tabs.jsx.
const fromTabs = (name) => lazy(() => import('./registry/tabs').then((module) => ({ default: module[name] })))
const FeaturesTab = fromTabs('FeaturesTab')
const TechStackTab = fromTabs('TechStackTab')
const MaintenanceTab = fromTabs('MaintenanceTab')
const DocumentsTab = fromTabs('DocumentsTab')
const AccountsTab = fromTabs('AccountsTab')
const EnvironmentsTab = fromTabs('EnvironmentsTab')
const DeploymentTab = fromTabs('DeploymentTab')
const DataTab = fromTabs('DataTab')
const ScreenshotsTab = lazy(() => import('./registry/ScreenshotsTab').then((module) => ({ default: module.ScreenshotsTab })))
const NonFunctionalTab = lazy(() => import('./registry/NonFunctionalTab').then((module) => ({ default: module.NonFunctionalTab })))

const PREFIX = 'project'
const FORM_TABS = ['overview', 'media']

/**
 * Every tab of the project page: its group, the ability that lets the caller READ it (tabs a caller may not read are
 * absent, not disabled) and whether it needs the registry API (a backend without it still gets the original tabs).
 */
export const PROJECT_TABS = [
  { key: 'overview', group: 'public', ability: 'view', icon: FileText, label: 'tabOverview' },
  { key: 'media', group: 'public', ability: 'view', icon: Images, label: 'tabMedia' },
  { key: 'features', group: 'public', ability: 'view', icon: ListChecks, label: 'tabFeatures', registry: true },
  { key: 'tech', group: 'public', ability: 'view', icon: Cpu, label: 'tabTech', registry: true },
  { key: 'screenshots', group: 'public', ability: 'view', icon: ImageIcon, label: 'tabScreenshots', registry: true },
  { key: 'team', group: 'public', ability: 'view', icon: Users, label: 'tabTeam' },
  { key: 'links', group: 'public', ability: 'view', icon: Link2, label: 'tabLinks' },
  { key: 'nonfunctional', group: 'internal', ability: 'viewInternal', icon: Gauge, label: 'tabNonfunctional', registry: true },
  { key: 'maintenance', group: 'internal', ability: 'viewInternal', icon: Wrench, label: 'tabMaintenance', registry: true },
  { key: 'documents', group: 'internal', ability: 'viewInternal', icon: FileStack, label: 'tabDocuments', registry: true },
  { key: 'accounts', group: 'sensitive', ability: 'viewSensitive', icon: KeyRound, label: 'tabAccounts', registry: true },
  { key: 'environments', group: 'sensitive', ability: 'viewSensitive', icon: Server, label: 'tabEnvironments', registry: true },
  { key: 'deployment', group: 'sensitive', ability: 'viewSensitive', icon: Rocket, label: 'tabDeployment', registry: true },
  { key: 'data', group: 'sensitive', ability: 'viewSensitive', icon: Database, label: 'tabData', registry: true },
]

// Without the registry record, only what the parent could establish (ProjectEdit `fallbackFor`): read-only by default.
const READ_ONLY = { view: true }

/** The tab keys `abilities` lets the caller read. */
export const visibleTabKeys = (abilities, hasRegistry) =>
  PROJECT_TABS.filter((tab) => (hasRegistry || !tab.registry) && abilities?.[tab.ability]).map((tab) => tab.key)

const ALIASES = { general: 'overview' }

/** Active tab in the URL (`?tab=team`); an unknown or unreadable tab falls back to the Overview. */
function useActiveTab(keys) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const wanted = ALIASES[raw] ?? raw
  const tab = keys.includes(wanted) ? wanted : 'overview'
  const setTab = useCallback(
    (next) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (next === 'overview') params.delete('tab')
          else params.set('tab', next)
          return params
        },
        { replace: true },
      ),
    [setSearchParams],
  )
  return [tab, setTab]
}

const countErrors = (errors, fields) => fields.filter((name) => get(errors, name)).length

/**
 * The project page (`/projects/:id?tab=`). One react-hook-form instance holds the Overview + Media fields (the
 * original `PUT /projects/{id}`, partial: only changed fields are sent; both panels stay mounted so values and
 * server errors survive tab switches). Everything else is saved live: publication actions, the administration group,
 * members, and the registry tabs (each its own requests). `registry` is the registry record (abilities, operations
 * groups, completeness) or null when the registry API could not be read; `fallbackAbilities` then say what the caller
 * may do with the original record (read-only unless the parent knows better).
 */
export function ProjectPage({ project, registry, fallbackAbilities = READ_ONLY, onSubmit, saving = false }) {
  const c = useCommon()
  const t = useStrings(strings)
  const rt = useStrings(registryTabStrings)
  const r = useStrings(registryStrings)
  const f = useFormat()
  const env = useRegistryEnv()
  const hasRegistry = Boolean(registry)
  const abilities = registry?.abilities ?? fallbackAbilities
  const canEdit = Boolean(abilities.updatePublic)
  const keys = useMemo(() => visibleTabKeys(abilities, hasRegistry), [abilities, hasRegistry])
  const [tab, setTab] = useActiveTab(keys)
  // a tab opened once stays mounted (hidden): unsaved edits of its groups and dialogs survive a tab switch
  const [visited, setVisited] = useState(() => new Set([tab]))
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]))
  const [coverBusy, setCoverBusy] = useState(false)
  const [galleryBusy, setGalleryBusy] = useState(false)
  const uploading = coverBusy || galleryBusy
  const industries = industriesCatalog.useList({ per_page: 200, sort: 'order', dir: 'asc' }, { enabled: hasRegistry }).rows
  const adminFields = useMemo(() => administrationFields(env), [env])

  // the registry mode is decided once per mount (the parent keys this page by project and mode)
  const toValues = hasRegistry ? toOverviewValues : toFormValues
  const changed = hasRegistry ? changedOverviewPayload : changedPayload
  const fieldsOf = useMemo(() => ({ overview: hasRegistry ? OVERVIEW_FIELDS : TAB_FIELDS.general, media: TAB_FIELDS.media }), [hasRegistry])
  const schema = useMemo(() => (hasRegistry ? makeOverviewSchema(c, t, rt, r) : makeProjectSchema(c, t)), [hasRegistry, c, t, rt, r])
  const baseline = useRef(null)
  if (baseline.current === null) baseline.current = toValues(project)
  const pendingFocus = useRef(null)

  const form = useForm({ resolver: zodResolver(schema), defaultValues: baseline.current })
  const {
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors, isDirty },
  } = form

  const tabOfField = (name) => FORM_TABS.find((key) => fieldsOf[key].some((field) => name === field || name.startsWith(`${field}.`)))
  // Failed submit (client or server): if the open tab has no error, jump to the tab of the first one and focus it.
  const reveal = (names) => {
    const first = names.find((name) => tabOfField(name))
    if (!first || names.some((name) => tabOfField(name) === tab)) return
    pendingFocus.current = first
    setTab(tabOfField(first))
  }
  useEffect(() => {
    if (!pendingFocus.current) return
    setFocus(pendingFocus.current)
    pendingFocus.current = null
  }, [tab, setFocus])

  const submit = handleSubmit(
    async (values) => {
      const payload = changed(baseline.current, values)
      if (!Object.keys(payload).length) return
      try {
        const saved = await onSubmit(payload)
        if (saved) {
          const next = toValues(saved)
          baseline.current = next
          reset(next)
        }
      } catch (err) {
        const mapped =
          err instanceof ApiError && err.status === 422
            ? new ApiError({ status: 422, message: err.message, errors: Object.fromEntries(Object.entries(err.errors).map(([key, messages]) => [toFormErrorKey(key), messages])), data: err.data })
            : err
        if (applyServerErrors(setError, localizeErrors(mapped, r))) reveal(Object.keys(mapped.errors))
      }
    },
    (fieldErrors) => reveal(Object.keys(fieldErrors)),
  )

  const errorBadge = (count) =>
    count ? (
      <>
        <span aria-hidden="true" className="text-danger">
          {f.number(count)}
        </span>
        <span className="sr-only"> {t.tabErrors(count)}</span>
      </>
    ) : undefined

  const badges = {
    overview: errorBadge(countErrors(errors, fieldsOf.overview)),
    media: errorBadge(countErrors(errors, fieldsOf.media)),
    team: f.number(project.team_members_count ?? 0),
    links: f.number(project.links_count ?? 0),
  }
  const labels = { ...rt, tabMedia: t.tabMedia, tabTeam: t.tabTeam, tabLinks: t.tabLinks }
  const groups = [
    { key: 'public', label: rt.groupPublic },
    { key: 'internal', label: rt.groupInternal },
    { key: 'sensitive', label: rt.groupSensitive, hint: rt.groupSensitiveHint, icon: ShieldAlert, tone: 'danger' },
  ].map((group) => ({
    ...group,
    tabs: PROJECT_TABS.filter((item) => item.group === group.key && keys.includes(item.key)).map((item) => ({ key: item.key, label: labels[item.label], icon: item.icon, badge: badges[item.key] })),
  }))
  const isFormTab = FORM_TABS.includes(tab)
  const panel = (key, children, props = {}) => (
    <TabPanel idPrefix={PREFIX} value={key} active={tab} {...props} keepMounted={props.keepMounted || visited.has(key)}>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </TabPanel>
  )
  const actions = canEdit ? <FormActions saving={saving} dirty={isDirty} disabled={uploading} cancelTo={hasRegistry ? undefined : '/projects'} sticky /> : null

  return (
    <div className="space-y-5">
      <GroupedTabs groups={groups} value={tab} onChange={setTab} idPrefix={PREFIX} />

      {panel(
        'overview',
        <>
          {hasRegistry ? <PublicationCard registry={registry} /> : null}
          {!canEdit ? <Alert tone="info">{rt.readOnlyContent}</Alert> : null}
          <form onSubmit={submit} noValidate aria-label={rt.formLabel} className="space-y-5">
            <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
              <GeneralFields form={form} isEdit showStatus={!hasRegistry} showFeatured={!hasRegistry} featuredNote={hasRegistry ? rt.featuredMoved : undefined} />
              {hasRegistry ? <RegistryPublicFields form={form} industries={industries} /> : null}
            </fieldset>
            {actions}
          </form>
          {/* only when the API knows per-project section layouts */}
          {'section_layout' in project ? <ProjectSectionsCard project={project} canWrite={canEdit} /> : null}
          {hasRegistry && registry.operations?.administration ? (
            <GroupForm
              projectId={registry.id}
              group="administration"
              title={rt.administrationTitle}
              description={rt.administrationDescription}
              values={registry.operations.administration}
              fields={adminFields}
              canWrite={abilities.updateInternal}
            />
          ) : null}
          {hasRegistry && abilities.viewInternal ? <MembersCard registry={registry} /> : null}
        </>,
        { keepMounted: true, className: 'space-y-5' },
      )}

      {panel(
        'media',
        <>
          {/* imported projects keep their pictures as screenshots: say where the public page's images are */}
          {hasRegistry && visited.has('media') ? <MediaScreenshotsNote registryId={registry.id} project={project} onOpen={() => setTab('screenshots')} /> : null}
          <form onSubmit={submit} noValidate aria-label={t.tabMedia} className="space-y-5">
            <fieldset disabled={!canEdit} className="min-w-0">
              <MediaFields form={form} project={project} onCoverBusy={setCoverBusy} onGalleryBusy={setGalleryBusy} />
            </fieldset>
            {actions}
          </form>
        </>,
        { keepMounted: true, className: 'space-y-5' },
      )}

      {!isFormTab && isDirty ? <Alert tone="warning">{t.unsavedOnNested}</Alert> : null}

      {panel('features', hasRegistry ? <FeaturesTab registry={registry} /> : null)}
      {panel('tech', hasRegistry ? <TechStackTab registry={registry} /> : null)}
      {panel('screenshots', hasRegistry ? <ScreenshotsTab registry={registry} /> : null)}
      {panel('team', <TeamTab projectId={project.id} canWrite={canEdit} />)}
      {panel('links', <LinksTab projectId={project.id} canWrite={canEdit} />)}
      {panel('nonfunctional', hasRegistry ? <NonFunctionalTab registry={registry} /> : null)}
      {panel('maintenance', hasRegistry ? <MaintenanceTab registry={registry} /> : null)}
      {panel('documents', hasRegistry ? <DocumentsTab registry={registry} /> : null)}
      {panel('accounts', hasRegistry ? <AccountsTab registry={registry} /> : null)}
      {panel('environments', hasRegistry ? <EnvironmentsTab registry={registry} /> : null)}
      {panel('deployment', hasRegistry ? <DeploymentTab registry={registry} /> : null)}
      {panel('data', hasRegistry ? <DataTab registry={registry} /> : null)}
    </div>
  )
}
