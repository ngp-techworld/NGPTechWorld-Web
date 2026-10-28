import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import common from '@/i18n/common'
import { deleteErrorText } from './errors'
import { makeUserSchema, toFormValues, toPayload } from './schema'
import strings from './strings'

const c = common.en
const t = strings.en

describe('makeUserSchema', () => {
  const create = makeUserSchema(c, t)
  const edit = makeUserSchema(c, t, { isEdit: true })
  const valid = { name: 'Omar', email: 'omar@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: ['requests'] }
  const messages = (schema, values) => (schema.safeParse(values).error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`)

  it('accepts a valid user', () => {
    expect(create.safeParse(valid).success).toBe(true)
  })

  it('accepts any email address, not only the ngptechworld.com domain', () => {
    expect(create.safeParse({ ...valid, email: 'omar@gmail.com' }).success).toBe(true)
    expect(create.safeParse({ ...valid, email: 'Omar@NGPTechWorld.COM' }).success).toBe(true)
  })

  it('still rejects a malformed email', () => {
    expect(create.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('requires a password of at least 8 characters on create, optional on edit', () => {
    expect(messages(create, { ...valid, password: '' })[0]).toBe('password: This field is required') // the form shows the first message
    expect(messages(create, { ...valid, password: '1234567' })).toEqual(['password: At least 8 characters'])
    expect(edit.safeParse({ ...valid, password: '' }).success).toBe(true)
    expect(messages(edit, { ...valid, password: '1234567' })).toEqual(['password: At least 8 characters'])
    expect(edit.safeParse({ ...valid, password: 'x'.repeat(256) }).success).toBe(false)
  })

  it('trims name and email but not the password', () => {
    const parsed = create.parse({ ...valid, name: '  Omar ', email: ' omar@ngptechworld.com ', password: ' pass word ' })
    expect(parsed).toMatchObject({ name: 'Omar', email: 'omar@ngptechworld.com', password: ' pass word ' })
  })

  it('requires at least one section for a limited admin, but nothing for a super admin', () => {
    expect(messages(create, { ...valid, role: 'admin', permissions: [] })).toEqual(['permissions: ' + t.permissionsRequired])
    expect(create.safeParse({ ...valid, role: 'super_admin', permissions: [] }).success).toBe(true)
  })

  it('rejects an unknown role or section', () => {
    expect(create.safeParse({ ...valid, role: 'owner' }).success).toBe(false)
    expect(create.safeParse({ ...valid, permissions: ['not-a-real-section'] }).success).toBe(false)
  })
})

describe('makeUserSchema with a registry role', () => {
  const create = makeUserSchema(c, t)
  const base = { name: 'Omar', email: 'omar@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: [] }

  it('lets a limited admin with a registry role have no section at all', () => {
    expect(create.safeParse({ ...base, registry_role: 'manager' }).success).toBe(true)
    expect(create.safeParse({ ...base, registry_role: '' }).success).toBe(false)
  })

  it('refuses an unknown registry role', () => {
    expect(create.safeParse({ ...base, permissions: ['requests'], registry_role: 'owner' }).success).toBe(false)
  })
})

describe('toPayload / toFormValues', () => {
  it('sends the password on create and only a non-empty one on edit', () => {
    const values = { name: 'A', email: 'a@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: ['requests'] }
    expect(toPayload(values)).toEqual(values)
    expect(toPayload({ ...values, password: '' }, { isEdit: true })).toEqual({ name: 'A', email: 'a@ngptechworld.com', role: 'admin', permissions: ['requests'] })
    expect(toPayload(values, { isEdit: true })).toEqual(values)
  })

  it('always sends an empty permissions list for a super admin, even if the form still has stale values', () => {
    const values = { name: 'A', email: 'a@ngptechworld.com', password: 'secret-pass-1', role: 'super_admin', permissions: ['requests'] }
    expect(toPayload(values)).toEqual({ ...values, permissions: [] })
  })

  it('never puts a password into the edit form', () => {
    expect(toFormValues({ id: 3, name: 'A', email: 'a@ngptechworld.com', role: 'admin', permissions: ['requests'], created_at: 'x' }))
      .toEqual({ name: 'A', email: 'a@ngptechworld.com', password: '', role: 'admin', permissions: ['requests'], registry_role: '' })
    expect(toFormValues({ id: 3, name: 'A', email: 'a@ngptechworld.com', role: 'admin', permissions: [], registry_role: 'manager' }).registry_role).toBe('manager')
  })

  it('sends the registry role of a limited admin (empty = null) and never one for a super admin', () => {
    const values = { name: 'A', email: 'a@ngptechworld.com', password: 'secret-pass-1', role: 'admin', permissions: [], registry_role: 'developer' }
    expect(toPayload(values)).toEqual(values)
    expect(toPayload({ ...values, registry_role: '' }).registry_role).toBeNull()
    expect(toPayload({ ...values, role: 'super_admin' })).not.toHaveProperty('registry_role')
  })
})

describe('deleteErrorText', () => {
  const fail = (status, message) => new ApiError({ status, message })

  it('localizes the self-delete guard message', () => {
    expect(deleteErrorText(fail(422, 'You cannot delete your own account.'), t, c)).toBe(t.guardSelf)
  })

  it('localizes the last-remaining-super-admin guard, which comes back as a field error on `role`', () => {
    const err = new ApiError({ status: 422, message: 'The given data was invalid.', errors: { role: ['The last remaining super admin cannot be deleted.'] } })
    expect(deleteErrorText(err, t, c)).toBe(t.guardLastSuperAdmin)
    expect(deleteErrorText(err, strings.ar, common.ar)).toBe(strings.ar.guardLastSuperAdmin)
  })

  it('shows any other 422 message as written, and the usual texts for other failures', () => {
    expect(deleteErrorText(fail(422, 'Something else.'), t, c)).toBe('Something else.')
    expect(deleteErrorText({ status: 422 }, t, c)).toBe(c.validationFailed) // no message at all
    expect(deleteErrorText(fail(500, 'boom'), t, c)).toBe(c.serverError)
    expect(deleteErrorText(fail(0), t, c)).toBe(c.networkError)
    expect(deleteErrorText(fail(403), t, c)).toBe(c.forbidden)
  })
})
