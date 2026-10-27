import { useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useCommon, useLanguage, useStrings } from '@/i18n'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { Alert, Avatar, BilingualField, BilingualTags, Button, Card, EmptyState, Field, IconButton, ImageUpload, Input, Modal, SortableList, Spinner, useConfirm } from '@/ui'
import { useProjectChildren } from './hooks'
import { TASKS_MAX, emptyMember, makeMemberSchema, memberToFormValues, memberToPayload } from './schema'
import strings from './strings'

const MEMBER_FORM_ID = 'project-member-form'

/** Form of the add / edit dialog. Mounted fresh every time the dialog opens, so it always starts from the right member. */
function MemberForm({ member, onSubmit, nameRef, onUploadingChange }) {
  const c = useCommon()
  const t = useStrings(strings)
  const schema = useMemo(() => makeMemberSchema(c), [c])
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: member ? memberToFormValues(member) : emptyMember() })
  const { ref: registerRef, ...nameField } = register('name')

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(memberToPayload(values))
    } catch (err) {
      applyServerErrors(setError, err) // 422 → field errors; anything else already produced a toast
    }
  })

  return (
    <form id={MEMBER_FORM_ID} onSubmit={submit} noValidate className="space-y-5 pb-2">
      <Field label={t.memberName} required error={errors.name}>
        <Input
          {...nameField}
          ref={(node) => {
            registerRef(node)
            nameRef.current = node
          }}
          dir="auto"
          autoComplete="off"
        />
      </Field>
      <BilingualField name="role" label={t.memberRole} register={register} errors={errors} required maxLength={255} />
      <BilingualTags name="tasks" label={t.memberTasks} hint={t.memberTasksHint} control={control} errors={errors} max={TASKS_MAX} />
      <Controller
        name="avatar"
        control={control}
        render={({ field }) => (
          <Field label={t.memberAvatar} error={errors.avatar}>
            <ImageUpload folder="team" shape="circle" value={field.value} url={member?.avatar_url} onChange={field.onChange} onUploadingChange={onUploadingChange} />
          </Field>
        )}
      />
    </form>
  )
}

function MemberModal({ open, member, onClose, onSubmit, saving }) {
  const c = useCommon()
  const t = useStrings(strings)
  const nameRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? t.memberEdit : t.memberNew}
      size="lg"
      closeOnBackdrop={false}
      initialFocusRef={nameRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {c.cancel}
          </Button>
          <Button type="submit" form={MEMBER_FORM_ID} loading={saving} disabled={uploading}>
            {saving ? c.saving : c.save}
          </Button>
        </>
      }
    >
      <MemberForm member={member} onSubmit={onSubmit} nameRef={nameRef} onUploadingChange={setUploading} />
    </Modal>
  )
}

/** One line of the team list: drag handle, avatar, name, role in both languages, number of tasks, actions. */
function MemberRow({ member, handle, isDragging, deleting, onEdit, onDelete }) {
  const t = useStrings(strings)
  const { lang, pickField } = useLanguage()
  const otherLang = lang === 'ar' ? 'en' : 'ar'
  const role = pickField(member, 'role')
  const otherRole = member[`role_${otherLang}`]
  const tasks = Math.max(member.tasks_ar?.length ?? 0, member.tasks_en?.length ?? 0)

  return (
    <div className={cx('flex items-center gap-3 rounded-xl border bg-white/[.03] px-3 py-2', isDragging ? 'border-accent-light' : 'border-white/[.08]')}>
      {handle}
      <Avatar src={member.avatar_url} name={member.name} alt="" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" dir="auto">
          {member.name}
        </p>
        <p className="truncate text-xs text-muted">
          <bdi lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {role}
          </bdi>
          {otherRole && otherRole !== role ? (
            <>
              {' · '}
              <bdi lang={otherLang} dir={otherLang === 'ar' ? 'rtl' : 'ltr'}>
                {otherRole}
              </bdi>
            </>
          ) : null}
          {tasks ? ` · ${t.tasksCount(tasks)}` : null}
        </p>
      </div>
      {onEdit ? <IconButton icon={Pencil} label={t.editMember(member.name)} onClick={onEdit} /> : null}
      {onDelete ? <IconButton icon={Trash2} tone="danger" label={t.deleteMember(member.name)} onClick={onDelete} disabled={deleting} /> : null}
    </div>
  )
}

/**
 * Team members of an existing project: live CRUD (add / edit in a dialog, delete with confirm, drag to reorder).
 * Without `canWrite` (the registry's `updatePublic`) the list is shown without any change control.
 */
export function TeamTab({ projectId, canWrite = true }) {
  const t = useStrings(strings)
  const c = useCommon()
  const confirm = useConfirm()
  const { list, create, update, remove, reorder } = useProjectChildren(projectId, 'team-members')
  const [dialog, setDialog] = useState({ open: false, member: null })
  const rows = list.rows

  const close = () => setDialog({ open: false, member: null })
  const save = async (payload) => {
    if (dialog.member) await update.mutateAsync({ id: dialog.member.id, data: payload })
    else await create.mutateAsync(payload)
    close()
  }
  const onDelete = async (member) => {
    const ok = await confirm({ title: t.deleteMemberTitle, message: t.deleteMemberMessage(member.name), confirmLabel: c.delete })
    if (ok) remove.mutate(member.id)
  }

  let body
  if (list.isError && rows.length === 0) {
    body = (
      <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => list.refetch()}>{c.retry}</Button>}>
        {errorText(list.error, c)}
      </Alert>
    )
  } else if (list.isLoading) {
    body = (
      <div className="flex justify-center py-10 text-accent-lighter">
        <Spinner size={24} label={c.loading} />
      </div>
    )
  } else if (rows.length === 0) {
    body = <EmptyState icon={Users} title={t.noMembers} description={t.noMembersHint} />
  } else {
    body = (
      <SortableList
        items={rows}
        ariaLabel={t.teamTitle}
        disabled={!canWrite}
        onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
        renderItem={(member, { handle, isDragging }) => (
          <MemberRow
            member={member}
            handle={canWrite ? handle : null}
            isDragging={isDragging}
            deleting={remove.isPending}
            onEdit={canWrite ? () => setDialog({ open: true, member }) : null}
            onDelete={canWrite ? () => onDelete(member) : null}
          />
        )}
      />
    )
  }

  return (
    <>
      <Card
        title={t.teamTitle}
        description={t.teamDescription}
        actions={
          canWrite ? (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ open: true, member: null })}>
              {t.addMember}
            </Button>
          ) : null
        }
      >
        {body}
      </Card>
      <MemberModal open={dialog.open} member={dialog.member} onClose={close} onSubmit={save} saving={create.isPending || update.isPending} />
    </>
  )
}
