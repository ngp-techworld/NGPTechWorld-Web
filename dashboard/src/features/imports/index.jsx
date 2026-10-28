import { lazy } from 'react'
import { FolderInput } from 'lucide-react'

// loaded on first visit (the layout wraps every routed page in <Suspense>); fflate only when a folder is zipped
const ImportsPage = lazy(() => import('./ImportsPage'))
const ImportBatchPage = lazy(() => import('./ImportBatchPage'))

// Project imports (Phase 2): upload a discovery package, review the field-by-field preview, apply it and read the
// report. Visible to super admins and every registry role (app/permissions.js), like the registry itself.
export default {
  id: 'imports',
  nav: { order: 16, group: 'main', icon: FolderInput, label: { ar: 'استيراد المشاريع', en: 'Import projects' }, to: '/imports' },
  routes: [
    { path: 'imports', element: <ImportsPage /> },
    { path: 'imports/:id', element: <ImportBatchPage /> },
  ],
}
