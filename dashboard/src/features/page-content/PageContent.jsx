import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCommon, useStrings } from '@/i18n'
import { ApiError } from '@/lib/api'
import { errorText } from '@/lib/errors'
import { Alert, Button, PageHeader, PageSpinner, TabPanel, Tabs, UnsavedChangesGuard, useConfirm, useToast } from '@/ui'
import { CollectionManager } from './CollectionManager'
import { ContentItemModal } from './ContentItemModal'
import { SaveBar } from './SaveBar'
import { TextGroupCard } from './TextGroupCard'
import { useSaveTexts, useTexts } from './hooks'
import { buildTabs, tabOfKeys } from './layout'
import { LANGS, allItems, buildTextsPayload, countDirtyItems, makeTextsSchema, textsServerErrors, toTextsFormValues } from './schema'
import strings from './strings'

const ID_PREFIX = 'page-content'

const keysOfTab = (tab) => tab.groups.flatMap((group) => group.items.map((item) => item.key))

/**
 * The editor, mounted once the texts are loaded. ONE form holds every text of every tab (all tabs stay mounted, so
 * nothing is lost while switching); Save sends only the dirty keys/languages and then refreshes the form from the answer.
 * The three collections are independent lists inside the tabs; their add/edit modal lives here, outside the `<form>`.
 */
function PageContentEditor({ groups }) {
  const t = useStrings(strings)
  const c = useCommon()
  const toast = useToast()
  const confirm = useConfirm()
  const save = useSaveTexts()

  const tabs = useMemo(() => buildTabs(groups), [groups])
  const tabOfKey = useMemo(() => tabOfKeys(tabs), [tabs])
  const keys = useMemo(() => allItems(groups).map((item) => item.key), [groups])
  const schema = useMemo(() => makeTextsSchema(c, groups), [c, groups])

  const [tab, setTab] = useState(tabs[0].key)
  const [editor, setEditor] = useState(null) // { collection, item } while the add / edit modal is open
  const [focusRequest, setFocusRequest] = useState(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    resetField,
    setError,
    setFocus,
    formState: { dirtyFields, errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toTextsFormValues(groups) })

  const dirtyCount = countDirtyItems(dirtyFields, keys)
  const hasChanges = dirtyCount > 0

  // An invalid field may sit in a tab that is not open: open its tab, and focus the field once it is visible.
  const showField = (key, name) => {
    setTab((current) => tabOfKey[key] ?? current)
    setFocusRequest({ name })
  }
  useEffect(() => {
    if (focusRequest) setFocus(focusRequest.name)
  }, [focusRequest, setFocus])

  const onInvalid = (formErrors) => {
    for (const key of keys) {
      const lang = LANGS.find((code) => formErrors.texts?.[key]?.[code])
      if (lang) return showField(key, `texts.${key}.${lang}`)
    }
    return undefined
  }

  const onValid = async (values) => {
    const items = buildTextsPayload(values, dirtyFields, groups)
    if (items.length === 0) return
    try {
      const next = await save.mutateAsync(items)
      reset(toTextsFormValues(next)) // what the server stored (trimmed, …) becomes the new saved state
      toast.success(c.saved)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const invalid = textsServerErrors(err, items)
        invalid.forEach(({ name, message }) => setError(name, { type: 'server', message }))
        if (invalid.length) showField(invalid[0].key, invalid[0].name)
        else setError('root.server', { type: 'server', message: err.message })
      }
      toast.error(errorText(err, c))
    }
  }

  const discard = async () => {
    if (await confirm({ title: t.discardTitle, message: t.discardMessage, confirmLabel: t.discardConfirm })) reset()
  }

  const tabItems = tabs.map((entry) => {
    const edited = countDirtyItems(dirtyFields, keysOfTab(entry))
    return {
      key: entry.key,
      label: t.tabs[entry.key] ?? entry.key,
      icon: entry.icon,
      badge:
        edited > 0 ? (
          <>
            <span aria-hidden="true">{edited}</span>
            <span className="sr-only">{t.tabEdited(edited)}</span>
          </>
        ) : undefined,
    }
  })

  return (
    <>
      {/* leaving with unsaved texts asks first: in the app (a link, Back) and in the browser (reload, closed tab) */}
      <UnsavedChangesGuard when={hasChanges} />
      {errors.root?.server ? (
        <Alert tone="danger" title={t.serverErrorTitle} className="mb-4">
          {errors.root.server.message}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onValid, onInvalid)} noValidate>
        <Tabs idPrefix={ID_PREFIX} label={t.tabsLabel} tabs={tabItems} value={tab} onChange={setTab} />
        {tabs.map((entry) => (
          <TabPanel key={entry.key} idPrefix={ID_PREFIX} value={entry.key} active={tab} keepMounted>
            <div className="space-y-6">
              {t.tabHints[entry.key] ? <p className="text-sm text-muted">{t.tabHints[entry.key]}</p> : null}
              {entry.groups.map((group) => (
                <TextGroupCard key={group.group} group={group} control={control} register={register} resetField={resetField} readOnly={save.isPending} />
              ))}
              {entry.collections.map((collection) => (
                <CollectionManager key={collection} collection={collection} onAdd={(name) => setEditor({ collection: name, item: null })} onEdit={(name, item) => setEditor({ collection: name, item })} />
              ))}
            </div>
          </TabPanel>
        ))}
        <SaveBar dirtyCount={dirtyCount} saving={save.isPending} onDiscard={discard} />
      </form>

      {editor ? <ContentItemModal collection={editor.collection} item={editor.item} onClose={() => setEditor(null)} /> : null}
    </>
  )
}

export default function PageContent() {
  const t = useStrings(strings)
  const c = useCommon()
  const query = useTexts()

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <Alert tone="info" title={t.infoTitle} className="mb-6">
        <ul className="list-disc space-y-0.5 ps-5">
          <li>{t.infoEmpty}</li>
          <li>{t.infoCache}</li>
        </ul>
      </Alert>

      {query.isLoading ? (
        <PageSpinner />
      ) : !query.data ? (
        <Alert
          tone="danger"
          title={c.loadFailed}
          action={
            <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
              {c.retry}
            </Button>
          }
        >
          {errorText(query.error, c)}
        </Alert>
      ) : (
        <PageContentEditor groups={query.data} />
      )}
    </>
  )
}
