import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Languages, Printer, SearchX } from 'lucide-react'
import { MfaNotice } from '@/app/MfaNotice'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { errorText, isMfaRequired } from '@/lib/errors'
import { Alert, Button, EmptyState, PageSpinner, SearchInput, flipRtl } from '@/ui'
import { industriesCatalog, registryProjects } from '../kit'
import { canRead, useProfileCollections } from './data'
import { SearchProvider } from './parts'
import { SECTIONS, SummarySection, missingChecks } from './sections'
import strings from './strings'
import { Toc } from './Toc'
import './print.css'

// Mirrors PageHeader's document title (the profile draws its own heading inside the summary card).
const TITLE_SUFFIX = 'NGP Dashboard'
const PRINT_CLASS = 'ngp-profile-print'

/** The print stylesheet applies while the profile is open only. */
function usePrintMode() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add(PRINT_CLASS)
    return () => root.classList.remove(PRINT_CLASS)
  }, [])
}

/** Which sections the page shows, and what each still misses (see SECTIONS). */
export function visibleSections({ record, data }) {
  const missing = missingChecks(record.completeness)
  return SECTIONS.flatMap((section) => {
    if (!canRead(record.abilities, section.tier)) return []
    const queries = section.segments.map((segment) => data[segment])
    const pending = queries.some((query) => query.isLoading || query.isError)
    const hints = section.hints.filter((key) => missing.has(key))
    if (!pending && !hints.length && !section.hasData({ record, data })) return []
    return [{ ...section, missing: hints }]
  })
}

/**
 * ملف المشروع (`/projects/:id/profile`): one read-only dossier of everything the caller may see about a project.
 *
 * It reads the registry record (`GET registry/projects/{id}`: abilities, operations groups, completeness) and then,
 * in parallel, every collection of a tier those abilities open (`data.js`), each whole. The sections of a tier the
 * caller cannot read are absent and their collections are never requested. Each collection fails on its own (a
 * small error with Retry inside its section). The two-step sign-in gate shows the usual notice and leaves the
 * public part on screen.
 */
export default function ProjectProfile() {
  const { id } = useParams()
  const p = useStrings(strings)
  const c = useCommon()
  const { pickField, toggle } = useLanguage()
  const registry = registryProjects.useOne(id, { refetchOnWindowFocus: false })
  const record = registry.data ?? null
  const data = useProfileCollections(id, record?.abilities)
  const industries = industriesCatalog.useList({ per_page: 200, sort: 'order', dir: 'asc' }, { enabled: Boolean(record), refetchOnWindowFocus: false }).rows
  const [search, setSearch] = useState('')
  usePrintMode()

  const name = record ? pickField(record, 'name') : ''
  useEffect(() => {
    document.title = `${name ? p.profileOf(name) : p.title} · ${TITLE_SUFFIX}`
  }, [name, p])

  if (registry.isLoading) return <PageSpinner />

  if (!record) {
    const error = registry.error
    if (error?.status === 404) {
      return <EmptyState icon={SearchX} title={p.notFoundTitle} description={c.itemNotFound} action={<Button to="/registry/projects">{p.registryList}</Button>} />
    }
    return (
      <div className="space-y-4">
        {isMfaRequired(error) ? <MfaNotice /> : null}
        <Alert
          tone="danger"
          title={p.loadFailed}
          action={
            <Button size="sm" variant="secondary" onClick={() => registry.refetch()} loading={registry.isFetching}>
              {c.retry}
            </Button>
          }
        >
          {errorText(error, c)}
        </Alert>
      </div>
    )
  }

  const sections = visibleSections({ record, data })
  const tocItems = [{ key: 'summary', tier: 'public', title: p.sections.summary }, ...sections.map((section) => ({ key: section.key, tier: section.tier, title: p.sections[section.key] }))]
  const mfaGate = record.mfa_enrollment_required || Object.values(data).some((query) => query.isError && isMfaRequired(query.error))

  return (
    <SearchProvider value={search}>
      <div data-profile-root="" className="space-y-5">
        <div className="z-10 flex flex-wrap items-center gap-3 rounded-card border border-white/[.07] bg-deep/85 px-3 py-2.5 backdrop-blur lg:sticky lg:top-[4.5rem]" data-print-hide="">
          <Link to={`/projects/${record.id}`} className="inline-flex items-center gap-1.5 rounded-md px-1 text-[13px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light">
            <ArrowLeft size={14} aria-hidden="true" className={flipRtl} />
            {p.projectPage}
          </Link>
          <SearchInput value={search} onChange={setSearch} delay={200} placeholder={p.searchPlaceholder} aria-label={p.searchLabel} className="min-w-[200px] flex-1 sm:w-auto" />
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" icon={Languages} onClick={toggle} aria-label={c.switchLanguageLabel}>
              {c.switchLanguage}
            </Button>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              {p.print}
            </Button>
          </div>
        </div>

        {mfaGate ? <MfaNotice /> : null}

        <div data-profile-layout="" className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-5">
            <Toc items={tocItems} variant="mobile" />
            <SummarySection record={record} data={data} />
            {sections.map(({ key, Component, missing }) => (
              <Component key={key} record={record} data={data} industries={industries} missing={missing} />
            ))}
          </div>
          <aside className="hidden self-stretch lg:block" data-print-hide="">
            <Toc items={tocItems} variant="desktop" />
          </aside>
        </div>
      </div>
    </SearchProvider>
  )
}
