import '@/features/projects/testTimeouts'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'
import ImportBatchPage from './ImportBatchPage'
import { BATCH_ID, makeBatch, makeReport } from './testUtils'

function renderBatch(batch) {
  mockApi({ [`GET /registry/imports/${BATCH_ID}`]: () => ({ data: batch }) })
  return renderWithProviders(<ImportBatchPage />, { route: `/imports/${BATCH_ID}`, path: '/imports/:id' })
}

const applied = (report) => makeBatch({ status: 'applied', applied_at: '2026-10-27T09:00:00.000000Z', abilities: { apply: false, cancel: false }, report: makeReport(report) })

describe('imports report', () => {
  it('shows the counts, the files and catalog entries created, the skipped sections and a link to the project', async () => {
    renderBatch(applied({ warnings: [{ code: 'W_UNKNOWN_MODULE', message: 'Feature live-scores names an unknown module.' }] }))

    const report = await screen.findByRole('region', { name: 'Import report' })
    const tile = (scope, label) => within(scope).getByText(label).nextElementSibling.textContent
    expect(tile(report, 'Created')).toBe('12')
    expect(tile(report, 'Updated')).toBe('25')
    expect(tile(report, 'Kept by you')).toBe('5')
    const files = within(report).getByRole('group', { name: 'Files' })
    expect(tile(files, 'Stored')).toBe('20')
    expect(tile(files, 'Rejected')).toBe('0')
    expect(within(files).getByText('public/screenshots/01-home.png')).toBeInTheDocument()
    const catalog = within(report).getByRole('group', { name: 'Added to the catalogs' })
    expect(tile(catalog, 'New technologies')).toBe('2')
    expect(within(catalog).getByText('Riverpod')).toBeInTheDocument()

    expect(screen.getByText('Sections the import skipped (no edit permission)')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Deployment')).toBeInTheDocument()
    expect(screen.getByText('Feature live-scores names an unknown module.')).toBeInTheDocument()
    expect(screen.getByText('The project is ready to publish.')).toBeInTheDocument()
    expect(within(report).getByRole('link', { name: 'Open the project' })).toHaveAttribute('href', '/projects/7')
    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('lists what a published project now lacks, with the Publication card’s labels', async () => {
    renderBatch(applied({ publication: { ready: false, missing: ['cover', 'short_en'] } }))

    const alert = (await screen.findByText('The project is published but lacks what its public page needs:')).closest('[role="alert"]')
    expect(within(alert).getByText('A cover image or at least one public screenshot')).toBeInTheDocument()
    expect(within(alert).getAllByRole('listitem')).toHaveLength(2)
  })

  it('gives failed, cancelled and expired batches their own state', async () => {
    const { unmount } = renderBatch(makeBatch({ status: 'failed', report: { errors: [{ code: 'E_STORAGE', message: 'The screenshot could not be stored.' }] } }))
    expect(await screen.findByText('The import failed')).toBeInTheDocument()
    expect(screen.getByText('The screenshot could not be stored.')).toBeInTheDocument()
    expect(screen.getByText(/an import is applied whole or not at all/)).toBeInTheDocument()
    unmount()

    const cancelled = renderBatch(makeBatch({ status: 'cancelled' }))
    expect(await screen.findByText('This import was cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply the import' })).not.toBeInTheDocument()
    cancelled.unmount()

    renderBatch(makeBatch({ status: 'expired' }))
    expect(await screen.findByText('This preview expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Another import' })).toHaveAttribute('href', '/imports')
  })
})
