import { useNavigate } from 'react-router-dom'
import { useStrings } from '@/i18n'
import { PageHeader } from '@/ui'
import { ServiceForm } from './ServiceForm'
import { services } from './hooks'
import { toPayload } from './schema'
import strings from './strings'

export default function ServiceCreate() {
  const t = useStrings(strings)
  const navigate = useNavigate()
  const create = services.useCreate()

  const onSubmit = async (values) => {
    await create.mutateAsync(toPayload(values))
    navigate('/services')
  }

  return (
    <>
      <PageHeader title={t.createTitle} backTo="/services" backLabel={t.title} />
      <ServiceForm onSubmit={onSubmit} saving={create.isPending} />
    </>
  )
}
