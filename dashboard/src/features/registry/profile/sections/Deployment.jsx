import { useMemo, useState } from 'react'
import { GitBranch, Rocket } from 'lucide-react'
import { Badge, Select } from '@/ui'
import { COMMAND_KINDS } from '../../kit'
import { useProfileEnv } from '../env'
import { Bullets, Chips, Code, CopyButton, EnumBadge, ExternalLink, Facts, Highlight, MissingHint, Part, ProfileSection, Prose, SearchCount, SubSection, VaultRef, YesNo, isWebUrl, useProfileSearch } from '../parts'

const CLASS_TONES = { confirmed_in_repo: 'success', tested: 'info', suggested: 'neutral' }

function Workflows({ workflows }) {
  const { t } = useProfileEnv()
  const list = (Array.isArray(workflows) ? workflows : []).filter((item) => item?.file)
  if (!list.length) return null
  return (
    <SubSection title={t.workflows} count={list.length}>
      <ul className="space-y-2">
        {list.map((workflow) => (
          <li key={workflow.file} className="space-y-1 rounded-xl border border-white/[.07] bg-white/[.02] p-3">
            <Code value={workflow.file} className="text-sm font-semibold text-ink" />
            {workflow.trigger ? (
              <p className="text-xs text-muted">
                {t.workflowTrigger}: <span dir="auto" className="text-soft">{workflow.trigger}</span>
              </p>
            ) : null}
            <Prose text={workflow.steps_summary} className="text-xs text-soft" />
          </li>
        ))}
      </ul>
    </SubSection>
  )
}

function Repositories({ query }) {
  const { p, t, r, f } = useProfileEnv()
  return (
    <Part query={query} label={t.repositoriesTitle}>
      {(rows) =>
        rows.length ? (
          <SubSection title={t.repositoriesTitle} count={rows.length}>
            <ul className="space-y-3">
              {rows.map((repo) => {
                const snapshot = repo.snapshot ?? {}
                const branches = [
                  [t.mainBranch, repo.main_branch],
                  [t.developmentBranch, repo.development_branch],
                  [t.productionBranch, repo.production_branch],
                ].filter(([, value]) => value)
                return (
                  <li key={repo.id} className="min-w-0 space-y-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4" data-profile-block="">
                    <div className="flex flex-wrap items-center gap-2">
                      <GitBranch size={16} aria-hidden="true" className="text-accent-lighter" />
                      {isWebUrl(repo.url) ? <ExternalLink href={repo.url} /> : <Code value={repo.url} />}
                      <EnumBadge value={repo.provider} labels={r.repositoryProviders} />
                      <EnumBadge value={repo.visibility} labels={r.repositoryVisibilities} />
                      {repo.component ? <Code value={repo.component} className="text-xs text-muted" /> : null}
                    </div>
                    <Facts
                      className="lg:grid-cols-3"
                      items={[
                        ...branches.map(([label, value]) => ({ label, value: <Code value={value} /> })),
                        { label: p.headCommit, value: snapshot.head_commit ? <Code value={String(snapshot.head_commit).slice(0, 12)} /> : null },
                        { label: p.currentBranch, value: snapshot.current_branch ? <Code value={snapshot.current_branch} /> : null },
                        { label: p.firstCommit, value: snapshot.first_commit_date ? f.date(snapshot.first_commit_date) : null },
                        { label: p.lastCommit, value: snapshot.last_commit_date ? f.date(snapshot.last_commit_date) : null },
                        { label: p.tags, value: snapshot.tags?.length ? <Chips values={snapshot.tags} mono /> : null },
                      ]}
                    />
                    {snapshot.dirty ? <Badge tone="warning">{p.dirty}</Badge> : null}
                    <Prose text={repo.notes} className="text-xs text-muted" />
                  </li>
                )
              })}
            </ul>
          </SubSection>
        ) : null
      }
    </Part>
  )
}

/** Commands grouped by kind (install, build, start, test…), each in a code block that can be copied. */
function Commands({ query }) {
  const { p, t, r } = useProfileEnv()
  return (
    <Part query={query} label={t.commandsTitle}>
      {(rows) => {
        if (!rows.length) return null
        const kinds = [...COMMAND_KINDS, ...new Set(rows.map((row) => row.kind).filter((kind) => !COMMAND_KINDS.includes(kind)))]
        return (
          <SubSection title={t.commandsTitle} count={rows.length}>
            <div className="space-y-5">
              {kinds.map((kind) => {
                const group = rows.filter((row) => row.kind === kind)
                if (!group.length) return null
                return (
                  <div key={kind} className="space-y-2" data-profile-block="">
                    <h4 className="text-xs font-bold text-muted">
                      {r.commandKinds[kind] ?? kind} <span className="font-normal text-faint">({group.length})</span>
                    </h4>
                    <ul className="space-y-2">
                      {group.map((row) => (
                        <li key={row.id} className="space-y-1">
                          <div className="flex items-start gap-1 rounded-xl border border-white/[.07] bg-deep/60">
                            <pre dir="ltr" className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all px-3 py-2 text-start font-mono text-[12.5px] text-ink">
                              <code>{row.command}</code>
                            </pre>
                            <CopyButton value={row.command} label={p.copyCommand(row.command)} message={p.commandCopied} className="m-1" />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted">
                            {row.component ? <Code value={row.component} className="text-xs" /> : null}
                            <EnumBadge value={row.classification} labels={r.commandClasses} tones={CLASS_TONES} />
                            {row.purpose ? <span dir="auto">{row.purpose}</span> : null}
                            {row.evidence ? <Code value={row.evidence} className="text-[11px] text-faint" /> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </SubSection>
        )
      }}
    </Part>
  )
}

function RunRequirements({ requirements }) {
  const { p, t } = useProfileEnv()
  const software = (Array.isArray(requirements?.software) ? requirements.software : []).filter((item) => item?.name)
  const managers = Array.isArray(requirements?.package_managers) ? requirements.package_managers : []
  if (!software.length && !managers.length) return null
  return (
    <SubSection title={p.runRequirements}>
      {software.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {software.map((item) => (
            <li key={item.name} className="min-w-0 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2">
              <p className="text-sm font-semibold text-ink">
                <bdi dir="ltr">{item.name}</bdi>
              </p>
              {item.version ? <p className="text-xs text-soft" dir="auto">{item.version}</p> : null}
              {item.evidence ? <Code value={item.evidence} className="text-[11px] text-faint" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {managers.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{t.packageManagers}:</span>
          <Chips values={managers} mono />
        </div>
      ) : null}
    </SubSection>
  )
}

const ANY = ''

/**
 * Every env var name of the project (names and purposes only: there is no place for values), filtered by the page
 * search and by component, secret and required, with the vault reference of the secret ones.
 */
export function EnvVarsTable({ rows }) {
  const { p, t, r } = useProfileEnv()
  const { matches } = useProfileSearch()
  const [component, setComponent] = useState(ANY)
  const [secret, setSecret] = useState(ANY)
  const [required, setRequired] = useState(ANY)
  const components = useMemo(() => [...new Set(rows.map((row) => row.component).filter(Boolean))].sort(), [rows])
  const yesNo = [
    { value: '1', label: r.yes },
    { value: '0', label: r.no },
  ]
  const bool = (value, wanted) => wanted === ANY || (wanted === '1' ? value === true : value === false)
  const shown = rows.filter(
    (row) =>
      (component === ANY || row.component === component) &&
      bool(Boolean(row.is_secret), secret) &&
      (required === ANY || bool(row.required, required)) &&
      matches(row.name, row.purpose, row.vault_ref, row.source_file, row.component),
  )

  return (
    <SubSection title={t.envVarsTitle} count={p.envVarsShown(shown.length, rows.length)} actions={<SearchCount shown={shown.length} />}>
      <p className="text-xs text-muted">{t.envVarsDescription}</p>
      <div className="flex flex-wrap gap-2" data-print-hide="">
        {components.length > 1 ? (
          <Select aria-label={t.componentField} value={component} onChange={(event) => setComponent(event.target.value)} placeholder={r.filterAll(t.componentField)} options={components.map((value) => ({ value, label: value }))} wrapperClassName="w-full sm:w-48" />
        ) : null}
        <Select aria-label={t.isSecret} value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={r.filterAll(t.isSecret)} options={yesNo} wrapperClassName="w-full sm:w-40" />
        <Select aria-label={t.required} value={required} onChange={(event) => setRequired(event.target.value)} placeholder={r.filterAll(t.required)} options={yesNo} wrapperClassName="w-full sm:w-40" />
      </div>
      <div className="max-h-[560px] overflow-auto rounded-xl border border-white/[.07] print:max-h-none">
        <table className="w-full min-w-[720px] border-collapse text-sm" aria-label={t.envVarsTitle}>
          <thead className="sticky top-0 z-[1] bg-raised">
            <tr className="border-b border-white/[.08] text-xs font-bold text-muted">
              <th scope="col" className="px-3 py-2.5 text-start">{t.envVarName}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{t.componentField}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{t.required}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{t.isSecret}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{t.vaultRef}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{t.purpose}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.05]">
            {shown.map((row) => (
              <tr key={row.id} className="align-top" data-env-var="">
                <td className="px-3 py-2">
                  <Code value={row.name} className="font-semibold text-ink" />
                </td>
                <td className="px-3 py-2">{row.component ? <Code value={row.component} className="text-xs" /> : <span className="text-faint">—</span>}</td>
                <td className="px-3 py-2 text-soft">
                  <YesNo value={row.required} />
                </td>
                <td className="px-3 py-2">{row.is_secret ? <Badge tone="warning">{t.isSecret}</Badge> : <span className="text-faint">{r.no}</span>}</td>
                <td className="px-3 py-2">{row.vault_ref ? <VaultRef value={row.vault_ref} /> : <span className="text-faint">—</span>}</td>
                <td className="px-3 py-2 text-xs text-soft" dir="auto">
                  <Highlight text={row.purpose} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length ? <p className="px-3 py-4 text-sm text-faint">{p.noMatches}</p> : null}
      </div>
    </SubSection>
  )
}

/** How the project is built, released and rolled back, where its code is, how to run it, and its env var names. */
export function DeploymentSection({ record, data, missing }) {
  const { p, t } = useProfileEnv()
  const deployment = record.operations?.deployment ?? {}
  return (
    <ProfileSection id="deployment" tier="sensitive" icon={Rocket} title={p.sections.deployment}>
      <SubSection title={p.howItShips}>
        <Facts
          items={[
            { label: t.deployMethod, value: deployment.deploy_method, wide: true },
            { label: t.ciCdProvider, value: deployment.ci_cd_provider },
            { label: t.releaseVersion, value: deployment.release_version ? <Code value={deployment.release_version} /> : null },
            { label: t.deployResponsibleAdmin, value: deployment.deploy_responsible_admin },
            { label: t.deployPermissions, value: deployment.deploy_permissions },
            { label: t.releaseStrategy, value: deployment.release_strategy, wide: true },
            { label: t.rollbackProcedure, value: deployment.rollback_procedure, wide: true },
            { label: t.deployVerification, value: deployment.deploy_verification, wide: true },
            { label: t.buildArtifacts, value: deployment.build_artifacts?.length ? <Bullets items={deployment.build_artifacts} /> : null, wide: true },
          ]}
        />
      </SubSection>
      <Workflows workflows={deployment.workflows} />
      <Repositories query={data.repositories} />
      <Commands query={data.commands} />
      <RunRequirements requirements={deployment.run_requirements} />
      <Part query={data['env-vars']} label={t.envVarsTitle} lines={6}>
        {(rows) => (rows.length ? <EnvVarsTable rows={rows} /> : null)}
      </Part>
      <MissingHint keys={missing} />
    </ProfileSection>
  )
}
