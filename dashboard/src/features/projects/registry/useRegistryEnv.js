import { useMemo } from 'react'
import { useCommon, useFormat, useLanguage, useStrings } from '@/i18n'
import { registryStrings } from '@/features/registry/kit'
import strings from './strings'

/** What the collection configs and group field lists are built from, in the current language. */
export function useRegistryEnv() {
  const t = useStrings(strings)
  const r = useStrings(registryStrings)
  const c = useCommon()
  const f = useFormat()
  const { pickField } = useLanguage()
  return useMemo(() => ({ t, r, c, f, pickField }), [t, r, c, f, pickField])
}

/** A config built once per language: `useConfig(modulesConfig, env)`. */
export const useConfig = (factory, env) => useMemo(() => factory(env), [factory, env])
