import { FolderKanban } from 'lucide-react'
import ProjectCreate from './ProjectCreate'
import ProjectEdit from './ProjectEdit'
import ProjectList from './ProjectList'
// The project profile lives in the registry feature; it is offered here too so a `projects`-section editor without a
// registry role (who may view every project) can open it. The route table keeps the shared path once.
import { ProjectProfilePage } from '@/features/registry/profile/lazy'

// The feature contract (docs/PLAN.md §7.1): auto-discovered by src/app/features.js — no registration needed.
export default {
  id: 'projects',
  nav: { order: 30, group: 'content', icon: FolderKanban, label: { ar: 'المشاريع', en: 'Projects' }, to: '/projects' },
  routes: [
    { path: 'projects', element: <ProjectList /> },
    { path: 'projects/new', element: <ProjectCreate /> },
    { path: 'projects/:id', element: <ProjectEdit /> },
    { path: 'projects/:id/profile', element: <ProjectProfilePage /> },
  ],
}
