import { ShieldAlert, X } from 'lucide-react'
import { useStrings } from '@/i18n'
import { Alert, Button, IconButton } from '@/ui'
import strings from './strings'

/**
 * "Two-step sign-in is required to open internal and sensitive project data", linking to the account page where it
 * is turned on. Shown by the layout (from `auth/me`: mfa_required && !mfa_enabled) and by the project page when the
 * registry withholds its internal tabs. `onDismiss` adds a close button.
 */
export function MfaNotice({ onDismiss, className }) {
  const t = useStrings(strings)
  return (
    <Alert
      tone="warning"
      className={className}
      action={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" icon={ShieldAlert} to="/account#mfa">
            {t.mfaNoticeAction}
          </Button>
          {onDismiss ? <IconButton size="sm" icon={X} label={t.mfaNoticeDismiss} onClick={onDismiss} /> : null}
        </div>
      }
    >
      {t.mfaNotice}
    </Alert>
  )
}
