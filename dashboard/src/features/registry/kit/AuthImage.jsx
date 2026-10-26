import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { api } from '@/lib/api'
import { cx } from '@/lib/cx'
import { Skeleton } from '@/ui'

/**
 * The `/…` part after `/api/admin` of a URL the API built for one of its own authorized streams
 * (`route('admin.registry.files.*')`), or null for anything else (a public /media URL, an external link).
 */
export function apiPathOf(url) {
  if (!url) return null
  const match = /\/api\/admin(\/[^#]*)$/.exec(String(url))
  return match ? match[1] : null
}

/**
 * `src` for an <img>: a public URL as it is, an authorized stream fetched with the bearer token (an <img> cannot send
 * it) and turned into an object URL, revoked again when the component unmounts or the URL changes.
 */
export function useAuthorizedSrc(url) {
  const path = apiPathOf(url)
  const [state, setState] = useState({ src: path ? null : (url ?? null), failed: false })

  useEffect(() => {
    if (!path) {
      setState({ src: url ?? null, failed: false })
      return undefined
    }
    let cancelled = false
    let objectUrl = null
    setState({ src: null, failed: false })
    api
      .download(path)
      .then(({ blob }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ src: objectUrl, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true })
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, path])

  return { ...state, loading: Boolean(path) && !state.src && !state.failed }
}

/** <img> that also works for private screenshots (see useAuthorizedSrc). */
export function AuthImage({ src, alt = '', className, imgClassName }) {
  const image = useAuthorizedSrc(src)
  if (image.loading) return <Skeleton className={cx('h-full w-full', className)} />
  if (!image.src) {
    return (
      <span className={cx('flex h-full w-full items-center justify-center bg-white/[.04] text-faint', className)}>
        <ImageOff size={22} aria-hidden="true" />
      </span>
    )
  }
  return <img src={image.src} alt={alt} loading="lazy" className={cx('h-full w-full object-cover', className, imgClassName)} />
}
