// Test helpers of the imports wizard: files and dropped entries, and batches in the contract's shapes
// (docs/superpowers/notes/phase-2-import-api-contract.md in the portfolio hub).

/** A File with its content; `size` overrides the reported size (limits are tested without allocating 200 MB). */
export function makeFile(name, content = '', { size, type = '' } = {}) {
  const file = new File([content], name, { type })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  return file
}

/** A file of `<input webkitdirectory>`: its relative path is in `webkitRelativePath`. */
export function folderFile(relativePath, content = '', options) {
  const file = makeFile(relativePath.split('/').pop(), content, options)
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

/** A dropped `FileSystemFileEntry`. */
export const fileEntry = (fullPath, content = '', options) => {
  const name = fullPath.split('/').pop()
  return { isFile: true, isDirectory: false, name, fullPath, file: (resolve) => resolve(makeFile(name, content, options)) }
}

/** A dropped `FileSystemDirectoryEntry` whose reader answers `batchSize` entries at a time, then an empty batch. */
export const dirEntry = (path, children, { batchSize = 100 } = {}) => ({
  isFile: false,
  isDirectory: true,
  name: path.split('/').pop(),
  fullPath: `/${path}`,
  createReader() {
    let index = 0
    return {
      readEntries(resolve) {
        const batch = children.slice(index, index + batchSize)
        index += batchSize
        setTimeout(() => resolve(batch), 0)
      },
    }
  },
})

/** A drop event's `dataTransfer` holding these entries (with `webkitGetAsEntry`). */
export const dropOf = (entries, files = []) => ({
  items: entries.map((entry, index) => ({ kind: 'file', webkitGetAsEntry: () => entry, getAsFile: () => files[index] ?? null })),
  files,
  types: ['Files'],
})

// ───────────────────────────────────────────── contract shapes

export const BATCH_ID = '5f0c2a8e-4b1d-4e8f-9a7c-2d3e4f5a6b7c'

export const section = (key, over = {}) => ({
  key,
  tier: 'public',
  access: 'write',
  kind: 'collection',
  new: [],
  changed: [],
  unchanged: 0,
  skipped_empty: [],
  only_in_db: [],
  errors: [],
  ...over,
})

export const change = (path, current, incoming, over = {}) => {
  const parts = path.split('.')
  const field = parts.at(-1)
  const ref = parts.length > 2 ? parts.slice(1, -1).join('.') : null
  return { path, ref, field, current, incoming, default: 'replace', reason: null, ...over }
}

export const projectSection = (over = {}) =>
  section('project', {
    kind: 'fields',
    changed: [
      change('project.name_en', 'Dawri League', 'Dawri', { default: 'keep', reason: 'edited_by_user' }),
      change('project.short_ar', 'منصة دوري', 'منصة الدوري الرياضي'),
    ],
    unchanged: 12,
    skipped_empty: [{ path: 'project.client', ref: null, field: 'client', current: 'Acme' }],
    ...over,
  })

export const featuresSection = (over = {}) =>
  section('features', {
    new: [{ ref: 'live-scores', title: 'Live scores', fields: { name_en: 'Live scores', status: 'verified' } }],
    changed: [
      change('features.online-ordering.name_ar', 'الطلب', 'الطلب أونلاين'),
      change('features.online-ordering.main_workflow', ['open', 'pay'], ['open', 'choose', 'pay'], { default: 'keep', reason: 'never_imported' }),
    ],
    unchanged: 20,
    only_in_db: [{ ref: 'old-feature', title: 'Old feature' }],
    ...over,
  })

export const deploymentSection = (over = {}) =>
  section('deployment', {
    tier: 'sensitive',
    access: 'read_only',
    kind: 'fields',
    changed: [change('deployment.deploy_method', 'Manual FTP', 'GitHub Actions')],
    ...over,
  })

export const makePreview = (over = {}) => ({
  counts: { new: 1, changed: 5, unchanged: 32, skipped_empty: 1, only_in_db: 1, errors: 0 },
  blocking: false,
  sections: [projectSection(), featuresSection(), deploymentSection()],
  catalog_new: { technologies: [{ name: 'Riverpod', category: 'mobile' }], industries: [{ name_ar: 'الرياضة', name_en: 'Sports' }] },
  screenshots: {
    new: [{ file: 'public/screenshots/01-home.png', public: true, title: { ar: 'الرئيسية', en: 'Home' } }],
    replaced: [{ file: 'internal/screenshots/02-admin.png', id: 41, public: false }],
    unchanged: 3,
  },
  ...over,
})

export const matchedProject = { id: 7, slug: 'dawri', name_ar: 'دوري', name_en: 'Dawri', publication_status: 'published' }

export const makeBatch = (over = {}) => ({
  id: BATCH_ID,
  status: 'previewed',
  original_name: 'dawri.zip',
  created_at: '2026-10-27T08:00:00.000000Z',
  expires_at: '2026-10-28T08:00:00.000000Z',
  applied_at: null,
  user: { id: 1, name: 'Admin' },
  package: { project_uid: '0b9c1f7e-1111-4aaa-8bbb-123456789abc', slug: 'dawri', generator: 'ngp-project-discovery/1.1', generated_at: '2026-10-26T18:00:00Z', name: { ar: 'دوري', en: 'Dawri' }, has_operational: true },
  match: { kind: 'uid', project: matchedProject },
  warnings: [],
  info: { category_suggestion: null, alternative_names: [] },
  preview: makePreview(),
  report: null,
  abilities: { apply: true, cancel: true },
  ...over,
})

export const makeReport = (over = {}) => ({
  created: 12,
  updated: 25,
  unchanged: 140,
  skipped_empty: 4,
  only_in_db: 2,
  kept_by_user: 5,
  files: { stored: 20, skipped: 30, rejected: 0 },
  catalog_created: { technologies: 2, industries: 1 },
  sections_skipped: ['auth', 'deployment'],
  warnings: [],
  publication: { ready: true, missing: [] },
  project: { id: 7, slug: 'dawri' },
  ...over,
})

/** The list row (`ImportBatchSummary`): no preview, no report, plus `counts` and `report_counts`. */
export const makeSummary = (over = {}) => {
  // eslint-disable-next-line no-unused-vars
  const { preview, report, ...rest } = makeBatch()
  return { ...rest, counts: makePreview().counts, report_counts: null, ...over }
}
