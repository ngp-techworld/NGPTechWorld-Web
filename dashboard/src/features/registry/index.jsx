import { Boxes } from 'lucide-react'
import ProjectCreate from '@/features/projects/ProjectCreate'
import ProjectEdit from '@/features/projects/ProjectEdit'
import RegistryOverview from './RegistryOverview'
import RegistryProjectList from './RegistryProjectList'

// The project registry (spec §8): visible to super admins and every registry role (app/permissions.js). The
// project page itself belongs to the `projects` feature too; it is listed here so a registry-only account (no
// `projects` section) can open it — the route table keeps a shared path once (app/features.js buildRoutes).
export default {
  id: 'registry',
  nav: { order: 15, group: 'main', icon: Boxes, label: { ar: 'سجل المشاريع', en: 'Project registry' }, to: '/registry' },
  routes: [
    { path: 'registry', element: <RegistryOverview /> },
    { path: 'registry/projects', element: <RegistryProjectList /> },
    { path: 'projects/new', element: <ProjectCreate /> },
    { path: 'projects/:id', element: <ProjectEdit /> },
  ],
}
