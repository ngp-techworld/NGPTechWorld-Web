import { Tags } from 'lucide-react'
import CatalogsPage from './CatalogsPage'

// Technology and industry catalogs: super admins, every registry role and the `projects` section (app/permissions.js).
export default {
  id: 'catalogs',
  nav: { order: 35, group: 'content', icon: Tags, label: { ar: 'الكتالوجات', en: 'Catalogs' }, to: '/catalogs' },
  routes: [{ path: 'catalogs', element: <CatalogsPage /> }],
}
