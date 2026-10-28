// Per-section access control. Mirrors the backend's `App\Models\User::SECTIONS` exactly — a feature id here
// must be the same string as its `src/features/<id>/index.jsx`. Keep both lists in sync by hand; there is no
// single source of truth shared across the two codebases.
export const SECTIONS = ['faqs', 'page-content', 'partners', 'projects', 'requests', 'services', 'settings', 'stats', 'team', 'testimonials', 'offers', 'offer-requests', 'library']

/** Project registry roles (backend `User::REGISTRY_ROLES`), on top of the section permissions. */
export const REGISTRY_ROLES = ['viewer', 'developer', 'manager']

// Every signed-in admin gets this regardless of `permissions`: the signed-in admin's own profile/password.
const ALWAYS_VISIBLE = ['account']

// Features that are never a grantable section permission — a limited admin never sees them, however many
// SECTIONS they have (mirrors the backend's `super_admin`-only route groups: users.php, dashboard.php, and the
// registry audit trail, which holds full values of sensitive records).
const SUPER_ADMIN_ONLY = ['users', 'dashboard', 'audit-log']

// Visible only to the one account linked to it (mirrors the backend's per-request ownership check —
// TeamProfile.user_id — which no flat SECTIONS permission can express). Not gated by `permissions` at all:
// an admin with zero section permissions still sees this when their account has a linked team profile.
const SELF_SERVICE = { 'my-portfolio': (user) => Boolean(user.team_profile_id) }

const hasSection = (user, section) => (user.permissions ?? []).includes(section)

/** Any registry role (viewer | developer | manager). `auth/me` sends null for a super admin, who has every ability anyway. */
export const hasRegistryRole = (user) => Boolean(user?.registry_role)

// The registry screens (mirrors the backend's `ProjectPolicy::viewAny`): every registry role sees them, and the
// policy then decides per project what may be read or written. The catalogs are also what the `projects` section's
// content editors pick industries and technologies from. Imports sit behind the same `viewAny` (the API then needs
// `updatePublic` on the matched project, or `create` for a new one).
const REGISTRY_FEATURES = {
  registry: (user) => hasRegistryRole(user),
  catalogs: (user) => hasRegistryRole(user) || hasSection(user, 'projects'),
  imports: (user) => hasRegistryRole(user),
}

/** Can the signed-in `user` see this feature at all (nav item + its routes)? */
export function canAccessFeature(feature, user) {
  if (!user) return false
  if (ALWAYS_VISIBLE.includes(feature.id)) return true
  if (feature.id in SELF_SERVICE) return SELF_SERVICE[feature.id](user)
  if (SUPER_ADMIN_ONLY.includes(feature.id)) return Boolean(user.is_super_admin)
  if (user.is_super_admin) return true
  if (feature.id in REGISTRY_FEATURES) return REGISTRY_FEATURES[feature.id](user)
  return hasSection(user, feature.id)
}

/** The features array trimmed to what `user` may see — feeds both the sidebar and the route table, so a
 * limited admin can no more navigate straight to a URL than click their way to it. */
export function filterFeaturesByUser(features, user) {
  return features.filter((feature) => canAccessFeature(feature, user))
}

/**
 * Mirrors `ProjectPolicy::create` (also the write ability of the technology / industry catalogs): super admins,
 * the `projects` section's content editors and registry managers. Per-project abilities come from the API instead.
 */
export function canCreateProjects(user) {
  if (!user) return false
  return Boolean(user.is_super_admin) || hasSection(user, 'projects') || user.registry_role === 'manager'
}
