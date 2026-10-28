import { useEffect, useRef, useState } from 'react'

/**
 * An image that holds its own space, shimmers while it loads, and fades in when it arrives.
 *
 * Every photo on this site comes from the dashboard over the network, so without this a card is a
 * flat block of colour that snaps to a photograph — and on a slow connection a page of them pops
 * one tile at a time. The wrapper is sized by the caller, so the layout never shifts either.
 *
 * `img.complete` is checked on mount and on every `src` change, and this is the part that is easy
 * to get wrong: a cached image can finish loading before React attaches `onLoad`, and a component
 * that only listens for the event shimmers forever over a picture that is already there.
 */
export default function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  style,
  objectPosition,
  fallback = null,
  eager = false,
  // Responsive candidates (the screenshot variants). Optional: without them `src` is the only file.
  srcSet,
  sizes,
}) {
  const imgRef = useRef(null)
  const [state, setState] = useState(src ? 'loading' : 'error')

  useEffect(() => {
    if (!src) { setState('error'); return }
    setState('loading')
    const el = imgRef.current
    // Already decoded (browser cache, or a re-render of the same src): no event is coming.
    if (el && el.complete) setState(el.naturalWidth > 0 ? 'loaded' : 'error')
  }, [src])

  return (
    <div className={'ngp-img ' + className} style={style}>
      {state !== 'loaded' && <span className="ngp-skel ngp-img__skel" aria-hidden="true" />}

      {src && state !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          data-state={state}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={(e) => setState(e.currentTarget.naturalWidth > 0 ? 'loaded' : 'error')}
          onError={() => setState('error')}
          className={'ngp-img__el ' + imgClassName}
          // Opacity inline rather than from a CSS rule. `imgClassName` lets callers pass their own
          // class (the team card passes one that also sets filter and transform), and whichever of
          // the two rules happens to come last in the built stylesheet then owns `opacity` — which
          // is a coin toss to bet the visibility of every photo on. Inline wins outright.
          style={{ opacity: state === 'loaded' ? 1 : 0, ...(objectPosition ? { objectPosition } : null) }}
        />
      )}

      {/* Shown only once the image is known to be unusable, so a slow load never flashes it. */}
      {state === 'error' && fallback}
    </div>
  )
}
