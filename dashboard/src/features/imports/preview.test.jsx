import '@/features/projects/testTimeouts'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi, reply } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import ImportBatchPage from './ImportBatchPage'
import { BATCH_ID, change, deploymentSection, featuresSection, makeBatch, makePreview, makeReport, matchedProject, projectSection, section } from './testUtils'

const BATCH = `/registry/imports/${BATCH_ID}`

function renderBatch(batch = makeBatch(), { routes = {}, lang } = {}) {
  const server = mockApi({ [`GET ${BATCH}`]: () => ({ data: batch }), ...routes })
  const view = renderWithProviders(<ImportBatchPage />, { route: `/imports/${BATCH_ID}`, path: '/imports/:id', lang })
  return { server, ...view }
}

const region = (name) => within(screen.getByRole('region', { name }))
const sectionNames = () => within(screen.getByRole('region', { name: 'Sections' })).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
const row = (path) => document.querySelector(`tr[data-path="${path}"]`)
const choiceIn = (path) => within(row(path)).getByRole('radio', { checked: true }).value
const applyButton = () => screen.getByRole('button', { name: 'Apply the import' })

async function applyAndConfirm(user) {
  await user.click(applyButton())
  const dialog = await screen.findByRole('dialog', { name: 'Apply the import?' })
  await user.click(within(dialog).getByRole('button', { name: 'Apply the import' }))
}

describe('imports preview: match banner', () => {
  it('says which existing project a uid match updates, with a link to it', async () => {
    renderBatch()
    const banner = (await screen.findByText('Updates the existing “Dawri”')).closest('[role="status"]')
    expect(within(banner).getByRole('link', { name: 'Open the project' })).toHaveAttribute('href', '/projects/7')
    expect(screen.getByRole('heading', { level: 1, name: 'Import “Dawri”' })).toBeInTheDocument()
  })

  it('explains a slug match: everything on the project is kept as hand edits unless replaced', async () => {
    renderBatch(makeBatch({ match: { kind: 'slug', project: matchedProject }, warnings: [{ code: 'W_MATCHED_BY_SLUG', message: 'Matched by slug.' }, { code: 'W_STATUS_DIFFERS', message: 'project_status and development_status disagree' }] }))

    expect(await screen.findByText('Matched by slug — first import of an existing project')).toBeInTheDocument()
    expect(screen.getByText(/Everything already on this project is treated as your hand edits and kept unless you choose to replace it\./)).toBeInTheDocument()
    // the banner already says what W_MATCHED_BY_SLUG says; an unknown warning keeps the server text
    expect(screen.queryByText(/matched to an existing project by its slug/)).not.toBeInTheDocument()
    expect(screen.getByText('project_status and development_status disagree')).toBeInTheDocument()
  })

  it('announces a new project', async () => {
    renderBatch(makeBatch({ match: { kind: 'new', project: null }, info: { category_suggestion: 'mobile', alternative_names: ['Dawri Pro'] } }))
    expect(await screen.findByText('New project')).toBeInTheDocument()
    expect(screen.getByText('A new project “Dawri” will be created in the registry.')).toBeInTheDocument()
    expect(screen.getByText('Suggested category')).toBeInTheDocument()
    expect(screen.getByText('Dawri Pro')).toBeInTheDocument()
    expect(screen.getByText('ngp-project-discovery/1.1')).toBeInTheDocument()
  })
})

describe('imports preview: summary and sections', () => {
  it('shows the counts, the new catalog entries and the screenshots', async () => {
    renderBatch()
    const summary = await screen.findByRole('region', { name: 'Summary of changes' })
    const tile = (label) => within(summary).getByText(label).nextElementSibling.textContent
    expect(tile('New records')).toBe('1')
    expect(tile('Changed fields')).toBe('5')
    expect(tile('Unchanged')).toBe('32')
    expect(within(summary).getByText('Riverpod')).toBeInTheDocument()
    expect(within(summary).getByText('Sports')).toBeInTheDocument()
    expect(within(summary).getByText('New: 1')).toBeInTheDocument()
    expect(within(summary).getByText('Replaced: 1')).toBeInTheDocument()
    expect(within(summary).getByText('Unchanged: 3')).toBeInTheDocument()
    expect(within(summary).getByText('public/screenshots/01-home.png')).toBeInTheDocument()
    expect(within(summary).getByText('internal/screenshots/02-admin.png')).toBeInTheDocument()
  })

  it('renders one panel per section in the contract order, and never one the server left out', async () => {
    // sent out of order on purpose; `accounts` (sensitive, not viewable) is absent
    renderBatch(makeBatch({ preview: makePreview({ sections: [deploymentSection(), featuresSection(), projectSection()] }) }))
    await screen.findByRole('region', { name: 'Sections' })

    expect(sectionNames()).toEqual([expect.stringMatching(/^Project/), expect.stringMatching(/^Features/), expect.stringMatching(/^Deployment/)])
    expect(screen.queryByRole('region', { name: 'Accounts' })).not.toBeInTheDocument()
    expect(screen.queryByText('Accounts')).not.toBeInTheDocument()
    expect(region('Features').getByText('Public')).toBeInTheDocument()
    expect(region('Deployment').getByText('Sensitive')).toBeInTheDocument()
  })

  it('lists new records, changed fields with labels and badges, empty values and records only on our side', async () => {
    const { user } = renderBatch()
    const features = await screen.findByRole('region', { name: 'Features' })

    expect(within(features).getByText('New records to create (1)')).toBeInTheDocument()
    expect(within(features).getByText('Live scores')).toBeInTheDocument()
    await user.click(within(features).getByRole('button', { name: 'Show fields' }))
    expect(within(features).getByText('verified')).toBeInTheDocument()

    // field labels come from the project page's own configs
    expect(within(row('features.online-ordering.name_ar')).getByText('Name (Arabic)')).toBeInTheDocument()
    expect(within(row('features.online-ordering.name_ar')).getByText('online-ordering')).toBeInTheDocument()
    expect(within(row('features.online-ordering.main_workflow')).getByText('Main workflow')).toBeInTheDocument()
    expect(within(row('features.online-ordering.main_workflow')).getByText('Project never imported before')).toBeInTheDocument()
    expect(within(row('features.online-ordering.main_workflow')).getByText('open · choose · pay')).toBeInTheDocument()
    expect(within(row('project.name_en')).getByText('Project name (English)')).toBeInTheDocument()
    expect(within(row('project.name_en')).getByText('Edited by hand since the last import')).toBeInTheDocument()

    // collapsed until opened
    expect(within(features).queryByText('Old feature')).not.toBeInTheDocument()
    await user.click(within(features).getByRole('button', { name: 'Only on your side (1)' }))
    expect(within(features).getByText('On your side and not in the package — they will not be deleted')).toBeInTheDocument()
    expect(within(features).getByText('Old feature')).toBeInTheDocument()

    const project = region('Project')
    await user.click(project.getByRole('button', { name: 'Empty in the package (1)' }))
    expect(project.getByText('Empty values in the package never erase anything')).toBeInTheDocument()
    expect(project.getByText('Client')).toBeInTheDocument()
    expect(project.getByText('Acme')).toBeInTheDocument()
  })

  it('greys a read-only section out, without choices', async () => {
    renderBatch()
    const deployment = await screen.findByRole('region', { name: 'Deployment' })

    expect(within(deployment).getByText('View only')).toBeInTheDocument()
    expect(within(deployment).getByText('You cannot edit this section — the import will skip it')).toBeInTheDocument()
    expect(within(deployment).getByText('Manual FTP')).toBeInTheDocument()
    expect(within(deployment).getByText('GitHub Actions')).toBeInTheDocument()
    expect(within(deployment).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(deployment).queryByRole('button', { name: /Replace all/ })).not.toBeInTheDocument()
  })

  it('renders values of any JSON type compactly, long ones with an expand control', async () => {
    const long = 'x'.repeat(400)
    const { user } = renderBatch(
      makeBatch({
        preview: makePreview({
          sections: [
            section('administration', {
              tier: 'internal',
              kind: 'fields',
              changed: [
                change('administration.owner_name', null, 'Layla'),
                change('administration.components', [{ key: 'backend', type: 'api' }], [{ key: 'backend', type: 'api', path: 'server/' }]),
                change('administration.maintenance_responsibility', 'short', long),
                change('administration.legacy_flag', true, false),
                change('administration.headcount', 3, 4),
              ],
            }),
          ],
        }),
      }),
    )
    const panel = await screen.findByRole('region', { name: 'Administration' })

    expect(within(row('administration.owner_name')).getByText('—')).toBeInTheDocument()
    expect(within(row('administration.owner_name')).getByText('Owner')).toBeInTheDocument()
    expect(within(row('administration.legacy_flag')).getByText('Yes')).toBeInTheDocument()
    expect(within(row('administration.legacy_flag')).getByText('No')).toBeInTheDocument()
    expect(within(row('administration.legacy_flag')).getByText('Legacy flag')).toBeInTheDocument() // no label in the configs: humanized
    expect(within(row('administration.headcount')).getByText('4')).toBeInTheDocument()

    const components = row('administration.components')
    expect(within(components).getAllByText('(1 item)')).toHaveLength(2)
    await user.click(within(components).getAllByRole('button', { name: 'Show all' })[1])
    expect(within(components).getByText(/"path": "server\/"/)).toBeInTheDocument()

    const text = row('administration.maintenance_responsibility')
    expect(within(text).getByText(`${'x'.repeat(140)}…`)).toBeInTheDocument()
    await user.click(within(text).getByRole('button', { name: 'Show all' }))
    expect(within(text).getByText(long)).toBeInTheDocument()
    expect(within(panel).getByText('Internal')).toBeInTheDocument()
  })
})

describe('imports preview: decisions and apply', () => {
  it('starts every switch at its default, flips one field or a whole section, and sends exactly those decisions', async () => {
    const applied = makeBatch({ status: 'applied', applied_at: '2026-10-27T09:00:00.000000Z', report: makeReport() })
    const { server, user } = renderBatch(makeBatch(), { routes: { [`POST ${BATCH}/apply`]: () => ({ data: applied }) } })
    await screen.findByRole('region', { name: 'Features' })

    expect(choiceIn('project.name_en')).toBe('keep')
    expect(choiceIn('project.short_ar')).toBe('replace')
    expect(choiceIn('features.online-ordering.name_ar')).toBe('replace')
    expect(choiceIn('features.online-ordering.main_workflow')).toBe('keep')

    await user.click(within(row('project.name_en')).getByRole('radio', { name: 'Replace' }))
    expect(choiceIn('project.name_en')).toBe('replace')
    await user.click(region('Features').getByRole('button', { name: 'Keep all · Features' }))
    expect(choiceIn('features.online-ordering.name_ar')).toBe('keep')
    await user.click(region('Project').getByRole('button', { name: 'Replace all · Project' }))

    await user.click(applyButton())
    const dialog = await screen.findByRole('dialog', { name: 'Apply the import?' })
    expect(within(dialog).getByText('This is what will be applied to “Dawri”:')).toBeInTheDocument()
    expect(within(dialog).getByText('1 record created')).toBeInTheDocument()
    expect(within(dialog).getByText('2 fields replaced by the incoming value')).toBeInTheDocument()
    expect(within(dialog).getByText('2 fields kept as they are')).toBeInTheDocument()
    expect(within(dialog).getByText('Sections skipped (no edit permission): Deployment')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Apply the import' }))

    await waitFor(() => expect(server.calls('POST', `${BATCH}/apply`)).toHaveLength(1))
    expect(server.calls('POST', `${BATCH}/apply`)[0].body).toEqual({
      decisions: {
        'project.name_en': 'replace',
        'project.short_ar': 'replace',
        'features.online-ordering.name_ar': 'keep',
        'features.online-ordering.main_workflow': 'keep',
      },
    })
    // the answer replaces the batch: the report is shown
    expect(await screen.findByRole('region', { name: 'Import report' })).toBeInTheDocument()
  })

  it('disables Apply while the preview has blocking errors, and says how to fix the package', async () => {
    const withError = featuresSection({ errors: [{ path: 'features.online-ordering.business_description', code: 'no_secrets', message: 'Looks like a secret.' }] })
    renderBatch(makeBatch({ preview: makePreview({ blocking: true, sections: [projectSection(), withError] }) }))

    expect(await screen.findByText('This package cannot be applied yet')).toBeInTheDocument()
    expect(screen.getByText(/Fix the files in the package folder, or re-run the discovery prompt/)).toBeInTheDocument()
    expect(applyButton()).toBeDisabled()
    const errors = region('Features').getByRole('group', { name: 'Errors (1)' })
    expect(within(errors).getByText(/This value looks like it holds a password, key or token/)).toBeInTheDocument()
    expect(within(errors).getByText('online-ordering · Business description')).toBeInTheDocument()
  })

  it('on a stale preview (409) offers Refresh, which recomputes it and resets the choices', async () => {
    const refreshed = makeBatch({
      preview: makePreview({ sections: [projectSection({ changed: [change('project.name_en', 'Dawri Sports', 'Dawri', { default: 'keep', reason: 'edited_by_user' })] })] }),
    })
    const { server, user } = renderBatch(makeBatch(), {
      routes: {
        [`POST ${BATCH}/apply`]: () => reply(409, { message: 'The data changed since the preview.', code: 'stale_preview' }),
        [`POST ${BATCH}/refresh`]: () => ({ data: refreshed }),
      },
    })
    await screen.findByRole('region', { name: 'Project' })
    await user.click(within(row('project.name_en')).getByRole('radio', { name: 'Replace' }))

    await applyAndConfirm(user)

    expect(await screen.findByText('The data changed since the preview')).toBeInTheDocument()
    expect(applyButton()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Refresh the preview' }))

    await waitFor(() => expect(server.calls('POST', `${BATCH}/refresh`)).toHaveLength(1))
    expect(await screen.findByText('Dawri Sports')).toBeInTheDocument()
    expect(screen.queryByText('The data changed since the preview')).not.toBeInTheDocument()
    expect(screen.getByText(/The preview was refreshed\. Your choices were reset to their defaults/)).toBeInTheDocument()
    expect(choiceIn('project.name_en')).toBe('keep')
    expect(screen.queryByRole('region', { name: 'Features' })).not.toBeInTheDocument()
    expect(applyButton()).toBeEnabled()
  })

  it('shows the errors when apply is refused with 422 blocking_errors', async () => {
    const withError = featuresSection({ errors: [{ path: 'features.online-ordering.name_ar', code: 'max', message: 'Too long.' }] })
    const { user } = renderBatch(makeBatch({ preview: makePreview({ sections: [withError] }) }), {
      routes: { [`POST ${BATCH}/apply`]: () => reply(422, { message: 'The package has errors.', code: 'blocking_errors' }) },
    })
    await screen.findByRole('region', { name: 'Features' })

    await applyAndConfirm(user)

    const alert = (await screen.findByText('The server refused to apply: the package has errors')).closest('[role="alert"]')
    expect(within(alert).getByText(/Features · online-ordering · Name \(Arabic\)/)).toBeInTheDocument()
    expect(within(alert).getByText('Too long.')).toBeInTheDocument()
  })

  it('lists refused decisions (422 errors.decisions)', async () => {
    const { user } = renderBatch(makeBatch(), { routes: { [`POST ${BATCH}/apply`]: () => reply(422, { message: 'Invalid.', errors: { decisions: ['Unknown path: features.x.name_ar'] } }) } })
    await screen.findByRole('region', { name: 'Features' })
    await applyAndConfirm(user)
    expect(await screen.findByText('Unknown path: features.x.name_ar')).toBeInTheDocument()
  })

  it('cancels after a confirmation, then goes back to the history', async () => {
    const { server, user } = renderBatch(makeBatch(), { routes: { [`DELETE ${BATCH}`]: () => null } })
    await screen.findByRole('region', { name: 'Features' })

    await user.click(screen.getByRole('button', { name: 'Cancel the import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this import?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel the import' }))

    await waitFor(() => expect(server.calls('DELETE', BATCH)).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/imports$/))
  })

  it('hides Apply and Cancel when the batch does not allow them', async () => {
    renderBatch(makeBatch({ abilities: { apply: false, cancel: false } }))
    await screen.findByRole('region', { name: 'Features' })
    expect(screen.queryByRole('button', { name: 'Apply the import' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel the import' })).not.toBeInTheDocument()
  })
})

describe('imports preview: two-step sign-in and RTL', () => {
  it('asks for two-step sign-in when the batch answers 403 mfa_enrollment_required', async () => {
    mockApi({ [`GET ${BATCH}`]: () => reply(403, { message: 'MFA', code: 'mfa_enrollment_required' }) })
    renderWithProviders(<ImportBatchPage />, { route: `/imports/${BATCH_ID}`, path: '/imports/:id' })
    expect(await screen.findByText('Turn on two-step sign-in to use imports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open my account' })).toHaveAttribute('href', '/account#mfa')
  })

  it('reads in Arabic', async () => {
    renderBatch(makeBatch({ match: { kind: 'slug', project: matchedProject } }), { lang: 'ar' })
    expect(await screen.findByText('مطابقة بالرابط المختصر — أول استيراد لمشروع موجود')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'المزايا' })).toBeInTheDocument()
    expect(within(row('project.name_en')).getByText('عدّلته يدوياً بعد آخر استيراد')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'النشر' })).getByText('ليس لديك صلاحية تعديل هذا القسم — سيتجاوزه الاستيراد')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('shows a missing batch as not found', async () => {
    mockApi({ [`GET ${BATCH}`]: () => reply(404, { message: 'Not found.' }) })
    renderWithProviders(<ImportBatchPage />, { route: `/imports/${BATCH_ID}`, path: '/imports/:id' })
    expect(await screen.findByText('Import not found')).toBeInTheDocument()
  })
})
