import { fireEvent, screen, within } from '@testing-library/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { DataTable } from './DataTable'

const rows = [
  { id: 1, name: 'Alpha', city: 'Amman', created_at: '2026-09-01' },
  { id: 2, name: 'Beta', city: null, created_at: '2026-09-02' },
  { id: 3, name: 'Gamma', city: 'Cairo', created_at: '2026-09-03' },
]
const columns = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'city', header: 'City' },
  { key: 'when', header: 'When', sortable: true, sortKey: 'created_at', cell: (row) => `on ${row.created_at}`, hideBelow: 'md' },
]

describe('DataTable', () => {
  it('renders headers and cells, with a dash for empty values', () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} />)

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Name', 'City', 'When'])
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('on 2026-09-02')).toBeInTheDocument()
    expect(within(screen.getByText('Beta').closest('tr')).getByText('—')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading and no rows exist', () => {
    const { container } = renderWithProviders(<DataTable columns={columns} rows={[]} loading skeletonRows={3} />)
    expect(container.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(3)
    expect(screen.queryByText('No results')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the empty state (default and custom text)', () => {
    const { rerender } = renderWithProviders(<DataTable columns={columns} rows={[]} />)
    expect(screen.getByText('No results')).toBeInTheDocument()

    rerender(<DataTable columns={columns} rows={[]} emptyTitle="No faqs" emptyDescription="Add one" emptyAction={<button>Add</button>} />)
    expect(screen.getByText('No faqs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('dims the rows while refetching (busy) but keeps them visible', () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} busy />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveClass('opacity-60')
  })

  describe('sorting', () => {
    it('marks the active column with aria-sort and toggles asc → desc', async () => {
      const onSortChange = vi.fn()
      const { user, rerender } = renderWithProviders(<DataTable columns={columns} rows={rows} sort={{ key: 'created_at', dir: 'desc' }} onSortChange={onSortChange} />)

      expect(screen.getByRole('columnheader', { name: /When/ })).toHaveAttribute('aria-sort', 'descending')
      expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none')
      expect(screen.getByRole('columnheader', { name: 'City' })).not.toHaveAttribute('aria-sort')

      await user.click(screen.getByRole('button', { name: /When/ }))
      expect(onSortChange).toHaveBeenLastCalledWith({ key: 'created_at', dir: 'asc' }) // uses sortKey, not key

      await user.click(screen.getByRole('button', { name: /Name/ }))
      expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', dir: 'asc' })

      rerender(<DataTable columns={columns} rows={rows} sort={{ key: 'name', dir: 'asc' }} onSortChange={onSortChange} />)
      await user.click(screen.getByRole('button', { name: /Name/ }))
      expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', dir: 'desc' })
    })

    it('only sortable columns render a button', () => {
      renderWithProviders(<DataTable columns={columns} rows={rows} />)
      expect(screen.queryByRole('button', { name: 'City' })).not.toBeInTheDocument()
    })
  })

  describe('selection', () => {
    function Controlled({ onChange }) {
      const [selected, setSelected] = useState([])
      return (
        <DataTable
          columns={columns}
          rows={rows}
          selectable
          selected={selected}
          onSelectedChange={(keys) => {
            setSelected(keys)
            onChange?.(keys)
          }}
        />
      )
    }

    it('selects rows and all rows, with an indeterminate header in between', async () => {
      const onChange = vi.fn()
      const { user } = renderWithProviders(<Controlled onChange={onChange} />)
      const [header, ...boxes] = screen.getAllByRole('checkbox')

      await user.click(boxes[1])
      expect(onChange).toHaveBeenLastCalledWith([2])
      expect(header.indeterminate).toBe(true)
      expect(screen.getByText('Beta').closest('tr')).toHaveAttribute('aria-selected', 'true')

      await user.click(header)
      expect(onChange).toHaveBeenLastCalledWith([2, 1, 3])
      expect(header).toBeChecked()

      await user.click(header)
      expect(onChange).toHaveBeenLastCalledWith([])
      expect(header).not.toBeChecked()
    })

    it('unselects a single row', async () => {
      const onChange = vi.fn()
      const { user } = renderWithProviders(<Controlled onChange={onChange} />)
      const boxes = screen.getAllByRole('checkbox').slice(1)
      await user.click(boxes[0])
      await user.click(boxes[0])
      expect(onChange).toHaveBeenLastCalledWith([])
    })
  })

  describe('row actions', () => {
    it('renders labelled icon buttons per row, links and handlers included', async () => {
      const onDelete = vi.fn()
      const { user } = renderWithProviders(
        <DataTable
          columns={columns}
          rows={rows}
          rowActions={(row) => [
            { label: 'Edit', icon: Pencil, to: `/items/${row.id}` },
            { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => onDelete(row.id), hidden: row.id === 3 },
          ]}
        />,
      )

      const first = screen.getByText('Alpha').closest('tr')
      expect(within(first).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/items/1')
      await user.click(within(first).getByRole('button', { name: 'Delete' }))
      expect(onDelete).toHaveBeenCalledWith(1)
      expect(within(screen.getByText('Gamma').closest('tr')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })
  })

  it('onRowClick fires for the row but not for its actions or checkbox', async () => {
    const onRowClick = vi.fn()
    const onDelete = vi.fn()
    const { user } = renderWithProviders(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} rowActions={() => [{ label: 'Delete', icon: Trash2, onClick: onDelete }]} />)

    await user.click(screen.getByText('Alpha'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(onDelete).toHaveBeenCalled()
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('supports a function rowKey and a caption for screen readers', () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={(row) => `k-${row.id}`} caption="People" />)
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument()
  })

  describe('horizontal scroll cue', () => {
    // jsdom has no layout: give the scroller the sizes a phone would
    const sized = (scroller, { scrollWidth, clientWidth, scrollLeft }) => {
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth })
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth })
      scroller.scrollLeft = scrollLeft
      fireEvent.scroll(scroller)
    }
    const edge = (container, side) => container.querySelector(`[data-edge="${side}"]`)

    it('fades in a shadow on each side that has more columns past it', () => {
      const { container } = renderWithProviders(<DataTable columns={columns} rows={rows} />)
      const scroller = screen.getByRole('table').parentElement
      expect(edge(container, 'start')).not.toHaveAttribute('data-visible')
      expect(edge(container, 'end')).not.toHaveAttribute('data-visible') // fits: no cue

      sized(scroller, { scrollWidth: 900, clientWidth: 390, scrollLeft: 0 })
      expect(edge(container, 'start')).not.toHaveAttribute('data-visible')
      expect(edge(container, 'end')).toHaveAttribute('data-visible')
      expect(edge(container, 'end')).toHaveAttribute('aria-hidden', 'true')

      sized(scroller, { scrollWidth: 900, clientWidth: 390, scrollLeft: 200 })
      expect(edge(container, 'start')).toHaveAttribute('data-visible')
      expect(edge(container, 'end')).toHaveAttribute('data-visible')

      sized(scroller, { scrollWidth: 900, clientWidth: 390, scrollLeft: 510 })
      expect(edge(container, 'start')).toHaveAttribute('data-visible')
      expect(edge(container, 'end')).not.toHaveAttribute('data-visible')
    })

    it('mirrors in RTL, where scrollLeft runs from 0 to negative values', () => {
      const { container } = renderWithProviders(<DataTable columns={columns} rows={rows} />, { lang: 'ar' })
      const scroller = screen.getByRole('table').parentElement
      expect(edge(container, 'start')).toHaveClass('start-0', 'bg-gradient-to-r', 'rtl:bg-gradient-to-l')

      sized(scroller, { scrollWidth: 900, clientWidth: 390, scrollLeft: 0 })
      expect(edge(container, 'start')).not.toHaveAttribute('data-visible')
      expect(edge(container, 'end')).toHaveAttribute('data-visible')

      sized(scroller, { scrollWidth: 900, clientWidth: 390, scrollLeft: -510 })
      expect(edge(container, 'start')).toHaveAttribute('data-visible')
      expect(edge(container, 'end')).not.toHaveAttribute('data-visible')
    })
  })
})
