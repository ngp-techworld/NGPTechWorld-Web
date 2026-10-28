import { describe, expect, it } from 'vitest'
import common from '@/i18n/common'
import { changedPayload, formNames, makeResolver, recordToValues, valuesToPayload } from './form'
import strings from './strings'

const c = common.en
const r = strings.en

const fields = [
  { name: 'key', type: 'text', required: true, max: 20, pattern: /^[a-z]+$/, patternMessage: 'lowercase' },
  { name: 'name', type: 'bilingual', required: true, max: 50 },
  { name: 'notes', type: 'textarea' },
  { name: 'url', type: 'url' },
  { name: 'count', type: 'number', min: 0, maxValue: 10 },
  { name: 'when', type: 'date' },
  { name: 'kind', type: 'select', options: [] },
  { name: 'status', type: 'select', nullable: false, defaultValue: 'open', options: [] },
  { name: 'auth_required', type: 'boolSelect' },
  { name: 'is_public', type: 'switch' },
  { name: 'tags', type: 'tags', maxItems: 2, itemPattern: /^[A-Z_]+$/ },
  { name: 'tests.exist', type: 'switch' },
  { name: 'tests.paths', type: 'lines' },
  { name: 'roles', type: 'objectList', fields: [{ name: 'role', type: 'text', required: true }, { name: 'commits', type: 'number' }] },
  { name: 'heading', type: 'section', label: 'Section' },
]

const record = {
  key: 'auth',
  name_ar: 'دخول',
  name_en: 'Sign-in',
  notes: null,
  url: null,
  count: 3,
  when: '2026-10-01T00:00:00.000000Z',
  kind: null,
  status: 'done',
  auth_required: false,
  is_public: true,
  tags: ['DB_HOST'],
  tests: { exist: true, paths: ['tests/a.php'] },
  roles: [{ role: 'admin', commits: 4, extra: 'kept' }],
}

describe('recordToValues', () => {
  it('turns a record into strings, booleans and lists the controls work with', () => {
    expect(recordToValues(fields, record)).toEqual({
      key: 'auth',
      name_ar: 'دخول',
      name_en: 'Sign-in',
      notes: '',
      url: '',
      count: '3',
      when: '2026-10-01',
      kind: '',
      status: 'done',
      auth_required: '0',
      is_public: true,
      tags: ['DB_HOST'],
      tests: { exist: true, paths: ['tests/a.php'] },
      roles: [{ role: 'admin', commits: '4', extra: 'kept' }],
    })
  })

  it('starts a new record from the defaults', () => {
    const values = recordToValues(fields, null, { status: 'open', is_public: true })
    expect(values).toMatchObject({ key: '', status: 'open', is_public: true, kind: '', auth_required: '', tags: [], roles: [] })
  })
})

describe('valuesToPayload / changedPayload', () => {
  it('sends blanks as null, numbers as integers, nested names nested and leaves out an unset non-nullable select', () => {
    const values = { ...recordToValues(fields, null), key: ' auth ', name_ar: 'أ', name_en: 'A', count: '7', auth_required: '1', roles: [{ role: 'x', commits: '' }] }
    expect(valuesToPayload(fields, { ...values, status: '' })).toEqual({
      key: 'auth',
      name_ar: 'أ',
      name_en: 'A',
      notes: null,
      url: null,
      count: 7,
      when: null,
      kind: null,
      auth_required: true,
      is_public: false,
      tags: [],
      tests: { exist: false, paths: [] },
      roles: [{ role: 'x', commits: null }],
    })
  })

  it('sends only the top-level keys that changed, a nested value whole', () => {
    const before = recordToValues(fields, record)
    const after = { ...before, notes: 'new', tests: { ...before.tests, exist: false } }
    expect(changedPayload(fields, before, after)).toEqual({ notes: 'new', tests: { exist: false, paths: ['tests/a.php'] } })
    expect(changedPayload(fields, before, before)).toEqual({})
  })
})

describe('makeResolver', () => {
  const resolve = makeResolver(fields, c, r)
  const valid = { ...recordToValues(fields, record) }

  it('accepts valid values', async () => {
    expect((await resolve(valid)).errors).toEqual({})
  })

  it('checks required, length, pattern, URL, number range, list size, list items and nested items', async () => {
    const { errors } = await resolve({
      ...valid,
      key: 'Bad Key',
      name_en: '',
      url: 'ftp://x',
      count: '11',
      tags: ['A', 'B', 'C'],
      roles: [{ role: '' }],
    })
    expect(errors.key.message).toBe('lowercase')
    expect(errors.name_en.message).toBe(c.required)
    expect(errors.url.message).toBe(c.invalidUrl)
    expect(errors.count.message).toBe(c.numberRange(0, 10))
    expect(errors.tags.message).toBe(r.maxItems(2))
    expect(errors.roles[0].role.message).toBe(c.required)
  })

  it('refuses list items that do not match the item pattern', async () => {
    expect((await resolve({ ...valid, tags: ['db-host'] })).errors.tags.message).toBe(r.invalidFormat)
  })
})

it('lists the names a form owns (bilingual fields twice, sections none)', () => {
  expect(formNames(fields)).toContain('name_ar')
  expect(formNames(fields)).toContain('tests.paths')
  expect(formNames(fields)).not.toContain('heading')
})
