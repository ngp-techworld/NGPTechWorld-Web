import { lazy } from 'react'

// The profile page, loaded on first visit. One lazy component for both features that offer the route (registry and
// projects), so the shared path renders the very same page (app/features.js keeps it once).
export const ProjectProfilePage = lazy(() => import('./ProjectProfile'))
