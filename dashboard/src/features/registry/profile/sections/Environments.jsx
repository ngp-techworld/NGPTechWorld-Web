import { Lock, Server } from 'lucide-react'
import { TONES } from '@/features/projects/registry/collections'
import { ENVIRONMENTS } from '../../kit'
import { Badge } from '@/ui'
import { useProfileEnv } from '../env'
import { Chips, Code, EnumBadge, ExternalLink, Facts, MissingHint, Part, PartSkeleton, ProfileSection, Prose, SubSection } from '../parts'

const CONFIDENCE_TONES = { confirmed: 'success', inferred: 'info', missing: 'warning' }
const envRank = (name) => {
  const index = ENVIRONMENTS.indexOf(name)
  return index === -1 ? ENVIRONMENTS.length : ENVIRONMENTS.length - 1 - index // production first, local last
}

function EndpointRow({ endpoint }) {
  const { t, r, f } = useProfileEnv()
  return (
    <li className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {endpoint.kind ? <Badge tone="accent">{r.endpointKinds[endpoint.kind] ?? endpoint.kind}</Badge> : null}
          <ExternalLink href={endpoint.url} />
        </div>
        <Prose text={endpoint.purpose} className="text-xs text-muted" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <EnumBadge value={endpoint.visibility} labels={r.visibilities} tones={{ public: 'success', private: 'neutral' }} />
        {endpoint.auth_required ? (
          <Badge>
            <Lock size={11} aria-hidden="true" />
            {t.authRequired}
          </Badge>
        ) : null}
        <EnumBadge value={endpoint.verification_status} labels={r.urlVerifications} tones={TONES.verification} />
        {endpoint.verification_status === 'confirmed' && endpoint.last_verified_at ? (
          <span className="text-[11px] text-muted">{t.verifiedBy(endpoint.verified_by_name ?? (endpoint.verified_by ? t.userN(endpoint.verified_by) : '—'), f.date(endpoint.last_verified_at))}</span>
        ) : null}
      </div>
    </li>
  )
}

function Environment({ environment, endpoints }) {
  const { p, t, r } = useProfileEnv()
  const name = environment?.name
  return (
    <li className="min-w-0 rounded-xl border border-white/[.07] bg-white/[.02]" data-profile-block="">
      <div className="space-y-2 border-b border-white/[.06] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {name ? <Badge tone={name === 'production' ? 'success' : 'info'}>{r.environments[name] ?? name}</Badge> : <Badge>{p.noEnvironment}</Badge>}
          {environment?.server_label ? (
            <span className="text-xs text-muted">
              {t.serverLabel}: <span dir="auto" className="text-soft">{environment.server_label}</span>
            </span>
          ) : null}
        </div>
        <Prose text={environment?.description} className="text-sm text-soft" />
        {environment?.config_files?.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{t.configFiles}:</span>
            <Chips values={environment.config_files} mono />
          </div>
        ) : null}
        <Prose text={environment?.notes} className="text-xs text-muted" />
      </div>
      {endpoints.length ? (
        <div className="px-4">
          <h4 className="sr-only">{p.linksTitle}</h4>
          <ul className="divide-y divide-white/[.05]">
            {endpoints.map((endpoint) => (
              <EndpointRow key={endpoint.id} endpoint={endpoint} />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

const SERVER_FIELDS = [
  ['hosting_provider', 'hostingProvider'],
  ['cloud_platform', 'cloudPlatform'],
  ['region', 'region'],
  ['os', 'os'],
  ['runtime', 'runtime'],
  ['cpu', 'cpu'],
  ['ram', 'ram'],
  ['storage_type', 'storageType'],
  ['public_hostname', 'publicHostname', 'code'],
  ['internal_hostname', 'internalHostname', 'code'],
  ['ip', 'ip', 'code'],
  ['ssh_access_method', 'sshAccessMethod'],
  ['ssh_port', 'sshPort', 'code'],
  ['reverse_proxy', 'reverseProxy'],
  ['tls_management', 'tlsManagement'],
  ['containerization', 'containerization'],
  ['dns_provider', 'dnsProvider'],
  ['domain_provider', 'domainProvider'],
  ['responsible_administrator', 'responsibleAdministrator'],
]

function ServerCard({ server }) {
  const { t, r } = useProfileEnv()
  const title = server.label || server.identifier || server.public_hostname || `#${server.id}`
  return (
    <li className="min-w-0 space-y-4 rounded-xl border border-white/[.07] bg-white/[.02] p-4" data-profile-block="">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="font-bold text-ink">
            {title}
          </p>
          {server.label && server.identifier ? <p className="text-xs text-muted" dir="auto">{server.identifier}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <EnumBadge value={server.environment} labels={r.environments} />
          {server.confidence ? (
            <Badge tone={CONFIDENCE_TONES[server.confidence] ?? 'neutral'}>
              {t.confidence}: {r.confidences[server.confidence] ?? server.confidence}
            </Badge>
          ) : null}
        </div>
      </div>
      <Facts
        items={SERVER_FIELDS.map(([field, label, kind]) => ({
          label: t[label],
          value: server[field] === null || server[field] === undefined || server[field] === '' ? null : kind === 'code' ? <Code value={String(server[field])} /> : String(server[field]),
        }))}
      />
      <Prose text={server.notes} className="text-xs text-muted" />
    </li>
  )
}

/**
 * Where the project runs: each environment with its links under it (links without an environment last), then the
 * servers as cards. The links are recorded, never called: "confirmed" means a person checked one.
 */
export function EnvironmentsSection({ data, missing }) {
  const { p, t } = useProfileEnv()
  const environments = data.environments
  const endpoints = data.endpoints
  const servers = data.servers

  const groups = () => {
    const rows = [...environments.rows].sort((a, b) => envRank(a.name) - envRank(b.name))
    const known = new Set(rows.map((row) => row.name))
    const byEnv = (name) => endpoints.rows.filter((endpoint) => (endpoint.environment ?? null) === name)
    const list = rows.map((row) => ({ key: `env-${row.id}`, environment: row, endpoints: byEnv(row.name) }))
    // links of an environment that has no record of its own, then those without one
    const orphanNames = [...new Set(endpoints.rows.map((endpoint) => endpoint.environment ?? null))].filter((name) => !known.has(name))
    orphanNames
      .sort((a, b) => (a === null ? 1 : b === null ? -1 : envRank(a) - envRank(b)))
      .forEach((name) => list.push({ key: `orphan-${name}`, environment: name ? { name } : null, endpoints: byEnv(name) }))
    return list
  }

  return (
    <ProfileSection id="environments" tier="sensitive" icon={Server} title={p.sections.environments}>
      {environments.isLoading || endpoints.isLoading ? (
        <PartSkeleton lines={4} />
      ) : (
        <>
          <Part query={environments} label={t.environmentsTitle}>
            {() => null}
          </Part>
          <Part query={endpoints} label={t.endpointsTitle}>
            {() => null}
          </Part>
          {(() => {
            const list = environments.isError && endpoints.isError ? [] : groups()
            return list.length ? (
              <SubSection title={t.environmentsTitle} count={environments.rows.length || undefined}>
                <ul className="space-y-3">
                  {list.map((group) => (
                    <Environment key={group.key} environment={group.environment} endpoints={group.endpoints} />
                  ))}
                </ul>
              </SubSection>
            ) : null
          })()}
        </>
      )}

      <Part query={servers} label={t.serversTitle}>
        {(rows) =>
          rows.length ? (
            <SubSection title={p.serversTitle} count={rows.length}>
              <ul className="grid gap-3 xl:grid-cols-2">
                {rows.map((server) => (
                  <ServerCard key={server.id} server={server} />
                ))}
              </ul>
            </SubSection>
          ) : null
        }
      </Part>

      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
