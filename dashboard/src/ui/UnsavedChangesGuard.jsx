import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'
import { useCommon } from '@/i18n'
import { ConfirmDialog } from './ConfirmDialog'

/** The browser's own "leave site?" prompt (a reload, a closed tab, a typed address) while `when` is true. */
export function useBeforeUnloadWarning(when) {
  useEffect(() => {
    if (!when) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = '' // older browsers need it set to show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])
}

// Mounted only while there are unsaved changes: a router keeps one blocker at a time, so idle cards must not hold one.
// Only a change of page is blocked; a change of the query alone (`?tab=`) keeps the page, and its edits, mounted.
function RouteBlocker({ title, message, confirmLabel, cancelLabel }) {
  const c = useCommon()
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname)
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={title ?? c.unsavedTitle}
      message={message ?? c.unsavedMessage}
      confirmLabel={confirmLabel ?? c.unsavedLeave}
      cancelLabel={cancelLabel ?? c.unsavedStay}
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  )
}

/**
 * Asks before unsaved changes are lost, while `when` is true:
 *   - leaving the page through the app (a sidebar link, Back): a confirm dialog — "stay" keeps the edits, "leave"
 *     goes on (React Router's `useBlocker`, which needs the data router that App and renderWithProviders use);
 *   - a reload, a closed tab or a typed address: the browser's own prompt (`beforeunload`).
 *
 *   <UnsavedChangesGuard when={dirty} />
 *
 * Outside a data router (a bare <MemoryRouter> in an old test) only the browser prompt is kept.
 */
export function UnsavedChangesGuard({ when, title, message, confirmLabel, cancelLabel }) {
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  useBeforeUnloadWarning(Boolean(when))
  return dataRouter && when ? <RouteBlocker title={title} message={message} confirmLabel={confirmLabel} cancelLabel={cancelLabel} /> : null
}
