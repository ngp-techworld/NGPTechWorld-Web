import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCommon, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { Card, Checkbox, Field, FormActions, Input, PasswordInput, Select } from '@/ui'
import { REGISTRY_ROLES, SECTIONS, emptyUser, makeUserSchema, toPayload } from './schema'
import strings from './strings'

/**
 * Create / edit form of a dashboard user. `onSubmit(payload)` must return a promise: a 422 puts the server's
 * messages on the matching fields, other errors were toasted by the crud hook. On edit (`isEdit`) the password is
 * optional and Save stays disabled until something changed.
 */
export function UserForm({ defaultValues = emptyUser, onSubmit, saving = false, isEdit = false }) {
  const c = useCommon()
  const t = useStrings(strings)
  const schema = useMemo(() => makeUserSchema(c, t, { isEdit }), [c, t, isEdit])
  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues })

  const role = watch('role')
  const registryRole = watch('registry_role')
  const isLimited = role === 'admin'

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toPayload(values, { isEdit }))
    } catch (err) {
      if (applyServerErrors(setError, err) && err.errors?.role) {
        setError('role', { type: 'server', message: t.guardLastSuperAdmin }) // the API's text is English
      }
    }
  })

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5">
      <Card>
        <div className="space-y-5">
          <Field label={t.name} error={errors.name} required>
            <Input autoComplete="off" {...register('name')} />
          </Field>
          <Field label={t.email} error={errors.email} required>
            <Input type="email" autoComplete="off" {...register('email')} />
          </Field>
          <Field label={t.password} error={errors.password} required={!isEdit} hint={isEdit ? t.passwordHintEdit : t.passwordHintCreate}>
            <PasswordInput autoComplete="new-password" showLabel={t.showPassword} hideLabel={t.hidePassword} {...register('password')} />
          </Field>
        </div>
      </Card>

      <Card title={t.roleLabel}>
        <div className="space-y-5">
          <Field label={t.roleLabel} error={errors.role} required hint={isLimited ? t.roleAdminHint : t.roleSuperAdminHint}>
            <Select
              {...register('role')}
              options={[
                { value: 'admin', label: t.roleAdmin },
                { value: 'super_admin', label: t.roleSuperAdmin },
              ]}
            />
          </Field>

          {isLimited ? (
            <Field label={t.registryRoleLabel} error={errors.registry_role} hint={registryRole ? t.registryRoleHints[registryRole] : t.registryRoleNoneHint}>
              <Select
                {...register('registry_role')}
                options={[{ value: '', label: t.registryRoleNone }, ...REGISTRY_ROLES.map((value) => ({ value, label: t.registryRoles[value] }))]}
              />
            </Field>
          ) : null}

          {isLimited ? (
            <Field label={t.permissionsLabel} error={errors.permissions} required={!registryRole} hint={registryRole ? t.permissionsHintWithRegistry : t.permissionsHint}>
              <Controller
                name="permissions"
                control={control}
                render={({ field }) => (
                  <div role="group" aria-label={t.permissionsLabel} className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                    {SECTIONS.map((section) => {
                      const checked = field.value.includes(section)
                      return (
                        <Checkbox
                          key={section}
                          label={t.sections[section]}
                          checked={checked}
                          onChange={(next) => field.onChange(next ? [...field.value, section] : field.value.filter((s) => s !== section))}
                        />
                      )
                    })}
                  </div>
                )}
              />
            </Field>
          ) : null}
        </div>
      </Card>

      <FormActions saving={saving} dirty={isEdit ? isDirty : undefined} cancelTo="/users" />
    </form>
  )
}
