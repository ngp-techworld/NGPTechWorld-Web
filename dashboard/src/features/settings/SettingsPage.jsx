import { useCommon, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Alert, Button, PageHeader, PageSpinner } from '@/ui'
import { SectionLayoutEditor } from '@/features/projects/sections/SectionLayoutEditor'
import sectionStrings from '@/features/projects/sections/strings'
import { SettingsForm } from './SettingsForm'
import { useSaveSettings, useSettings } from './hooks'
import { toFormValues } from './schema'
import strings from './strings'

export default function SettingsPage() {
  const t = useStrings(strings)
  const st = useStrings(sectionStrings)
  const c = useCommon()
  const query = useSettings()
  const save = useSaveSettings()

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      {query.isLoading ? (
        <PageSpinner />
      ) : !query.data ? (
        <Alert
          tone="danger"
          title={t.loadFailedTitle}
          action={
            <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
              {c.retry}
            </Button>
          }
        >
          {errorText(query.error, c)}
        </Alert>
      ) : (
        // the form reads its defaults once; it resets itself to the saved values after every successful save
        <>
          <SettingsForm
            defaultValues={toFormValues(query.data)}
            /* Read-only, so it is a prop rather than a form field: how many visits are on record,
               which is the thing you want to see before deciding to publish the counter. */
            visitors={query.data?.visitors ?? 0}
            onSubmit={save.mutateAsync}
            saving={save.isPending}
          />
          {/* the default section order of every project page (saved alone; null = all sections, usual order) */}
          {'portfolio_sections' in query.data ? (
            <div className="mt-5 max-w-3xl">
              <SectionLayoutEditor
                title={st.siteTitle}
                description={st.siteDescription}
                field="portfolio_sections"
                value={query.data.portfolio_sections ?? null}
                defaultHint={st.useDefaultSiteHint}
                onSave={(layout) => save.mutateAsync({ portfolio_sections: layout })}
                canWrite
                saving={save.isPending}
              />
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
