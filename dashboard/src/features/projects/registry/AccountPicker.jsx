import { useId, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { api } from '@/lib/api'
import { cx } from '@/lib/cx'
import { errorText } from '@/lib/errors'
import { Alert, Badge, Button, SearchInput, Spinner } from '@/ui'
import { useRegistryEnv } from './useRegistryEnv'

/** Accounts per search: the API refuses `per_page` above 50 (contract B2), and a short list reads better anyway. */
export const ACCOUNTS_PER_PAGE = 20

const accountsKey = (search) => ['registry', 'users', { search, per_page: ACCOUNTS_PER_PAGE }]

/**
 * The accounts that may become members, matching `search` (name or email): `GET registry/users?search=&per_page=20`
 * (contract B2: super admins and registry managers, behind the two-step sign-in gate). On a backend without it (404)
 * a super admin falls back to `GET /users`, filtered to the accounts that have a registry role. Resolves
 * `{ rows, total, partial? }` (`partial`: the fallback, whose `total` only counts the page it read).
 */
export function useAccountSearch(search, { enabled = true, isSuperAdmin = false } = {}) {
  return useQuery({
    queryKey: accountsKey(search),
    queryFn: async ({ signal }) => {
      const params = { search, per_page: ACCOUNTS_PER_PAGE }
      try {
        const res = await api.get('/registry/users', params, { signal })
        return { rows: res?.data ?? [], total: res?.meta?.total ?? res?.data?.length ?? 0 }
      } catch (err) {
        if (err.status !== 404 || !isSuperAdmin) throw err
        const res = await api.get('/users', { ...params, sort: 'name', dir: 'asc' }, { signal })
        const rows = (res?.data ?? []).filter((account) => account.registry_role)
        return { rows, total: rows.length, partial: true } // one page of every account, filtered here
      }
    },
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/**
 * Search-as-you-type choice of one account (the `user_id` of a new member), for a field list's `control`. The
 * search is debounced; the results are radio buttons (arrow keys move between them); accounts that are already
 * members are shown but cannot be picked. The chosen account stays named above the results while the search changes.
 */
export function AccountPicker({ value, onChange, onBlur, inputRef, label, hint, error, required, disabled, memberIds, isSuperAdmin, className }) {
  const { t, r, c } = useRegistryEnv()
  const id = useId()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(null)
  const results = useAccountSearch(search, { isSuperAdmin })
  const rows = results.data?.rows ?? []
  const total = results.data?.total ?? 0
  const selected = value === '' || value === null || value === undefined ? null : String(value)
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined

  const pick = (account) => {
    setPicked(account)
    onChange(String(account.id))
  }

  let list
  if (results.isLoading) {
    list = (
      <div className="flex justify-center py-6 text-accent-lighter">
        <Spinner size={20} label={c.loading} />
      </div>
    )
  } else if (results.isError && !rows.length) {
    list = (
      <Alert tone="danger" className="m-2" action={<Button size="sm" variant="secondary" onClick={() => results.refetch()}>{c.retry}</Button>}>
        {errorText(results.error, c)}
      </Alert>
    )
  } else if (!rows.length) {
    list = <p className="px-3 py-4 text-sm text-muted">{search ? t.noAccountMatches : t.noEligibleAccounts}</p>
  } else {
    list = (
      <ul className="divide-y divide-white/[.06]">
        {rows.map((account) => {
          const member = memberIds?.has(account.id)
          const checked = selected === String(account.id)
          return (
            <li key={account.id}>
              <label
                className={cx(
                  'flex items-center gap-3 px-3 py-2.5 transition-colors',
                  member || disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-white/[.04]',
                  checked && 'bg-accent/15',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-account`}
                  value={account.id}
                  checked={checked}
                  disabled={member || disabled}
                  onChange={() => pick(account)}
                  onBlur={onBlur}
                  className="size-4 shrink-0 accent-[#8160A8]"
                />
                <span className="min-w-0 flex-1">
                  <bdi className="block truncate text-sm font-semibold text-ink">{account.name}</bdi>
                  <bdi dir="ltr" className="block truncate text-xs text-muted">
                    {account.email}
                  </bdi>
                </span>
                {account.registry_role ? <Badge tone="accent">{r.registryRoles[account.registry_role] ?? account.registry_role}</Badge> : null}
                {member ? <Badge tone="neutral">{t.alreadyMember}</Badge> : null}
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  const pickedAccount = picked && String(picked.id) === selected ? picked : rows.find((account) => String(account.id) === selected)

  return (
    <fieldset className={cx('min-w-0', className)} aria-describedby={describedBy}>
      <legend className="mb-1.5 text-[13px] font-semibold text-soft">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-0.5 text-danger">
            *
          </span>
        ) : null}
      </legend>
      <SearchInput
        value={search}
        onChange={setSearch}
        delay={300}
        placeholder={t.memberSearchPlaceholder}
        aria-label={t.memberSearch}
        dir="auto"
        maxLength={100}
        autoComplete="off"
        disabled={disabled}
        ref={inputRef}
        className="sm:w-full"
      />
      {pickedAccount ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-soft">
          <Check size={15} aria-hidden="true" className="shrink-0 text-success" />
          <span className="min-w-0 truncate">
            {t.memberPicked(pickedAccount.name)} <bdi dir="ltr" className="text-xs text-muted">{pickedAccount.email}</bdi>
          </span>
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label={t.memberResults}
        aria-busy={results.isFetching || undefined}
        aria-invalid={error ? true : undefined}
        className={cx('mt-2 max-h-64 overflow-y-auto rounded-xl border bg-white/[.02]', error ? 'border-danger/60' : 'border-white/[.1]', results.isFetching && !results.isLoading && 'opacity-70')}
      >
        {list}
      </div>
      {rows.length && total > rows.length ? <p className="mt-1.5 text-xs text-muted">{t.moreAccounts(rows.length, total)}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  )
}
