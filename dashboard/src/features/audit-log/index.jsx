import { ScrollText } from 'lucide-react'
import AuditLogPage from './AuditLogPage'

// Super admins only (app/permissions.js): the trail holds full values of sensitive records.
export default {
  id: 'audit-log',
  nav: { order: 115, group: 'system', icon: ScrollText, label: { ar: 'سجل التدقيق', en: 'Audit log' }, to: '/audit-log' },
  routes: [{ path: 'audit-log', element: <AuditLogPage /> }],
}
