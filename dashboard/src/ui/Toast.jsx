import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCommon } from '@/i18n'
import { cx } from '@/lib/cx'

const ToastContext = createContext(null)

const tones = {
  success: { icon: CheckCircle2, cls: 'border-success/40 text-success', duration: 4000 },
  error: { icon: XCircle, cls: 'border-danger/50 text-danger', duration: 7000 },
  warning: { icon: AlertTriangle, cls: 'border-warning/50 text-warning', duration: 6000 },
  info: { icon: Info, cls: 'border-info/40 text-info', duration: 4000 },
}
const MAX_VISIBLE = 4

let nextId = 1

/** Mounted once in the app (and in renderWithProviders). Renders the toast stack in the bottom corner. */
export function ToastProvider({ children }) {
  const c = useCommon()
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (input) => {
      const options = typeof input === 'string' ? { message: input } : input
      const tone = tones[options.type] ? options.type : 'info'
      const id = nextId++
      const duration = options.duration ?? tones[tone].duration
      setToasts((list) => [...list, { id, type: tone, message: options.message }].slice(-MAX_VISIBLE))
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration))
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((timer) => clearTimeout(timer))
  }, [])

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show({ ...options, type: 'success', message }),
      error: (message, options) => show({ ...options, type: 'error', message }),
      warning: (message, options) => show({ ...options, type: 'warning', message }),
      info: (message, options) => show({ ...options, type: 'info', message }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* toasts sit over the bottom-end corner where the Save buttons live: the toast body is click-through, only its close button takes clicks */}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => {
          const { icon: Icon, cls } = tones[toast.type]
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={cx('pointer-events-none flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-pop animate-toast-in', cls)}
            >
              <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              {/* isolated: an English server message keeps its punctuation in the Arabic UI */}
              <p className="min-w-0 flex-1 text-sm text-ink">
                <bdi>{toast.message}</bdi>
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={c.close}
                className="pointer-events-auto -me-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * const toast = useToast()
 * toast.success('Saved') · toast.error(msg) · toast.warning(msg) · toast.info(msg) · toast.show({ type, message, duration })
 * `duration` in ms (0 = stays until dismissed). Returns the toast id for toast.dismiss(id). The object is stable.
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>')
  return ctx
}
