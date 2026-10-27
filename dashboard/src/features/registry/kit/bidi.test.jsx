import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import importStrings from '@/features/imports/strings'
import projectRegistryStrings from '@/features/projects/registry/strings'
import { VAULT_PLACEHOLDER } from '@/features/projects/registry/collections'
import commonStrings from '@/i18n/common'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Field, TagsInput } from '@/ui'
import { VAULT_REF_PATTERN } from './enums'
import { ObjectListInput } from './ObjectListInput'
import kitStrings from './strings'

// every string value of a table, functions called with a sample argument
const texts = (table) =>
  Object.values(table).flatMap((value) => {
    if (typeof value === 'string') return [value]
    if (typeof value === 'function') return [String(value(3, 3))]
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
    if (value && typeof value === 'object') return texts(value)
    return []
  })
const tables = [kitStrings, projectRegistryStrings, importStrings, commonStrings]

describe('mixed-direction text', () => {
  it('gives every vault example its environment: vault://ngp/<slug>/<env>/<item>', () => {
    const examples = tables.flatMap((table) => [...texts(table.ar), ...texts(table.en)]).flatMap((text) => text.match(/vault:\/\/ngp\/[^\s\u2069,]*/g) ?? [])
    expect(examples.length).toBeGreaterThan(4)
    for (const example of examples.map((item) => item.replace(/\.$/, ''))) {
      expect(example.split('/').length, example).toBe(6) // vault: · '' · ngp · slug · env · item
      if (!example.includes('<')) expect(example, example).toMatch(VAULT_REF_PATTERN)
    }
    expect(VAULT_PLACEHOLDER).toBe('vault://ngp/<slug>/<env>/<item>')
  })

  it('isolates the Latin snippets that start or end with punctuation inside Arabic sentences', () => {
    const arabic = tables.flatMap((table) => texts(table.ar)).filter((text) => /[\u0600-\u06FF]/.test(text))
    const offending = arabic.filter((text) => /(^|[^\u2066])(vault:\/\/|https?:\/\/|ngp-portfolio\/)/.test(text))
    expect(offending).toEqual([])
  })

  it('types free text of the list editors in its own direction', () => {
    renderWithProviders(
      <ObjectListInput
        label="Roles"
        itemLabel="Role"
        fields={[
          { name: 'role', type: 'text', label: 'Role' },
          { name: 'summary', type: 'textarea', label: 'Summary' },
          { name: 'kind', type: 'select', label: 'Kind', options: [{ value: 'customer', label: 'Customer' }] },
          { name: 'key', type: 'text', label: 'Key', dir: 'ltr' },
        ]}
        value={[{ role: 'customer', summary: 'Book (verified email), list/cancel own bookings.', kind: 'customer', key: 'qr_guest' }]}
        onChange={() => {}}
      />,
      { lang: 'ar' },
    )
    expect(screen.getByLabelText('Role')).toHaveAttribute('dir', 'auto')
    expect(screen.getByLabelText('Summary')).toHaveAttribute('dir', 'auto')
    expect(screen.getByLabelText('Kind')).not.toHaveAttribute('dir')
    expect(screen.getByLabelText('Key')).toHaveAttribute('dir', 'ltr')
  })

  it('isolates field errors and tags, which may be English in the Arabic UI', () => {
    render(
      <>
        <Field label="Notes" error="The notes field is required.">
          <input />
        </Field>
        <TagsInput value={['DB_HOST', 'قاعدة']} onChange={() => {}} aria-label="Tags" />
      </>,
    )
    expect(screen.getByText('The notes field is required.').tagName).toBe('BDI')
    expect(screen.getByText('DB_HOST').tagName).toBe('BDI')
    expect(screen.getByRole('textbox', { name: 'Tags' })).toHaveAttribute('dir', 'auto')
  })
})
