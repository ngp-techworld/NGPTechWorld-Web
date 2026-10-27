# UI kit & feature guide

Everything a feature agent (D1–D4) needs. **Read `src/features/faqs/` next to this file** — it is the reference
implementation and every recipe below is taken from it. Binding contract: [`PLAN.md`](./PLAN.md) §7.

* Feature agents edit only their own `src/features/<area>/**`. `src/app`, `src/ui`, `src/lib`, `src/i18n`, `src/test`
  belong to D0: if the kit lacks something, build a small local component inside your feature and say so in the report.
* Style: 2 spaces, no semicolons, single quotes, named exports for components (feature *pages* default-export).
* Import alias: `@` = `src/` (`@/ui`, `@/lib/api`, `@/i18n`, `@/test/…`). Relative imports work too.

## 1. Cheat sheet

```js
import { Button, Card, DataTable, PageHeader, Pagination, useConfirm, useToast … } from '@/ui'
import { useCommon, useStrings, useLanguage, useFormat } from '@/i18n'
import { api, ApiError } from '@/lib/api'
import { createCrudHooks, useCrudHooks } from '@/lib/crud'
import { useListParams } from '@/lib/useListParams'
import { applyServerErrors } from '@/lib/applyServerErrors'
import { emptyToNull, intField, optionalUrl, requiredText } from '@/lib/validation'
import { errorText } from '@/lib/errors'
import { renderWithProviders, createWrapper } from '@/test/renderWithProviders'
import { mockApi, paginated, reply, replyText, validationError } from '@/test/mockApi'
```

Providers that already wrap every page (app and tests): react-query, language, toast, confirm, router, auth. Pages
never mount them.

## 2. Adding a feature

### 2.1 Folder layout (copy `features/faqs`)

```
src/features/<area>/
  index.jsx        default export { id, nav, routes }   ← auto-discovered, nothing to register
  strings.js       { ar: {…}, en: {…} }                  feature-specific texts only
  hooks.js         export const things = createCrudHooks('/things')
  schema.js        zod schema + emptyX + toFormValues(record)
  ThingList.jsx    list page            (default export)
  ThingForm.jsx    shared form component (named export)
  ThingCreate.jsx / ThingEdit.jsx
  *.test.jsx
```

### 2.2 `index.jsx` (contract, PLAN §7.1)

```jsx
import { HelpCircle } from 'lucide-react'
export default {
  id: 'faqs',                                     // unique
  nav: { order: 80, group: 'content',             // main | content | system  (orders: PLAN §7.1)
         icon: HelpCircle, label: { ar: 'الأسئلة الشائعة', en: 'FAQ' }, to: '/faqs' },
  routes: [                                       // relative paths, rendered inside the layout
    { path: 'faqs', element: <FaqList /> },
    { path: 'faqs/new', element: <FaqCreate /> },
    { path: 'faqs/:id', element: <FaqEdit /> },   // `{ index: true, element }` is allowed (dashboard home = '/')
  ],
}
```

Replacing a placeholder = replace its folder's `index.jsx` (keep `id`, `nav.order`, `nav.group`, `nav.to`). `nav` may be omitted for a
feature without a menu entry. Rarely used heavy pages can be lazy (`const Chart = lazy(() => import('./Chart'))`): the layout
already wraps every routed page in `<Suspense>` and an error boundary.

### 2.3 Strings

```js
// strings.js
export default {
  ar: { title: 'الخدمات', deleteMessage: (name) => `حذف «${name}»؟` },
  en: { title: 'Services', deleteMessage: (name) => `Delete “${name}”?` },
}
// component
const t = useStrings(strings)   // table of the current language (missing keys fall back to the other language)
const c = useCommon()           // shared: c.save c.cancel c.delete c.edit c.active c.inactive c.status c.all c.required
                                //         c.maxLength(n) c.invalidEmail c.invalidUrl c.noResults … see src/i18n/common.js
```

Rules: never hard-code user-facing text; values may be functions; the merge is shallow (give nested objects in both
languages); write Arabic properly (it is the primary language). Bilingual **data** fields are `_ar/_en` pairs — display
with `const { pickField, pick, lang, isAr, dir } = useLanguage()`: `pickField(row, 'title')` → `title_ar` or `title_en`
(falls back to the other language when empty); `pick(arValue, enValue)` / `pick({ ar, en })` for static pairs.

### 2.4 List page recipe (`FaqList.jsx`)

```jsx
const DEFAULTS = { per_page: 15, sort: 'order', dir: 'asc' }          // constant, outside the component

const list = useListParams(DEFAULTS)                                   // state lives in the URL (?page&search&sort…)
const { rows, meta, isLoading, isFetching, isError, error, refetch } = things.useList(list.params)
const remove = things.useDelete()
const confirm = useConfirm()

<PageHeader title={t.title} description={t.description} actions={<Button to="/things/new" icon={Plus}>{t.new}</Button>} />
<SearchInput value={list.params.search ?? ''} onChange={(search) => list.set({ search })} />
<Select aria-label={c.status} value={list.params.is_active ?? ''} onChange={(e) => list.set({ is_active: e.target.value })} options={…} />
<DataTable
  columns={columns} rows={rows} loading={isLoading} busy={isFetching && !isLoading}
  sort={list.sort} onSortChange={list.setSort}
  rowActions={(row) => [
    { label: c.edit, icon: Pencil, to: `/things/${row.id}` },
    { label: c.delete, icon: Trash2, tone: 'danger', onClick: () => onDelete(row) },
  ]}
  emptyTitle={list.hasFilters ? c.noResults : t.emptyTitle} emptyAction={…}
/>
<Pagination meta={meta} onPageChange={list.setPage} onPerPageChange={list.setPerPage} />
```

* Delete: `if (await confirm({ title, message, confirmLabel: c.delete })) remove.mutate(row.id)`.
* Inline toggle: `<Switch checked={…} onChange={(is_active) => update.mutate({ id: row.id, data: { is_active } })} aria-label=… />`;
  show the pending value while `update.isPending && update.variables?.id === row.id` (see FaqList).
* Only sort by columns the API allows (`sortable` in the controller: usually `id, order, created_at` + a few). Columns
  the API cannot sort must not be `sortable`.
* Loading/error/empty: skeleton via `loading`, dimmed rows via `busy`, `<Alert tone="danger" action={retry}>` when
  `isError && rows.length === 0`, empty text via `emptyTitle/emptyDescription/emptyAction`.
* Filters: booleans travel as `'1'`/`'0'` strings in the URL and are sent as-is; `api` also converts real booleans to 1/0.

### 2.5 Form page recipe (`FaqForm.jsx`, `FaqCreate.jsx`, `FaqEdit.jsx`)

react-hook-form + zod + `applyServerErrors`. The form component takes `defaultValues`, `onSubmit(values)` (returns a promise)
and `saving`; the *pages* own the data hooks.

```jsx
// schema.js — built from the common strings so messages follow the UI language (helpers: @/lib/validation)
import { emptyToNull, intField, optionalUrl, requiredText } from '@/lib/validation'
export const makeSchema = (c) => z.object({
  question_ar: requiredText(c, 255),                 // trimmed, required, max 255 (mirror the API rule)
  year: intField(c, { min: 1990, max: 2100 }),       // <input type="number"> gives strings → coerced integer
  video_url: optionalUrl(c),                         // '' allowed, otherwise http(s) URL
  is_active: z.boolean(),
})
// nullable API fields: toPayload = (v) => ({ ...v, video_url: emptyToNull(v.video_url) })

// Form.jsx
const schema = useMemo(() => makeSchema(c), [c])
const { register, control, handleSubmit, setError, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(schema), defaultValues })
const submit = handleSubmit(async (values) => {
  try { await onSubmit(values) } catch (err) { applyServerErrors(setError, err) }   // 422 → field errors; others already toasted
})
<form onSubmit={submit} noValidate>                       {/* noValidate: zod + server validate, not the browser */}
  <BilingualField name="question" label={t.question} register={register} errors={errors} required />
  <Field label="Client" error={errors.client} required><Input {...register('client')} /></Field>
  <Controller name="is_active" control={control} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={c.active} />} />
  <FormActions saving={saving} dirty={isEdit ? isDirty : undefined} cancelTo="/things" />
</form>

// Create page
const create = things.useCreate()
onSubmit = async (values) => { await create.mutateAsync(values); navigate('/things') }
// Edit page: load → then mount the form so defaultValues are the record (never reset() on a background refetch)
const { data: record, isLoading, isError, error } = things.useOne(id)     // data is the record itself
<ThingForm key={record.id} isEdit defaultValues={toFormValues(record)} onSubmit={(values) => update.mutateAsync({ id: record.id, data: values }).then(() => navigate('/things'))} />
```

* `Field` wires label / id / hint / error / `aria-invalid` to the control inside it (Input, Textarea, Select, TagsInput,
  Switch, ImageUpload). `error` may be a string or an RHF `FieldError` (`errors.client`).
* Validation helpers (`@/lib/validation`, all take the common strings `c`): `requiredText(c, max)`, `optionalText(c, max)`,
  `requiredUrl(c)`, `optionalUrl(c)`, `requiredEmail(c)`, `intField(c, { min, max })` (number inputs arrive as strings),
  `emptyToNull(value)`. zod is v4 (`z.string().trim().min(1, msg)` etc.; custom errors use `{ error: … }`, not `required_error`).
* Nullable / optional server fields: map `''` → `null` (`emptyToNull`) in a `toPayload(values)` helper before sending.
* The API's validation is authoritative; a 422 is shown on the same fields (`applyServerErrors`) and the first invalid
  field is focused. Fields the form does not show land in `errors.root.server.message` (render an `<Alert>` if useful).
* **Multi-tab forms** (projects): one `useForm` for the whole form, `<Tabs>` + `<TabPanel keepMounted …>` so inputs of
  closed tabs stay mounted (their values and their server errors survive, and focus works). Put an error count in the
  tab `badge`.
* Nested resources (`/projects/{id}/team-members`): `const members = useCrudHooks(`/projects/${id}/team-members`)` inside
  the component; pass `onSuccess` to `useCreate/useUpdate/useDelete` to invalidate the parent
  (`queryClient.invalidateQueries({ queryKey: projects.keys.one(id) })`).

### 2.6 Image fields

The API stores a **relative path**; write endpoints accept only that path; admin resources return `logo` (path) **and**
`logo_url` (absolute URL). The form stores the path.

```jsx
// single image: form value = path | null
<Controller name="logo" control={control} render={({ field }) => (
  <Field label={t.logo}>
    <ImageUpload folder="partners" value={field.value} url={partner?.logo_url} onChange={field.onChange} onUploadingChange={setUploading} />
  </Field>
)} />
// defaultValues: { logo: partner.logo ?? null }   ·   payload: { logo: values.logo }   (null clears it)

// gallery: form value = [{ path, url }]  →  send only the paths
defaultValues: { gallery: toGalleryItems(project.gallery, project.gallery_urls) }
<Controller name="gallery" control={control} render={({ field }) => (
  <GalleryUpload folder="projects/gallery" value={field.value} onChange={field.onChange} onUploadingChange={setUploading} />
)} />
payload: { gallery: galleryPaths(values.gallery) }
```

* `folder` must be one of `projects | projects/gallery | team | testimonials | partners | misc`.
* Disable Save while a file uploads: `const [uploading, setUploading] = useState(false)` +
  `<FormActions saving={saving} disabled={uploading} … />`.
* Client checks (jpg/png/webp/gif, ≤ 5 MB) run before upload; server 422 text is shown under the box.
* The kit never deletes files itself (replacing/removing only changes the form value). The backend removes a replaced or
  cleared image after a successful update and removes all files of a record when it is deleted; only files that were
  uploaded and then abandoned before saving stay orphaned.

### 2.7 Reorder

Models with an `order` column expose `POST /x/reorder {ids}`. Recipe (FaqList): a "Reorder" toggle that (a) requests
`{ per_page: 200, sort: 'order', dir: 'asc' }` — the endpoint sets `order` = position of every id it receives, so it needs the
**whole** list; disable it when `meta.total > 200` — and (b) renders

```jsx
<SortableList items={rows} onReorder={(next) => reorder.mutate(next.map((row) => row.id))}
  renderItem={(row, { handle, isDragging, index }) => <div className="flex items-center gap-3">{handle}{row.name}</div>} />
```

`useReorder` re-sorts the cached list at once (optimistic), restores it on failure and refetches afterwards.
Nested lists (team members, links): same, with the nested `useCrudHooks`.

## 3. Data layer

### `api` (`@/lib/api`)

Base URL = `import.meta.env.VITE_API_BASE_URL || '/api'` + `/admin`. Paths start with `/`.

| Call | Notes |
|---|---|
| `api.get(path, params?, options?)` | params → query string (empty values dropped, booleans → `1/0`, arrays → `k[]=`) |
| `api.post(path, body?, options?)` · `api.put` · `api.patch` | JSON body |
| `api.delete(path, options?)` | resolves `null` on 204 |
| `api.upload(file, folder, options?)` | multipart `POST /uploads` → `{ path, url }` |
| `api.deleteUpload(path)` | `DELETE /uploads {path}` |
| `api.download(path, params?)` → `{ blob, filename, contentType }` + `saveBlob(blob, filename)` | authenticated file download (CSV export) |
| `api.post(path, formData, { onUploadProgress })` | `onUploadProgress({ loaded, total })` sends through XMLHttpRequest (fetch reports no upload progress); same headers, answers and errors. Tests: `installFakeXhr()` from `@/test/fakeXhr` hands the request to `mockApi` |
| `api.request(method, path, { params, body, signal, auth, headers })` | generic |

All calls return the parsed JSON **exactly as Laravel sent it** (`{ data, meta, links }` / `{ data }` / `null`) and send
`Authorization: Bearer <ngp_admin_token>`. `options`: `{ signal, auth: false, headers }` (`auth: false` = no token and a
401 does not log out — login only).

Failures throw `ApiError { status, message, errors, data, retryAfter, code, method }`: `status 0` = network down; `422` →
`errors` is `{ field: [messages] }`; `429` → `retryAfter` seconds; **401 anywhere clears the token, empties the query cache
and `<ProtectedRoute>` redirects to `/login`**. `errorText(err, c)` gives a localized message (server messages of 5xx/404
are never shown to users).

A **2xx whose body is not JSON** (a PHP notice printed in front of it, a proxy page) rejects too, with
`code: UNREADABLE_RESPONSE` and the 2xx `status` (`isUnreadableResponse(err)`), plus a console warning: no caller can use a
missing body, and a rejection reaches every caller's existing error path. The server did act, so the crud mutations then
refresh the resource and toast a warning ("may have been saved, check before trying again"), and the registry dialogs
close instead of offering a second Save that would store a duplicate. An empty 2xx body still resolves `null`.

### `createCrudHooks(resource)` (`@/lib/crud`)

`export const things = createCrudHooks('/things')` then:

| Hook | Returns / behaviour |
|---|---|
| `things.useList(params, queryOptions?)` | `{ rows, meta, data (full envelope), isLoading, isFetching, isPlaceholderData, isError, error, refetch }` — previous page stays visible while the next loads |
| `things.useOne(id, queryOptions?)` | `useQuery` whose `data` is the record; idle while `id` is empty |
| `things.useCreate(opts?)` | `mutate/mutateAsync(body)` → created record |
| `things.useUpdate(opts?)` | `mutate({ id, data })` (partial `data` is fine) → record, also written to the `one` cache |
| `things.useDelete(opts?)` | `mutate(id)` |
| `things.useReorder(opts?)` | `mutate(idsInNewOrder)` — optimistic + rollback |
| `things.keys` | `{ all, lists, list(params), one(id) }` for manual invalidation |

Mutations invalidate the resource's lists and toast (`c.saved` / `c.deleted` / `c.orderSaved`; errors → localized text, 422 →
"please fix the highlighted fields"). `opts`: `{ silent: true, successMessage, onSuccess, onError, …useMutation options }`
(your callbacks run after ours). `useCrudHooks(path)` = the same for a path only known at runtime.
Other data (dashboard stats, settings): use `useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') })` /
`useMutation` directly — `@tanstack/react-query` is available. Toast/confirm hooks work anywhere.

### `useListParams(defaults)` (`@/lib/useListParams`)

URL-backed list state: `{ params, sort, set(patch), setPage, setPerPage, setSort({key,dir}), reset, hasFilters }`. `set` merges and
resets to page 1 unless the patch has `page`; default values are not written to the URL. `params` goes straight into `useList`.

### `applyServerErrors(setError, err)` (`@/lib/applyServerErrors`)

Returns `true` for a 422 (field messages set, first invalid field focused, `errors.root.server` = response message).

### Formatting (`useFormat()` from `@/i18n`)

`f.date(x)`, `f.dateTime(x)`, `f.relative(x)`, `f.number(n)`, `f.bytes(n)`. Latin digits in both languages (ids, orders and
API numbers then match what people see). Pure versions: `@/lib/format`.

## 4. Kit reference (`import { … } from '@/ui'`)

Conventions: native form controls (`Input`, `Textarea`, `Select`) spread onto the element and take `{...register('x')}`; custom
controls (`Switch`, `TagsInput`, `ImageUpload`, `GalleryUpload`, `Checkbox`, `SearchInput`) are controlled with
`value/checked` + `onChange(nextValue)` — wrap them in `<Controller>`. `className` is accepted everywhere.

### Layout & content

| Export | Props (defaults) | Example |
|---|---|---|
| `PageHeader` | `title` `description` `actions` `backTo` `backLabel` — string `title` also sets `document.title` | `<PageHeader title={t.title} actions={<Button …/>} backTo="/faqs" />` |
| `Card` | `title` `description` `actions` `footer` `padded=true` `as='section'` | `<Card title="General">…</Card>` · `<Card padded={false}><DataTable/></Card>` |
| `Tabs` + `TabPanel` | Tabs: `tabs=[{key,label,icon?,badge?,disabled?}]` `value` `onChange(key)` `idPrefix` `label`; Panel: `value` `active` `idPrefix` `keepMounted` | see §2.5 |
| `EmptyState` | `icon` `title` `description` `action` | `<EmptyState title="Nothing" action={<Button/>} />` |
| `Alert` | `tone='info'|'success'|'warning'|'danger'` `title` `action` | `<Alert tone="danger" action={<Button size="sm">Retry</Button>}>msg</Alert>` |
| `StatCard` | `label` `value` `icon` `tone='accent'|'gold'|'success'|'info'|'warning'|'danger'` `to` `hint` | `<StatCard label="New" value={4} icon={Inbox} to="/requests" />` |
| `Badge` | `tone='neutral'|'success'|'danger'|'warning'|'info'|'accent'|'gold'` `dot` | `<Badge tone="gold">Featured</Badge>` |
| `StatusBadge` | `status` (`active inactive new in_progress done completed draft`) or `active={bool}`; `statuses={{k:{tone,label}}}` for custom | `<StatusBadge status={row.status} />` |
| `Avatar` | `src` `name` `size='sm|md|lg|xl'` `shape='circle|rounded|square'` (initial fallback, also on image error) | `<Avatar src={row.logo_url} name={row.name} shape="rounded" />` |
| `Spinner` `PageSpinner` `Skeleton` | `Spinner size label`; `PageSpinner` = centered block | `if (isLoading) return <PageSpinner />` |
| `ComingSoon` | `title={{ar,en}}` `icon` | placeholder pages only |

### Actions

| Export | Props (defaults) |
|---|---|
| `Button` | `variant='primary'|'secondary'|'ghost'|'danger'|'gold'` `size='sm'|'md'|'lg'` `icon` `iconEnd` `loading` `disabled` `to` (router Link) `href` `type='button'` |
| `IconButton` | `icon` `label` (**required**: aria-label + tooltip) `tone='default'|'danger'|'accent'` `size='sm'|'md'|'lg'` `to` |
| `Dropdown` | `label` (button content) `ariaLabel` `items=[{key,label,icon?,onClick?,to?,tone?:'danger',disabled?,separator?}]` `header` `align='end'|'start'` — keyboard accessible menu |
| `FormActions` | `saving` `dirty` (pass `formState.isDirty` on edit forms) `disabled` `cancelTo` / `onCancel` `saveLabel` `sticky` — Save is the submit button |
| `Modal` | `open` `onClose` `title` `description` `size='sm|md|lg|xl'` `footer` `closeOnBackdrop=true` `hideClose` `initialFocusRef` — portal, focus trap, Esc, scroll lock, focus restore |
| `ConfirmDialog` | controlled: `open` `title` `message` `confirmLabel` `cancelLabel` `tone='danger'|'primary'` `loading` `onConfirm` `onCancel` |
| `useConfirm()` | `const confirm = useConfirm(); if (await confirm({ title, message, confirmLabel, cancelLabel, tone })) …` → `true/false` (focus starts on Cancel) |
| `useToast()` | `toast.success(msg)` `.error` `.warning` `.info` `.show({ type, message, duration })` `.dismiss(id)`; `duration: 0` = sticky; max 4 on screen |

### Form controls

| Export | Props |
|---|---|
| `Field` | `label` `hint` `error` (string or FieldError) `required` (asterisk only) `htmlFor` — wires its control; `useFieldContext()` for custom controls |
| `Input` | native props + `invalid` `startIcon` `endAdornment` `dir` — `email/url/tel/number` are `dir="ltr"` automatically |
| `PasswordInput` | `Input` + a show/hide toggle. `showLabel`/`hideLabel` **required** (aria-label text). Follows the page's own direction (unlike email/url/number) — pass `dir` to override |
| `Textarea` | native props + `rows=4` `invalid` |
| `Select` | native props + `options=[{value,label,disabled?}]` (or `<option>` children) `placeholder` (adds an empty first option) `wrapperClassName`; `onChange` is the native event |
| `Switch` | `checked` `onChange(bool)` `label` `description` `disabled` (or `aria-label`) |
| `Checkbox` | `checked` `indeterminate` `onChange(bool)` `label` |
| `SearchInput` | `value` `onChange(text)` `delay=350` `placeholder` — debounced, Enter commits at once, × clears |
| `BilingualField` | RHF mode: `name` (→ `${name}_ar` / `${name}_en`, nested paths ok) `label` `register` `errors` `required` `multiline` `rows` `maxLength` `hint` `placeholder` (string or `{ar,en}`) · controlled mode: `value={{ar,en}}` `onChange` `error={{ar,en}}`. Each side has `dir`/`lang` and the accessible name "Label (Arabic)" |
| `TagsInput` | `value: string[]` `onChange(string[])` `max` `maxLength` `placeholder` `dir='rtl'|'ltr'` — Enter/comma/`،` add, Backspace removes last, paste lists |
| `BilingualTags` | RHF: `name` (→ `${name}_ar/_en` arrays) `label` `control` `errors` `max` `hint` |
| `ImageUpload` | `value` (path|null) `url` (preview of the saved value) `onChange(path|null)` `folder` `shape='landscape'|'square'|'circle'` `disabled` `maxSizeMB=5` `onUploadingChange` |
| `GalleryUpload` | `value: [{path,url}]` `onChange(items)` `folder` `max=20` `disabled` `onUploadingChange`; helpers `toGalleryItems(paths, urls)` `galleryPaths(items)` |

### Data display

| Export | Props |
|---|---|
| `DataTable` | `columns=[{key,header,cell?(row,i),sortable?,sortKey?,align?,width?,hideBelow?:'sm|md|lg|xl',className?}]` `rows` `rowKey='id'` `loading` (skeleton) `busy` (dim) `sort={key,dir}` `onSortChange({key,dir})` `selectable` `selected` `onSelectedChange(keys)` `rowActions(row)→[{label,icon,onClick?,to?,tone?,disabled?,hidden?}]` `onRowClick` `emptyTitle/emptyDescription/emptyAction/emptyIcon/emptyState` `skeletonRows` `minWidth=560` `caption` |
| `Pagination` | `meta` (Laravel) `onPageChange(n)` `onPerPageChange(n)?` `perPageOptions` — hides itself without rows, jumps to the last page if the current one vanished |
| `SortableList` | `items` `onReorder(nextItems)` `renderItem(item,{handle,isDragging,index})` `getId=item.id` `layout='list'|'grid'` `disabled` `ariaLabel` `trailing` — pointer, touch and keyboard (Space, arrows, Space) |

### Misc exports

`cx` (`@/lib/cx`), `focusRing` and `flipRtl` (`@/ui`), `buttonVariants`, `pageWindow`, `fieldErrorMessage`, `errorMessage`.

### Project registry kit (`import { … } from '@/features/registry/kit'`)

Built on the kit above for the registry screens (project page tabs, catalogs). A **field list** describes a form once —
values, request body, client checks and controls all come from it (`kit/form.js`):

```js
const fields = [
  { name: 'key', type: 'text', label: t.key, required: true, max: 80, pattern: KEY_PATTERN, patternMessage: r.keyFormat, dir: 'ltr' },
  { name: 'name', type: 'bilingual', label: t.name, required: true, max: 255 },      // name_ar + name_en
  { name: 'status', type: 'select', label: t.status, nullable: false, options: toOptions(FEATURE_STATUSES, r.featureStatuses) },
  { name: 'evidence', type: 'lines', label: t.evidence, maxItems: 30, itemMax: 300 },  // one item per line
  { name: 'tests.exist', type: 'switch', label: t.testsExist },                         // dotted = nested body
]
```

Types: `text textarea url number date select boolSelect switch tags lines checkboxes bilingual objectList readonly section`.
Blank optional values are sent as `null`; a `select` with `nullable: false` is left out when empty; `numeric: true` sends an id.
`control: (props) => <Component {...props} />` draws a field with a component of its own while its `type` keeps the
conversions and checks — the member picker (`projects/registry/AccountPicker.jsx`) is a `select` drawn as a
search-as-you-type radio list over `GET registry/users?search=&per_page=20` (the API refuses `per_page` above 50).

| Export | Use |
|---|---|
| `CollectionTab` | `resource` (e.g. `/registry/projects/7/modules`) `config={ title, itemLabel, fields (array or (ctx, record) => array), defaults, columns(helpers), rowName, rowActions?, filters?, search?, sort?, upload?, reorderable? }` `canWrite` `canCreate` `ctx` `onChanged` `notice` — table + add / edit / view dialog, delete after confirmation, partial updates, multipart uploads, a 422 on the fields |
| `RecordDialog` | the same dialog alone (non-functional cards, screenshots) |
| `GroupForm` | `projectId` `group` `values` `fields` `canWrite` `title` — one operations group, `PUT …/operations/{group}` with only the changed fields |
| `localizeErrors(err, r)` / `actionErrorText(err, r, c)` | the vault guard's "looks like a secret" (and other known registry messages) in the UI language; text for a refused delete / inline change |
| `AuthImage` / `useAuthorizedSrc(url)` | an `<img>` for a private stream (`/api/admin/registry/files/…`), fetched with the bearer token |
| `registryProjects`, `useProjectAction(id)`, `useRefreshRegistry(id)`, `technologiesCatalog`, `industriesCatalog` | data hooks |
| `registryStrings` + `enums.js` | labels and value lists of every registry enum (mirrors `App\Registry\Enums`) |

The project page (`features/projects/ProjectPage.jsx`) shows the tabs `abilities` (from `GET /registry/projects/{id}`)
let the caller read — the others are absent — and builds each registry tab from `projects/registry/collections.jsx` and
`groups.js`.

## 5. RTL rules

The app is Arabic-first: `<html dir="rtl">` unless the user toggled English; `LanguageContext` keeps `lang/dir` in sync.

* Use **logical** Tailwind utilities: `ms-* me-* ps-* pe-* start-* end-* text-start text-end border-s border-e rounded-s-* rounded-e-*`.
  Never `ml-* mr-* pl-* pr-* left-* right-* text-left text-right` (use `rtl:`/`ltr:` variants only when a logical one does not exist).
* Directional icons (arrows, chevrons) must mirror: add `flipRtl` (`rtl:-scale-x-100`) to them. Symmetric icons do not.
* Latin-only content (emails, URLs, slugs, phone numbers, code) → `dir="ltr"` (Input does it for email/url/tel/number).
  Passwords are typed in either script, so `PasswordInput` follows the page's own direction instead.
  Bilingual content boxes: Arabic `dir="rtl"`, English `dir="ltr"` (BilingualField does it). Mixed user text in cells: `dir="auto"`.
* Layout with flex/grid keeps DOM order and flips by itself — do not reverse arrays for RTL.
* Numbers/dates: `useFormat()` (Latin digits). Do not build date strings by hand.
* Keyboard: Tabs and menus already mirror the arrow keys; if you build something with left/right arrows, read `dir` from `useLanguage()`.
* Test both: `renderWithProviders(ui, { lang: 'ar' })`.

## 6. Testing recipe

Vitest + React Testing Library + user-event (`npx vitest run src/features/<area>`).

```jsx
import { screen, waitFor } from '@testing-library/react'
import { mockApi, paginated, reply, validationError } from '@/test/mockApi'
import { renderWithProviders } from '@/test/renderWithProviders'

it('lists and deletes', async () => {
  const server = mockApi({
    'GET /services': () => paginated([service]),          // key = 'METHOD /path' relative to /api/admin, :params allowed
    'DELETE /services/:id': () => null,                    // null → 204
  })
  const { user } = renderWithProviders(<ServiceList />, { route: '/services' })   // route + optional path for useParams

  expect(await screen.findByText('Web development')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(server.calls('DELETE', '/services/1')).toHaveLength(1))
})
```

* `renderWithProviders(ui, { route='/', path, lang='en', queryClient, authUser, auth })` → RTL result + `user` (user-event) +
  `queryClient`. Tests read **English** by default (`lang: 'ar'` for RTL checks). `path='/faqs/:id'` makes `useParams()` work.
  `screen.getByTestId('location')` shows `pathname + search` (assert redirects). `authUser: null` renders anonymous.
* `mockApi(routes)` replaces `fetch` (so the real `api` client, headers and error handling run). Handler gets
  `{ method, path, params, query, body, headers }`; return a value (200 JSON), `null` (204), `reply(status, body, headers)`,
  `validationError({ field: ['msg'] })` (422), `replyText(status, text)` (a raw, non-JSON body) or a promise. Inspect with `server.calls(method?, path?)` / `server.requests`;
  `server.on(key, handler)` swaps a handler mid-test. `paginated(rows, { page, perPage, total })` builds Laravel's envelope.
  Multipart bodies arrive as `FormData` (`call.body.get('folder')`).
* Hooks: `renderHook(() => things.useList({}), { wrapper: createWrapper() })`.
* Query with roles/labels: kit controls are accessible (`getByRole('switch', { name: … })`, `getByLabelText('Question (Arabic)')`,
  `getByRole('button', { name: 'Delete' })`, `getByRole('dialog', { name: … })`). Toasts are `role="status"|"alert"`.
* Debounced search: `await user.type(searchbox, 'x')` then `await waitFor(() => expect(lastCall.query.search)…)`.
* File upload: `await user.upload(screen.getByTestId('image-input'), file)` (`gallery-input` for the gallery). Rejected types need
  `fireEvent.change(input, { target: { files: [file] } })` because user-event honours the `accept` attribute.
* Drag & drop cannot run in jsdom (no layout). Mock `@dnd-kit/core`'s `DndContext` to capture its props and call
  `props.onDragEnd({ active: { id }, over: { id } })` — see `src/features/faqs/FaqList.test.jsx` (`vi.hoisted` + `vi.mock`).
* Fake auth: the wrapper gives `useAuth()` a signed-in `testUser`; pass `auth: { logout: vi.fn() }` to spy.
  Use the real `AuthProvider` only in auth-flow tests (see `src/app/AuthProvider.test.jsx`).
* Do not stub `fetch` by hand and do not mock `@/lib/api` unless you must — `mockApi` keeps the contract honest.

## 7. Known limits

* Dark theme only (brand). No light mode, no date/time picker (use `<Input type="date">`), `Select` is the native element.
* `DataTable` sorting/paging is server-side only (no client sort), no column resizing/virtualisation; small screens scroll
  horizontally — mark low-priority columns with `hideBelow`.
* Reorder needs the whole list in one request (≤ 200 rows); the API sets `order` = position of each id it gets.
* `ImageUpload`/`GalleryUpload`: no upload progress percentage (fetch has none), gallery files upload one at a time, files
  uploaded and then abandoned before saving are **not** deleted (the backend cleans up replaced/removed images on
  update and everything on record deletion).
* Forms have no "unsaved changes" navigation guard (BrowserRouter has no blocker API) — edit forms just disable Save
  until dirty.
* `useToast`/`useConfirm`/`useAuth` throw outside their providers (use `renderWithProviders`); `useLanguage` falls back to Arabic.
* `useStrings` merges shallowly. Toasts: max 4 visible. Modals: focus trap is a simple Tab loop; nested modals are supported
  (topmost handles Esc).
* Every feature is bundled eagerly (single JS chunk, ~550 kB / 175 kB gzip at the foundation stage). Use `React.lazy` inside a
  feature for rarely used heavy pages.
* The bearer token lives in `localStorage` (`ngp_admin_token`): any XSS can read it — keep third-party scripts out of the
  app, never render API strings with `dangerouslySetInnerHTML`.
