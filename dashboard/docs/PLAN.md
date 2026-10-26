# NGP TechWorld — React admin dashboard: plan & shared contract

This file is the **single source of truth** for every agent working on the dashboard. Read it fully before
touching code. If reality contradicts it, follow the code you can see and report the deviation.

## 1. Goal

Replace the Filament admin panel with a **React dashboard** (`ngp-dashboard`) that controls **every section of the
platform**, including content that is hard-coded in the public site today (hero, About, process steps, values,
why-us, CTA, page headings, footer). Filament stays untouched and working until the React dashboard reaches
parity; removing it is a later, separate decision.

Decisions (already taken): separate project `ngp-dashboard` · Sanctum bearer tokens · Arabic-first RTL UI with an
English toggle · content editable in the DB with `ui.js` kept as the public-site fallback.

## 2. Projects & paths

| Project | Path | Stack |
|---|---|---|
| Backend | `C:\Users\Baraa\Desktop\NGP\ngp-backend` | Laravel 12, PHP 8.5 (`php` is on PATH), Pest 3, Filament 3.3 (leave alone), MariaDB |
| Public site | `C:\Users\Baraa\Desktop\NGP\ngpteckworld_frontend-design` | Vite 8 + React 19 + Tailwind 3 + Vitest 4 |
| Dashboard (new) | `C:\Users\Baraa\Desktop\NGP\ngp-dashboard` | same stack + libs listed in §7 |

Local servers already running: backend `http://127.0.0.1:8000`, public site `http://localhost:5173`.
The dashboard dev server will use port **5174** and proxy `/api` → `http://127.0.0.1:8000`.

## 3. Section inventory → API → dashboard page

| Section (public site) | Today | Admin API (`/api/admin/…`) | Dashboard page | Owner |
|---|---|---|---|---|
| Services | DB | `services` | Services | B2 → D1 |
| Projects (+cover, gallery, video, featured) | DB | `projects` | Projects | B3 → D2 |
| Project team members | DB | `projects/{id}/team-members` | inside Project form | B3 → D2 |
| Project links | DB | `projects/{id}/links` | inside Project form | B3 → D2 |
| Home stats | DB | `stats` | Stats | B2 → D1 |
| Testimonials | DB | `testimonials` | Testimonials | B2 → D1 |
| Partners | DB | `partners` | Partners | B2 → D1 |
| FAQ | DB | `faqs` (**done in Wave 0**) | FAQ (reference feature by D0) | D0 |
| Contact requests | DB | `requests` | Requests inbox | B4 → D3 |
| Contact email/phone/social links | DB | `settings` | Site settings | B4 → D3 |
| Overview numbers | – | `dashboard` | Dashboard home | B4 → D3 |
| Admin users / my account | DB | `users`, `auth/*` | Users & Account | B1 → D3 |
| Images | files | `uploads` | used by every image field | B1 |
| Hero, intro, About (story/vision/mission), values, why-us, process steps, CTA, page headings, footer | **static (`ui.js`)** | `content/texts`, `content-items` | Page content | B5 → D4, P1 (public side) |

## 4. Backend conventions (Laravel)

* Admin API base: **`/api/admin`**. JSON only. Auth header `Authorization: Bearer <token>`.
* Routes: one file per area **`routes/admin/<area>.php`**, auto-loaded inside `auth:sanctum` + `admin` middleware
  (`routes/admin.php` is the loader — never edit it). Route names are prefixed `admin.`.
  `routes/admin/auth.php` is the only public file (login) — protect anything that needs a token inside it.
* Controllers: `App\Http\Controllers\Admin\<Name>Controller extends AdminCrudController`.
  **Read `AdminCrudController.php` and the reference `FaqController.php` + `FaqAdminResource.php` +
  `routes/admin/faqs.php` + `tests/Feature/Admin/FaqAdminApiTest.php` first and copy that shape.**
* API resources: `App\Http\Resources\Admin\<Name>AdminResource` returning **every editable column**.
* Existing public API (`routes/api.php`, `App\Http\Controllers\Api\*`, `App\Http\Resources\*Resource`) and all
  Filament files are **off limits** (exception: B5 may add public content routes, see §6).
* List endpoints (`index`): `?page&per_page(≤200)&search&sort=<col>&dir=asc|desc&<filterable>=` →
  `{ "data":[…], "links":{…}, "meta":{ "current_page","last_page","per_page","total",… } }`.
* Single: `{ "data":{…} }`. Create → 201. Update → 200 (partial updates OK). Delete → 204. Reorder →
  `POST /x/reorder {"ids":[3,1,2]}` → 204 (sets `order` = position).
* Errors: 401 no/invalid token · 403 not an admin · 404 · 422 `{ "message", "errors":{field:[msgs]} }`.
* Images are stored on the `public` disk as a **relative path** (e.g. `projects/abc.jpg`). Admin resources return
  the path **and** an absolute URL: `logo` + `logo_url` = `asset('media/'.$path)` (or `null`). Write endpoints accept
  only the path (obtained from `POST /uploads`).
* Bilingual fields come in `_ar` / `_en` pairs; both required unless this file says nullable.
* Arrays stored as JSON (e.g. `features_ar`) are sent/received as real JSON arrays of strings.
* Tests: Pest, `tests/Feature/Admin/<Area>AdminApiTest.php`, `uses(RefreshDatabase::class)`, authenticate with the
  helper `actingAsAdmin()` from `tests/Pest.php` (`adminUser()` also exists). Cover: 401/403, list+search+filter,
  create, validation errors, update, delete, reorder, image/array fields. **Prefix any helper function you define in
  a test file with your area name** (all test files share one global namespace).
* Migrations must work on SQLite (tests) and MariaDB: no raw MySQL-only SQL, avoid `->change()`.
  Use your own timestamp prefix (see §9). New tables/columns must work after a plain `php artisan migrate --force`
  on a fresh production DB — do not rely on someone running a seeder.

## 5. Admin API contract

`✱` = required on create. "path" = relative image path from `POST /uploads`.

### Auth & account — B1
| Method | Path | Body → Response |
|---|---|---|
| POST | `auth/login` (public, throttled 5/min per email+IP) | `{email,password,device_name?}` → `{data:{token,user:{id,name,email}}}`; bad credentials 422 `errors.email`; non-admin 403 |
| GET | `auth/me` | → `{data:{id,name,email}}` |
| POST | `auth/logout` | revokes the current token → 204 |
| PUT | `auth/profile` | `{name,email}` → `{data:user}` |
| PUT | `auth/password` | `{current_password,password,password_confirmation}` → 204 (min 8) |

Tokens expire after 30 days (`config/sanctum.php` `expiration`). CORS: also allow `DASHBOARD_URL` (comma-separated
env, add to `config/cors.php` and `.env.example`; keep existing origins).

### Users — B1 (`users`, not orderable)
`id, name, email, created_at`. Write: `name✱`, `email✱` (unique, **must end with `@ngptechworld.com`**),
`password✱` on create (min 8; optional on update). Sort: id/name/email/created_at. Search: name, email.
Rules: 422 if you delete yourself or the last remaining admin.

### Uploads — B1
* `POST uploads` multipart: `file✱` (jpg, jpeg, png, webp, gif — **no SVG**, ≤ 5 MB, verify real image),
  `folder✱` ∈ `projects | projects/gallery | team | testimonials | partners | misc` → 201 `{data:{path,url}}`.
* `DELETE uploads` `{path}` → 204. Only inside the allowed folders; reject `..`/absolute paths; missing file = 204.

### Services / Stats / Testimonials / Partners — B2
* `services` — `id, icon_key✱(web|mobile|design|erp|cloud|ai|support), title_ar✱, title_en✱, description_ar✱,
  description_en✱, features_ar[], features_en[] (arrays of strings, default []), order`. Search: titles.
* `stats` (model `SiteStat`, table `site_stats`) — `id, value✱(string ≤20), label_ar✱, label_en✱, order`.
* `testimonials` — `id, name✱, company, quote_ar✱, quote_en✱, rating(1–5, default 5), avatar(path|null),
  avatar_url, is_active, order`. Filter: is_active. Search: name, company, quotes.
* `partners` — `id, name✱, logo(path|null), logo_url, url(nullable, valid http(s) URL), is_active, order`.
  Filter: is_active. Search: name.
* All four: reorder endpoint; deleting a record also deletes its uploaded file (`deleting()` hook).

### Projects — B3
* `projects` — `id, slug(unique; auto from name_en when omitted; a-z0-9-), category✱(web|mobile|ai|design|erp),
  client✱, year✱(int 1990–2100), status✱(completed|in_progress), featured(bool), name_ar✱, name_en✱, short_ar✱,
  short_en✱, description_ar✱, description_en✱, cover_image(path|null), cover_image_url, gallery[] (paths),
  gallery_urls[], video_url(nullable http(s) URL), order`. List adds `team_members_count`, `links_count`;
  filters: category, status, featured; search: slug, client, names. **Show** also returns `team_members[]` and `links[]`.
  Deleting a project deletes its team members, links and files.
* `projects/{project}/team-members` — `id, name✱, role_ar✱, role_en✱, tasks_ar[], tasks_en[], avatar(path|null),
  avatar_url, order` (+ reorder). Scoped to the project (404 for another project's member).
* `projects/{project}/links` — `id, type✱(website|github|behance|instagram|facebook|linkedin|x|whatsapp|other),
  url✱(http(s)), order` (+ reorder).

### Requests, settings, dashboard — B4
* `requests` (model `Contact`; **not orderable**, default sort `created_at desc`) — `id, name, email, phone, message,
  status(new|in_progress|done), admin_notes(nullable text, new column), created_at`. Filters: status; `from`/`to`
  (dates on created_at); search: name/email/phone/message. **No create** endpoint (they come from the public form).
  `PUT requests/{id}` `{status?, admin_notes?}`; `DELETE`; `POST requests/bulk` `{action:"status"|"delete", ids[],
  status?}` → 204; `GET requests/export` → `text/csv` (UTF-8 with BOM, respects the same filters).
* `settings` (singleton, model `SiteSetting`) — `GET settings` / `PUT settings` `{email,phone,facebook,instagram,
  linkedin,x,whatsapp}` (email valid; social fields nullable http(s) URLs) → `{data:{…}}`.
* `GET dashboard` → `{data:{counts:{services,projects,testimonials,partners,faqs,requests_total,requests_new,
  requests_in_progress,requests_done}, recent_requests:[5 newest], requests_last_30_days:[{date:"YYYY-MM-DD",
  count}] (30 entries, zeros included)}}`.

### Page content (CMS) — B5
Two tables: `site_contents` (`key` unique, `group`, `label`, `type` text|textarea, `value_ar`, `value_en`, `order`) and
`content_items` (`collection`, `title_ar`, `title_en`, `body_ar`, `body_en`, `icon_key`, `is_active`, `order`).
Keys are **defined in code** (config file) — the dashboard edits values only, never creates/deletes keys. Defaults
come from the current `C:\Users\Baraa\Desktop\NGP\ngpteckworld_frontend-design\src\i18n\ui.js` texts (both languages) so the public site looks identical
until someone edits. Must work on a fresh production DB right after `migrate` (insert defaults in the migration or
create missing rows on demand, idempotently; never overwrite edited values).

Keys (same names as in `ui.js`), by group:
* `home_hero`: heroBadge, heroT1, heroAccent, heroSub, heroCta1, heroCta2, intro
* `home_sections`: servicesKick, servicesTitle, servicesAll, featuredKick, featuredTitle, processKick,
  processTitle, processSub, testimonialsKick, testimonialsTitle, partnersKick, partnersTitle, faqKick, faqTitle
* `cta`: ctaTitle, ctaSub, ctaBtn
* `pages`: servicesSub, portfolioTitle, portfolioSub, contactTitle, contactSub
* `about`: aboutTitle, aboutStory, visionT, vision, missionT, mission, valuesT, whyT
* `footer`: footTagline, footRights

Long texts (`intro`, `heroSub`, `aboutStory`, `vision`, `mission`, `ctaSub`, `servicesSub`, `portfolioSub`,
`contactSub`, `processSub`) are `textarea`, the rest `text`.
Collections (from `ui.js`): `process_steps` (`processSteps`: title=`t`, body=`d`), `values` (`values`: title=`t`,
`icon_key` ∈ quality|innovation|commit|transparency, no body), `why_us` (`whyus`: title=`t`, body=`d`).

Admin endpoints:
* `GET content/texts` → `{data:[{group,label,items:[{key,label,type,value_ar,value_en}]}]}` (groups in the order above).
* `PUT content/texts` `{items:[{key,value_ar,value_en}]}` (unknown key → 422; each value nullable, ≤ 2000 chars)
  → same shape as GET.
* `content-items` — CRUD + reorder via `AdminCrudController`; `id, collection✱(process_steps|values|why_us),
  title_ar✱, title_en✱, body_ar, body_en, icon_key, is_active, order`; filter: `collection`, `is_active`.
  Reorder ids belong to one collection.

Public endpoint (no auth, added to `routes/api.php`): **`GET /api/content`** →
```json
{ "data": { "texts": { "heroBadge": {"ar":"…","en":"…"}, "…": {} },
            "collections": { "process_steps":[{"id":1,"title_ar":"","title_en":"","body_ar":"","body_en":"","icon_key":null}],
                             "values":[…], "why_us":[…] } } }
```
Only **active** items, ordered. Texts with an empty value in a language are still listed (the site treats
empty/null as "use the built-in default").

## 6. Public-site side of the CMS — P1
In `ngpteckworld_frontend-design`: a `ContentProvider` (`src/lib/SiteContent.jsx`) fetches `/api/content` once;
`LanguageContext` merges it over `ui.js`: for each text key with a non-empty value in the current language it
overrides `t[key]`; `t.processSteps` / `t.values` / `t.whyus` are replaced (mapped to the existing shapes
`{t,d}` / `{key,t}` / `{t,d}`) when the collection has ≥ 1 active item. API down or empty = today's behaviour.
Provider order in `main.jsx`: `ContentProvider` **outside** `LanguageProvider`. Existing tests must keep passing
(`LanguageProvider` rendered without a `ContentProvider` must work).

## 7. Dashboard conventions (React) — set by D0, used by D1–D4

Stack: Vite + React 19 + react-router-dom 7 + Tailwind 3 + Vitest/RTL (versions as in the public site) plus
`@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@dnd-kit/core`, `@dnd-kit/sortable`,
`@dnd-kit/utilities`, `lucide-react`. **Only D0 installs packages.** Anyone else needing another package must build it
locally instead and mention it in the report.

```
ngp-dashboard/
  docs/PLAN.md, docs/UI-KIT.md (D0 writes)
  src/app/        router (auto-collects features), layout (sidebar/topbar), AuthProvider, ProtectedRoute, Login page
  src/lib/        api.js (fetch wrapper), crud.js (createCrudHooks), format.js, storage.js
  src/i18n/       LanguageContext (ar default/RTL, en/LTR), common strings, useStrings()
  src/ui/         component kit (§7.2)
  src/features/<area>/index.jsx   default export { id, nav, routes }  ← auto-discovered via import.meta.glob
  src/features/<area>/strings.js  { ar:{…}, en:{…} }
```

### 7.1 Feature contract
`src/features/<area>/index.jsx` default-exports:
```js
{ id: 'faqs',
  nav: { order: 80, group: 'content', icon: HelpCircle /* lucide component */, label: {ar:'…', en:'…'}, to: '/faqs' },
  routes: [ { path: 'faqs', element: <FaqList/> }, { path: 'faqs/new', … }, { path: 'faqs/:id', … } ] }
```
The router collects all features automatically; **feature agents never edit `src/app`, `src/ui`, `src/lib`,
`src/i18n`** — if the kit lacks something, build a small local component inside the feature and report it.
Nav groups: `main` (Dashboard, Requests), `content` (Projects, Services, Stats, Testimonials, Partners, FAQ,
Page content), `system` (Site settings, Users & account). Nav orders: dashboard 10, requests 20, projects 30,
services 40, stats 50, testimonials 60, partners 70, faqs 80, page-content 90, settings 100, users 110.
Project registry (Phase 3a): registry 15 (main), catalogs 35 (content), audit-log 115 (system, super admin only).

### 7.2 UI kit (D0 builds, documents in `docs/UI-KIT.md`)
Button, IconButton, Input, Textarea, Select, Switch, Field (label/hint/error), **BilingualField** (ar+en pair, right
`dir` on each), **TagsInput** (list of strings: features/tasks), **ImageUpload** (single, uploads via `/uploads`,
preview, remove), **GalleryUpload** (multiple + reorder), **DataTable** (columns, loading, empty, sortable headers,
row actions, optional row selection), Pagination, SearchInput, Badge/StatusBadge, Modal, ConfirmDialog
(`useConfirm()`), Toast (`useToast()`), PageHeader, Card, Tabs, Spinner, EmptyState, **SortableList** (drag & drop
reorder), FormActions (save/cancel, disabled while pristine/saving).
Data hooks: `createCrudHooks('/faqs')` → `{ useList(params), useOne(id), useCreate(), useUpdate(), useDelete(),
useReorder() }` on react-query (invalidation + toasts). `api.get/post/put/delete/upload`; failures throw
`ApiError {status, message, errors}`; `applyServerErrors(setError, err)` maps 422 `errors` onto react-hook-form.
401 anywhere ⇒ clear the token and go to `/login`.

D0 also implements the **FAQ feature completely** (list with search/filter/active toggle/delete/drag-reorder, create &
edit form) as the reference feature for D1–D4, plus placeholder pages (`Coming soon`) registered for every other
nav item so the sidebar is complete.

Look & feel: reuse the public site's brand (dark purple background, purple `#6B4E8E/#9678BE`, gold `#C9A86A`,
fonts Cairo/Poppins) — read `ngpteckworld_frontend-design/tailwind.config.js` and `src/styles/tokens.css`.
Use Tailwind **logical properties** (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) so RTL just works.
Responsive (sidebar collapses on mobile). Keyboard/aria basics on modals and menus.

Dev: `npm run dev` on port 5174, proxy `/api` → `http://127.0.0.1:8000`, `.env.example` with
`VITE_API_BASE_URL=/api`, `vercel.json` SPA rewrite, token in `localStorage` key `ngp_admin_token`.

## 8. Rules for every agent

1. Work only inside your **ownership** (§9). Other agents run in parallel in the same working tree; never reformat,
   move or "clean up" files you do not own.
2. **Do not commit, push, deploy, or touch `.env`.** Do not run `php artisan migrate`/`db:seed` against the local
   database (other agents share it) and do not run `composer` or `npm install` (except D0). Backend tests use
   in-memory SQLite: run only your tests, e.g. `php artisan test tests/Feature/Admin/ServicesAdminApiTest.php`.
   Dashboard tests: `npx vitest run src/features/<area>`. Do not run `npm run build` (except D0/P1/integration).
3. Match the surrounding code style (PHP: 4 spaces, short array syntax; JS: 2 spaces, no semicolons, single quotes).
   Comments only where the *why* is not obvious.
4. Write tests for everything you build and make them pass. Report honestly: a failing or skipped test is reported
   as such.
5. Final report (≤ 40 lines): files created/changed, endpoints/pages delivered, test command + pass counts,
   deviations from this contract, open issues/assumptions.

## 9. Agents, ownership, waves

| Wave | Agent | Owns (may create/edit) |
|---|---|---|
| 0 | (orchestrator) | shared backend skeleton, this plan — **done** |
| 1 | **B1** auth-users-uploads | `routes/admin/auth.php`, `users.php`, `uploads.php`; `Admin/AuthController`, `UserController`, `UploadController`; their resources/requests/tests; `app/Models/User.php`; `config/cors.php`, `config/sanctum.php`, `.env.example` (append `DASHBOARD_URL` only). Migration prefix `2026_09_22_1000xx` |
| 1 | **B2** content-crud | `routes/admin/{services,stats,testimonials,partners}.php`, matching controllers/resources/tests. Migration prefix `2026_09_25_…` (only if truly needed) |
| 1 | **B3** projects | `routes/admin/projects.php`, `Admin/ProjectController`, `ProjectTeamMemberController`, `ProjectLinkController`, resources/tests. Prefix `2026_09_26_…` |
| 1 | **B4** requests-settings-dashboard | `routes/admin/{requests,settings,dashboard}.php`, controllers/resources/tests; `app/Models/Contact.php`. Migration prefix `2026_09_23_1000xx` (`admin_notes`) |
| 1 | **B5** cms-content | `routes/admin/content.php`, controllers/resources/tests, models `SiteContent`/`ContentItem`, `config/site_content.php`, seeder, `routes/api.php` (add **only** the `GET /content` line + import), `database/seeders/DatabaseSeeder.php` (add the seeder). Prefix `2026_09_24_1000xx` |
| 1 | **D0** dashboard-foundation | everything in `ngp-dashboard/` (the only agent that installs packages) |
| 1 | **P1** public-site-cms | `ngpteckworld_frontend-design/src/lib/SiteContent.jsx`, `src/i18n/LanguageContext.jsx`, `src/main.jsx`, related tests, README section |
| 2 | **D1** content-sections | `ngp-dashboard/src/features/{services,stats,testimonials,partners}/**` |
| 2 | **D2** projects | `src/features/projects/**` |
| 2 | **D3** requests-settings-users-home | `src/features/{dashboard,requests,settings,users}/**` |
| 2 | **D4** page-content | `src/features/page-content/**` |
| 3 | **Q1** integration · **Q2** security review | orchestrator-directed |

Out of scope for now: deleting Filament, deploying (Vercel/serv00), roles/permissions beyond "admin", changing the
public API shapes, committing to git.
