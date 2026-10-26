import { ExternalLink } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { canCreateProjects } from '@/app/permissions'
import { CollectionTab, GroupForm, registryPath, technologiesCatalog, useRefreshRegistry } from '@/features/registry/kit'
import { useCrudHooks } from '@/lib/crud'
import { Alert, Badge, Button } from '@/ui'
import {
  accountsConfig,
  backupsConfig,
  commandsConfig,
  databasesConfig,
  endpointsConfig,
  envVarsConfig,
  environmentsConfig,
  featuresConfig,
  integrationsConfig,
  maintenanceRecordsConfig,
  modulesConfig,
  repositoriesConfig,
  secretRefsConfig,
  serversConfig,
  technologiesConfig,
} from './collections'
import { authFields, dataFields, deploymentFields, monitoringFields } from './groups'
import { useProjectMembers } from './MembersCard'
import { useConfig, useRegistryEnv } from './useRegistryEnv'

// The registry tabs of the project page. Each receives the registry record (`registry`: abilities, operations groups)
// and renders CollectionTabs / GroupForms. A collection's list request has the same parameters as the CollectionTab
// showing it, so reading it here for a select (modules, databases) shares the same cached request.

/** The default list request of a CollectionTab (see CollectionTab): reused to read a collection for options. */
const LIST = { per_page: 100, page: 1, sort: 'order', dir: 'asc' }

function useCollectionRows(projectId, segment, enabled = true) {
  const hooks = useCrudHooks(`${registryPath(projectId)}/${segment}`)
  return hooks.useList(LIST, { enabled }).rows
}

const stack = 'space-y-10'

export function FeaturesTab({ registry }) {
  const env = useRegistryEnv()
  const refresh = useRefreshRegistry(registry.id)
  const modules = useCollectionRows(registry.id, 'modules')
  const modulesTab = useConfig(modulesConfig, env)
  const featuresTab = useConfig(featuresConfig, env)
  const canWrite = registry.abilities.updatePublic
  return (
    <div className={stack}>
      <CollectionTab resource={`${registryPath(registry.id)}/modules`} config={modulesTab} canWrite={canWrite} onChanged={refresh} />
      <CollectionTab resource={`${registryPath(registry.id)}/features`} config={featuresTab} canWrite={canWrite} ctx={{ modules }} onChanged={refresh} />
    </div>
  )
}

export function TechStackTab({ registry }) {
  const env = useRegistryEnv()
  const { user } = useAuth()
  const refresh = useRefreshRegistry(registry.id)
  const catalog = technologiesCatalog.useList({ per_page: 200, sort: 'name', dir: 'asc' }).rows
  const technologiesTab = useConfig(technologiesConfig, env)
  const integrationsTab = useConfig(integrationsConfig, env)
  const { abilities } = registry
  return (
    <div className={stack}>
      <div className="space-y-3">
        <CollectionTab resource={`${registryPath(registry.id)}/technologies`} config={technologiesTab} canWrite={abilities.updatePublic} ctx={{ catalog }} onChanged={refresh} />
        {canCreateProjects(user) ? (
          <Button size="sm" variant="ghost" icon={ExternalLink} to="/catalogs">
            {env.t.manageCatalog}
          </Button>
        ) : null}
      </div>
      {abilities.viewInternal ? (
        <CollectionTab resource={`${registryPath(registry.id)}/integrations`} config={integrationsTab} canWrite={abilities.updateInternal} />
      ) : null}
    </div>
  )
}

export function MaintenanceTab({ registry }) {
  const env = useRegistryEnv()
  const monitoring = useConfig(monitoringFields, env)
  const records = useConfig(maintenanceRecordsConfig, env)
  const { abilities, operations } = registry
  return (
    <div className={stack}>
      {operations?.monitoring ? (
        <GroupForm
          projectId={registry.id}
          group="monitoring"
          title={env.t.monitoringTitle}
          description={env.t.monitoringDescription}
          values={operations.monitoring}
          fields={monitoring}
          canWrite={abilities.updateInternal}
        />
      ) : null}
      <CollectionTab resource={`${registryPath(registry.id)}/maintenance-records`} config={records} canWrite={abilities.updateInternal} />
    </div>
  )
}

export function AccountsTab({ registry }) {
  const env = useRegistryEnv()
  const auth = useConfig(authFields, env)
  const accounts = useConfig(accountsConfig, env)
  const secretRefs = useConfig(secretRefsConfig, env)
  const { abilities, operations } = registry
  const secrets = useCollectionRows(registry.id, 'secret-refs')
  const toCreate = secrets.filter((secret) => secret.status === 'to_create').length
  return (
    <div className={stack}>
      {operations?.auth ? (
        <GroupForm
          projectId={registry.id}
          group="auth"
          title={env.t.authTitle}
          description={env.t.authDescription}
          values={operations.auth}
          fields={auth}
          canWrite={abilities.updateSensitive}
        />
      ) : null}
      <CollectionTab resource={`${registryPath(registry.id)}/accounts`} config={accounts} canWrite={abilities.updateSensitive} />
      <div className="space-y-3">
        {secrets.length ? (
          <Alert tone={toCreate ? 'warning' : 'success'}>
            <Badge tone={toCreate ? 'warning' : 'success'}>{env.t.toCreateCount(toCreate)}</Badge>
          </Alert>
        ) : null}
        <CollectionTab resource={`${registryPath(registry.id)}/secret-refs`} config={secretRefs} canWrite={abilities.updateSensitive} />
      </div>
    </div>
  )
}

export function EnvironmentsTab({ registry }) {
  const env = useRegistryEnv()
  const { user } = useAuth()
  const members = useProjectMembers(registry.id)
  const refresh = useRefreshRegistry(registry.id)
  const environments = useConfig(environmentsConfig, env)
  const endpoints = useConfig(endpointsConfig, env)
  const servers = useConfig(serversConfig, env)
  const canWrite = registry.abilities.updateSensitive
  // verified_by is a user id: name the people we know (the project's members, the signed-in admin)
  const userName = (id) => (id === user?.id ? user.name : (members.find((member) => member.user_id === id)?.user?.name ?? null))
  return (
    <div className={stack}>
      <CollectionTab resource={`${registryPath(registry.id)}/environments`} config={environments} canWrite={canWrite} onChanged={refresh} />
      <CollectionTab resource={`${registryPath(registry.id)}/endpoints`} config={endpoints} canWrite={canWrite} ctx={{ userName }} />
      <CollectionTab resource={`${registryPath(registry.id)}/servers`} config={servers} canWrite={canWrite} />
    </div>
  )
}

export function DeploymentTab({ registry }) {
  const env = useRegistryEnv()
  const refresh = useRefreshRegistry(registry.id)
  const deployment = useConfig(deploymentFields, env)
  const repositories = useConfig(repositoriesConfig, env)
  const commands = useConfig(commandsConfig, env)
  const envVars = useConfig(envVarsConfig, env)
  const { abilities, operations } = registry
  return (
    <div className={stack}>
      {operations?.deployment ? (
        <GroupForm
          projectId={registry.id}
          group="deployment"
          title={env.t.deploymentTitle}
          description={env.t.deploymentDescription}
          values={operations.deployment}
          fields={deployment}
          canWrite={abilities.updateSensitive}
        />
      ) : null}
      <CollectionTab resource={`${registryPath(registry.id)}/repositories`} config={repositories} canWrite={abilities.updateSensitive} onChanged={refresh} />
      <CollectionTab resource={`${registryPath(registry.id)}/commands`} config={commands} canWrite={abilities.updateSensitive} onChanged={refresh} />
      <CollectionTab resource={`${registryPath(registry.id)}/env-vars`} config={envVars} canWrite={abilities.updateSensitive} onChanged={refresh} />
    </div>
  )
}

export function DataTab({ registry }) {
  const env = useRegistryEnv()
  const refresh = useRefreshRegistry(registry.id)
  const databases = useCollectionRows(registry.id, 'databases')
  const data = useConfig(dataFields, env)
  const databasesTab = useConfig(databasesConfig, env)
  const backups = useConfig(backupsConfig, env)
  const { abilities, operations } = registry
  return (
    <div className={stack}>
      {operations?.data ? (
        <GroupForm
          projectId={registry.id}
          group="data"
          title={env.t.dataTitle}
          description={env.t.dataDescription}
          values={operations.data}
          fields={data}
          canWrite={abilities.updateSensitive}
        />
      ) : null}
      <CollectionTab resource={`${registryPath(registry.id)}/databases`} config={databasesTab} canWrite={abilities.updateSensitive} onChanged={refresh} />
      <CollectionTab resource={`${registryPath(registry.id)}/backups`} config={backups} canWrite={abilities.updateSensitive} ctx={{ databases }} onChanged={refresh} />
    </div>
  )
}
