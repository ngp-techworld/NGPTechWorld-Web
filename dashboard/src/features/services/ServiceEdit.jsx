import { useNavigate, useParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useCommon, useStrings } from '@/i18n'
import { errorText } from '@/lib/errors'
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from '@/ui'
import { ServiceForm } from './ServiceForm'
import { services } from './hooks'
import { toFormValues, toPayload } from './schema'
import strings from './strings'

export default function ServiceEdit() {
  const { id } = useParams()
  const t = useStrings(strings)
  const c = useCommon()
  const navigate = useNavigate()
  const { data: service, isLoading, isError, error, refetch } = services.useOne(id)
  const update = services.useUpdate()

  if (isLoading) return <PageSpinner />

  if (isError) {
    return error.status === 404 ? (
      <EmptyState icon={SearchX} title={t.notFoundTitle} description={c.itemNotFound} action={<Button to="/services">{t.title}</Button>} />
    ) : (
      <Alert tone="danger" title={c.loadFailed} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{c.retry}</Button>}>
        {errorText(error, c)}
      </Alert>
    )
  }

  const onSubmit = async (values) => {
    await update.mutateAsync({ id: service.id, data: toPayload(values) })
    navigate('/services')
  }

  return (
    <>
      <PageHeader title={t.editTitle} backTo="/services" backLabel={t.title} />
      <ServiceForm key={service.id} isEdit defaultValues={toFormValues(service)} onSubmit={onSubmit} saving={update.isPending} />
    </>
  )
}
