import { useMemo } from 'react'
import { useRegistryEnv } from '@/features/projects/registry/useRegistryEnv'
import { useLanguage, useStrings } from '@/i18n'
import strings from './strings'

/**
 * What every profile section reads its labels from, in the current language: `t` the project page's registry
 * field labels, `r` the registry value lists, `c` common, `f` formatting, `pickField` / `pick`, and `p` the profile's own.
 */
export function useProfileEnv() {
  const env = useRegistryEnv()
  const p = useStrings(strings)
  const { pick, lang } = useLanguage()
  // `join(items)`: a short list in the reading language (the Arabic comma in Arabic)
  return useMemo(() => ({ ...env, p, pick, lang, join: (items) => items.join(lang === 'ar' ? '، ' : ', ') }), [env, p, pick, lang])
}
