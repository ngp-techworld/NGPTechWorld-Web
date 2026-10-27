import '@/features/projects/testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, paginated, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import imports from './index'
import ImportsPage from './ImportsPage'
import { BATCH_ID, makeSummary } from './testUtils'

const rows = [
  makeSummary(),
  makeSummary({
    id: 'b-2',
    status: 'applied',
    original_name: 'magiagift.zip',
    package: { slug: 'magiagift', name: { ar: 'ماجيا', en: 'MagiaGift' } },
    match: { kind: 'new', project: null },
    user: { id: 2, name: 'Sara' },
    report_counts: { created: 40, updated: 0, unchanged: 0, skipped_empty: 0, only_in_db: 0, kept_by_user: 0 },
  }),
  makeSummary({ id: 'b-3', status: 'expired', counts: { new: 0, changed: 2, unchanged: 1, skipped_empty: 0, only_in_db: 0, errors: 3 } }),
]

describe('imports feature', () => {
  it('registers /imports and /imports/:id in the main nav group', () => {
    expect(imports.id).toBe('imports')
    expect(imports.nav).toMatchObject({ group: 'main', to: '/imports', label: { ar: 'استيراد المشاريع', en: 'Import projects' } })
    expect(imports.routes.map((route) => route.path)).toEqual(['imports', 'imports/:id'])
  })
})

describe('imports history', () => {
  it('lists the batches with their status, project, file, user, date and counts, each linking to its page', async () => {
    mockApi({ 'GET /registry/imports': () => paginated(rows) })
    const { user } = renderWithProviders(<ImportsPage />, { route: '/imports' })

    await screen.findByText('magiagift.zip')
    const table = screen.getByRole('table', { name: 'Import history' })
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(3)

    const [first, second, third] = bodyRows.map((item) => within(item))
    expect(first.getByText('Awaiting apply')).toBeInTheDocument()
    expect(first.getByText('Dawri')).toBeInTheDocument()
    expect(first.getByText('dawri.zip')).toBeInTheDocument()
    expect(first.getByText('Admin')).toBeInTheDocument()
    expect(first.getByText('new')).toBeInTheDocument()
    expect(first.getByRole('link', { name: 'Open Dawri' })).toHaveAttribute('href', `/imports/${BATCH_ID}`)

    expect(second.getByText('Applied')).toBeInTheDocument()
    expect(second.getByText('MagiaGift')).toBeInTheDocument()
    expect(second.getByText('New')).toBeInTheDocument()
    expect(second.getByText('created').parentElement).toHaveTextContent('40 created')

    expect(third.getByText('Expired')).toBeInTheDocument()
    expect(third.getByText('errors').parentElement).toHaveTextContent('3 errors')

    await user.click(second.getByText('MagiaGift'))
    expect(screen.getByTestId('location')).toHaveTextContent('/imports/b-2')
  })

  it('filters by status through the API', async () => {
    const server = mockApi({ 'GET /registry/imports': ({ query }) => paginated(query.status ? rows.filter((row) => row.status === query.status) : rows) })
    const { user } = renderWithProviders(<ImportsPage />, { route: '/imports' })
    await screen.findByText('magiagift.zip')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'applied')

    await waitFor(() => expect(server.calls('GET', '/registry/imports').at(-1).query).toEqual({ page: '1', status: 'applied' }))
    await waitFor(() => expect(screen.queryByText('dawri.zip')).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent('/imports?status=applied')
  })

  it('opens the upload step by default while the history is empty, and on "New import" otherwise', async () => {
    mockApi({ 'GET /registry/imports': () => paginated([]) })
    const empty = renderWithProviders(<ImportsPage />, { route: '/imports' })
    expect(await screen.findByRole('region', { name: 'Upload a project package' })).toBeInTheDocument()
    expect(screen.getByText('How to prepare a project')).toBeInTheDocument()
    expect(screen.getByText('Run the discovery prompt on the project.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a folder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a ZIP file' })).toBeInTheDocument()
    empty.unmount()

    mockApi({ 'GET /registry/imports': () => paginated(rows) })
    const { user } = renderWithProviders(<ImportsPage />, { route: '/imports' })
    await screen.findByText('magiagift.zip')
    expect(screen.queryByRole('region', { name: 'Upload a project package' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New import' }))
    expect(screen.getByRole('region', { name: 'Upload a project package' })).toBeInTheDocument()
  })

  it('shows the Arabic how-to with the folder names', async () => {
    mockApi({ 'GET /registry/imports': () => paginated([]) })
    renderWithProviders(<ImportsPage />, { route: '/imports', lang: 'ar' })
    expect(await screen.findByText('كيف تجهّز مشروعًا للاستيراد؟')).toBeInTheDocument()
    expect(screen.getByText('شغّل برومبت الاكتشاف على المشروع.')).toBeInTheDocument()
    const step = within(screen.getByRole('complementary', { name: 'كيف تجهّز مشروعًا للاستيراد؟' }))
      .getAllByRole('listitem')
      .find((item) => item.textContent === 'اسحب المجلد الذي أنتجه (ngp-portfolio/، أو نسختك في intake/<slug>/) إلى هنا.')
    // the folders are isolated left to right, so the RTL sentence does not move their slashes ("/ngp-portfolio")
    expect(within(step).getByText('ngp-portfolio/')).toHaveAttribute('dir', 'ltr')
    expect(within(step).getByText('intake/<slug>/').tagName).toBe('BDI')
    expect(screen.getByRole('button', { name: 'اختر مجلداً' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'اختر ملفاً مضغوطاً' })).toBeInTheDocument()
  })

  it('asks for two-step sign-in when the history answers 403 mfa_enrollment_required', async () => {
    mockApi({ 'GET /registry/imports': () => reply(403, { message: 'Two-step sign-in is required.', code: 'mfa_enrollment_required' }) })
    renderWithProviders(<ImportsPage />, { route: '/imports', lang: 'ar' })

    expect(await screen.findByText('فعّل الدخول بخطوتين لاستخدام الاستيراد')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'فتح صفحة حسابي' })).toHaveAttribute('href', '/account#mfa')
    expect(screen.queryByRole('region', { name: 'رفع حزمة مشروع' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
