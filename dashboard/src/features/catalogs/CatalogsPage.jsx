import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Cpu } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canCreateProjects } from '@/app/permissions'
import { CollectionTab, KEY_PATTERN, TECH_CATEGORIES, registryStrings, toOptions } from '@/features/registry/kit'
import { useLanguage, useStrings } from '@/i18n'
import { Alert, Badge, PageHeader, TabPanel, Tabs } from '@/ui'
import strings from './strings'

const PREFIX = 'catalogs'
const TABS = ['technologies', 'industries']
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const code = (value) => (value ? <bdi dir="ltr" className="font-mono text-[13px] text-soft">{value}</bdi> : null)

export const technologiesConfig = (t, r) => ({
  title: t.technologiesTitle,
  description: t.technologiesDescription,
  itemLabel: t.technologyLabel,
  icon: Cpu,
  emptyTitle: t.noTechnologies,
  search: true,
  searchPlaceholder: t.searchTechnologies,
  sort: { sort: 'name', dir: 'asc' },
  defaults: { category: 'other' },
  rowName: (row) => row.name,
  filters: [{ name: 'category', label: t.category, options: toOptions(TECH_CATEGORIES, r.techCategories) }],
  fields: [
    { name: 'name', type: 'text', label: t.name, required: true, max: 100, dir: 'ltr' },
    { name: 'slug', type: 'text', label: t.slug, hint: t.slugHint, max: 100, pattern: SLUG_PATTERN, patternMessage: t.slugFormat, dir: 'ltr' },
    { name: 'category', type: 'select', label: t.category, nullable: false, options: toOptions(TECH_CATEGORIES, r.techCategories) },
  ],
  columns: () => [
    { key: 'name', header: t.name, cell: (row) => <span className="font-semibold">{row.name}</span> },
    { key: 'slug', header: t.slug, hideBelow: 'sm', cell: (row) => code(row.slug) },
    { key: 'category', header: t.category, cell: (row) => <Badge tone="accent">{r.techCategories[row.category] ?? row.category}</Badge> },
  ],
})

export const industriesConfig = (t, r, pickField) => ({
  title: t.industriesTitle,
  description: t.industriesDescription,
  itemLabel: t.industryLabel,
  icon: Building2,
  emptyTitle: t.noIndustries,
  reorderable: true,
  rowName: (row) => pickField(row, 'name'),
  fields: [
    { name: 'key', type: 'text', label: t.key, hint: t.keyHint, required: true, max: 60, pattern: KEY_PATTERN, patternMessage: r.keyFormat, dir: 'ltr' },
    { name: 'name', type: 'bilingual', label: t.name, required: true, max: 255 },
  ],
  columns: () => [
    { key: 'name', header: t.name, cell: (row) => <span className="font-semibold">{pickField(row, 'name')}</span> },
    { key: 'key', header: t.key, cell: (row) => code(row.key) },
  ],
})

/**
 * The shared catalogs (`/registry/technologies`, `/registry/industries`). Every registry role and the `projects`
 * section read them; whoever may create projects (super admins, project editors, registry managers) changes them.
 */
export default function CatalogsPage() {
  const t = useStrings(strings)
  const r = useStrings(registryStrings)
  const { pickField } = useLanguage()
  const { user } = useAuth()
  const canWrite = canCreateProjects(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'technologies'
  const setTab = useCallback((next) => setSearchParams(next === 'technologies' ? {} : { tab: next }, { replace: true }), [setSearchParams])
  const technologies = useMemo(() => technologiesConfig(t, r), [t, r])
  const industries = useMemo(() => industriesConfig(t, r, pickField), [t, r, pickField])

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-5">
        {!canWrite ? <Alert tone="info">{t.readOnly}</Alert> : null}
        <Tabs
          idPrefix={PREFIX}
          label={t.tabsLabel}
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'technologies', label: t.tabTechnologies, icon: Cpu },
            { key: 'industries', label: t.tabIndustries, icon: Building2 },
          ]}
        />
        <TabPanel idPrefix={PREFIX} value="technologies" active={tab}>
          <CollectionTab resource="/registry/technologies" config={technologies} canWrite={canWrite} />
        </TabPanel>
        <TabPanel idPrefix={PREFIX} value="industries" active={tab}>
          <CollectionTab resource="/registry/industries" config={industries} canWrite={canWrite} />
        </TabPanel>
      </div>
    </>
  )
}
