import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'
import { FileText, Images, Link2, Lock, Save, Users } from 'lucide-react'
import { useCommon, useFormat, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { Alert, Button, Card, EmptyState, FormActions, TabPanel, Tabs } from '@/ui'
import { GeneralFields, MediaFields } from './ProjectFields'
import { LinksTab } from './LinksTab'
import { TeamTab } from './TeamTab'
import { TAB_FIELDS, changedPayload, emptyProject, makeProjectSchema, toFormValues, toPayload } from './schema'
import strings from './strings'

const FORM_ID = 'project-form'
const TAB_KEYS = ['general', 'media', 'team', 'links']
const PREFIX = 'project'

const tabOfField = (name) => Object.keys(TAB_FIELDS).find((key) => TAB_FIELDS[key].some((field) => name === field || name.startsWith(`${field}.`)))
const countErrors = (errors, fields) => fields.filter((name) => get(errors, name)).length

/** Active tab lives in the URL (`?tab=team`) so links, refresh and the redirect after "create" can target a tab. */
function useActiveTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  const tab = TAB_KEYS.includes(raw) ? raw : 'general'
  const setTab = useCallback(
    (next) =>
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (next === 'general') params.delete('tab')
          else params.set('tab', next)
          return params
        },
        { replace: true },
      ),
    [setSearchParams],
  )
  return [tab, setTab]
}

/** What the Team / Links tabs show on the create page: nothing can be attached to a project that does not exist yet. */
function SaveFirst({ description, busy, saving }) {
  const t = useStrings(strings)
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title={t.saveFirstTitle}
        description={description}
        action={
          <Button type="submit" form={FORM_ID} icon={Save} loading={saving} disabled={busy}>
            {t.saveAndContinue}
          </Button>
        }
      />
    </Card>
  )
}

/**
 * The whole project in ONE react-hook-form instance, split over tabs:
 *   General + Media  → the form (saved with the Save button; both panels stay mounted so their values and server
 *                      errors survive tab switches, and the tabs show an error count);
 *   Team + Links     → live nested CRUD on the existing project (their own modals and requests, no Save button).
 *
 * `onSubmit(payload)` returns a promise. Create sends every field; edit sends only the changed ones and, when the
 * promise resolves with the saved record, the form is re-based on it (an explicit reset after a save — never on a
 * background refetch, so what the user is typing is not replaced).
 */
export function ProjectForm({ project, defaultValues = emptyProject(), onSubmit, saving = false, isEdit = false, listTo = '/projects' }) {
  const c = useCommon()
  const t = useStrings(strings)
  const f = useFormat()
  const schema = useMemo(() => makeProjectSchema(c, t), [c, t])
  const [tab, setTab] = useActiveTab()
  const [coverBusy, setCoverBusy] = useState(false)
  const [galleryBusy, setGalleryBusy] = useState(false)
  const baseline = useRef(defaultValues)
  const pendingFocus = useRef(null)
  const uploading = coverBusy || galleryBusy

  const form = useForm({ resolver: zodResolver(schema), defaultValues })
  const {
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors, isDirty },
  } = form

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
      try {
        const saved = await onSubmit(isEdit ? changedPayload(baseline.current, values) : toPayload(values))
        if (isEdit && saved) {
          const next = toFormValues(saved)
          baseline.current = next
          reset(next)
        }
      } catch (err) {
        if (applyServerErrors(setError, err)) reveal(Object.keys(err.errors))
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

  const tabs = [
    { key: 'general', label: t.tabGeneral, icon: FileText, badge: errorBadge(countErrors(errors, TAB_FIELDS.general)) },
    { key: 'media', label: t.tabMedia, icon: Images, badge: errorBadge(countErrors(errors, TAB_FIELDS.media)) },
    { key: 'team', label: t.tabTeam, icon: isEdit ? Users : Lock, badge: isEdit ? f.number(project?.team_members_count ?? 0) : undefined },
    { key: 'links', label: t.tabLinks, icon: isEdit ? Link2 : Lock, badge: isEdit ? f.number(project?.links_count ?? 0) : undefined },
  ]
  const isFormTab = tab === 'general' || tab === 'media'

  return (
    <div className="space-y-5">
      <Tabs idPrefix={PREFIX} tabs={tabs} value={tab} onChange={setTab} label={t.tabsLabel} />

      {/* the form covers only General + Media: Team and Links (below) are saved live, so no Save button there */}
      <form id={FORM_ID} onSubmit={submit} noValidate hidden={!isFormTab} className="space-y-5">
        <TabPanel idPrefix={PREFIX} value="general" active={tab} keepMounted className="space-y-5">
          <GeneralFields form={form} isEdit={isEdit} />
        </TabPanel>

        <TabPanel idPrefix={PREFIX} value="media" active={tab} keepMounted>
          <MediaFields form={form} project={project} onCoverBusy={setCoverBusy} onGalleryBusy={setGalleryBusy} />
        </TabPanel>

        <FormActions saving={saving} dirty={isEdit ? isDirty : undefined} disabled={uploading} cancelTo={listTo} sticky />
      </form>

      {isEdit && !isFormTab && isDirty ? <Alert tone="warning">{t.unsavedOnNested}</Alert> : null}

      <TabPanel idPrefix={PREFIX} value="team" active={tab}>
        {isEdit ? <TeamTab projectId={project.id} /> : <SaveFirst description={t.saveFirstTeam} busy={uploading} saving={saving} />}
      </TabPanel>
      <TabPanel idPrefix={PREFIX} value="links" active={tab}>
        {isEdit ? <LinksTab projectId={project.id} /> : <SaveFirst description={t.saveFirstLinks} busy={uploading} saving={saving} />}
      </TabPanel>
    </div>
  )
}
