import { useMemo, useState } from 'react'
import { Gauge, Pencil, Plus, Trash2 } from 'lucide-react'
import { QUALITY_ATTRIBUTES, RecordDialog, actionErrorText, changedPayload, registryPath, valuesToPayload } from '@/features/registry/kit'
import { useCrudHooks } from '@/lib/crud'
import { errorText } from '@/lib/errors'
import { Alert, Button, Card, IconButton, Spinner, useConfirm, useToast } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

const LISTS = ['implemented', 'verified', 'assumptions', 'recommendations']

function AttributeCard({ attribute, record, canWrite, onEdit, onClear }) {
  const { t, r } = useRegistryEnv()
  const name = r.qualityAttributes[attribute] ?? attribute
  const filled = record ? LISTS.filter((list) => record[list]?.length) : []

  return (
    <Card
      title={name}
      aria-label={name}
      actions={
        record && canWrite ? (
          <>
            <IconButton size="sm" icon={Pencil} label={t.editAttribute(name)} onClick={onEdit} />
            <IconButton size="sm" icon={Trash2} tone="danger" label={t.clearAttribute(name)} onClick={onClear} />
          </>
        ) : record ? (
          <IconButton size="sm" icon={Pencil} label={r.viewItem(name)} onClick={onEdit} />
        ) : null
      }
    >
      {!record ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-faint">{t.notDocumented}</p>
          {canWrite ? (
            <Button size="sm" variant="secondary" icon={Plus} onClick={onEdit}>
              {t.documentAttribute(name)}
            </Button>
          ) : null}
        </div>
      ) : filled.length === 0 ? (
        <p className="text-sm text-faint">{r.none}</p>
      ) : (
        <dl className="space-y-3">
          {filled.map((list) => (
            <div key={list}>
              <dt className="text-xs font-bold text-muted">
                {t[list]} <span className="font-normal text-faint">· {t.itemsCount(record[list].length)}</span>
              </dt>
              <dd>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-soft">
                  {record[list].map((item) => (
                    <li key={item} dir="auto">
                      {item}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

/**
 * The 16 non-functional attributes as cards (one record per attribute, `quality-attributes`): what is implemented,
 * verified, assumed and recommended. An attribute without a record shows "not documented" and can be filled in.
 */
export function NonFunctionalTab({ registry }) {
  const { t, r, c } = useRegistryEnv()
  const toast = useToast()
  const confirm = useConfirm()
  const hooks = useCrudHooks(`${registryPath(registry.id)}/quality-attributes`)
  const list = hooks.useList({ per_page: 100, page: 1, sort: 'order', dir: 'asc' })
  const create = hooks.useCreate()
  const update = hooks.useUpdate()
  const remove = hooks.useDelete({ silent: true, onSuccess: () => toast.success(c.deleted), onError: (err) => toast.error(actionErrorText(err, r, c)) })
  const canWrite = registry.abilities.updateInternal
  const [editing, setEditing] = useState(null)

  const byAttribute = useMemo(() => new Map(list.rows.map((row) => [row.attribute, row])), [list.rows])
  const config = useMemo(
    () => ({
      fields: [
        ...LISTS.map((name) => ({ name, type: 'lines', label: t[name], maxItems: 30, itemMax: 1000, rows: 4 })),
        { name: 'evidence', type: 'lines', label: t.evidence, hint: t.evidenceHint, maxItems: 30, itemMax: 300, dir: 'ltr' },
      ],
    }),
    [t],
  )

  const save = async ({ values, fields, baseline }) => {
    if (editing.record) {
      const data = changedPayload(fields, baseline, values)
      if (Object.keys(data).length) await update.mutateAsync({ id: editing.record.id, data })
    } else {
      await create.mutateAsync({ attribute: editing.attribute, ...valuesToPayload(fields, values) })
    }
    setEditing(null)
  }

  const clear = async (record) => {
    const name = r.qualityAttributes[record.attribute] ?? record.attribute
    if (await confirm({ title: t.clearAttributeTitle, message: t.clearAttributeMessage(name), confirmLabel: c.delete })) remove.mutate(record.id)
  }

  const name = editing ? (r.qualityAttributes[editing.attribute] ?? editing.attribute) : ''

  return (
    <section aria-label={t.nonfunctionalTitle} className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Gauge size={18} aria-hidden="true" className="text-accent-lighter" />
          {t.nonfunctionalTitle}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{t.nonfunctionalDescription}</p>
      </div>
      {list.isError && list.rows.length === 0 ? (
        <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => list.refetch()}>{c.retry}</Button>}>
          {errorText(list.error, c)}
        </Alert>
      ) : list.isLoading ? (
        <div className="flex justify-center py-10 text-accent-lighter">
          <Spinner size={24} label={c.loading} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {QUALITY_ATTRIBUTES.map((attribute) => {
            const record = byAttribute.get(attribute)
            return (
              <AttributeCard
                key={attribute}
                attribute={attribute}
                record={record}
                canWrite={canWrite}
                onEdit={() => setEditing({ attribute, record: record ?? null })}
                onClear={() => clear(record)}
              />
            )
          })}
        </div>
      )}
      <RecordDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.record ? (canWrite ? t.editAttribute(name) : r.viewItem(name)) : t.documentAttribute(name)}
        config={config}
        record={editing?.record ?? null}
        canWrite={canWrite}
        onSubmit={save}
        saving={create.isPending || update.isPending}
      />
    </section>
  )
}
