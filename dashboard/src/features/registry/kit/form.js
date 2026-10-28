// The form model behind CollectionTab and GroupForm: a list of field descriptions turns an API record into form
// values, form values into a request body, and checks the values before anything is sent. Pure functions, so they
// are tested on their own (form.test.js).
//
// A field: { name, type, label, hint?, required?, max?, pattern?, patternMessage?, min?, maxValue?, maxItems?, itemMax?,
//            itemPattern?, nullable?, numeric? (a select of ids), defaultValue?, options?, fields? (objectList items),
//            rows?, multiline?, dir?, span?, control? }
// `control({ value, onChange, onBlur, inputRef, label, hint, error, required, disabled, ctx, className })` draws a field
// with a component of its own (the member picker); its `type` still decides the conversions and the checks.
// Types: text · textarea · url · number · date · select · boolSelect · switch · tags · lines · checkboxes ·
//        bilingual (name → name_ar / name_en) · objectList (list of objects, see `fields`) · readonly · section.
// `name` may be a dotted path ("tests.exist"): the body then nests it (`{ tests: { exist } }`).

const STRING_TYPES = new Set(['text', 'textarea', 'url', 'bilingual'])
const LIST_TYPES = new Set(['tags', 'lines', 'checkboxes'])
const SKIPPED = new Set(['readonly', 'section'])

export function getPath(object, path) {
  return String(path)
    .split('.')
    .reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), object)
}

export function setPath(object, path, value) {
  const keys = String(path).split('.')
  let node = object
  keys.slice(0, -1).forEach((key) => {
    if (node[key] === null || node[key] === undefined || typeof node[key] !== 'object') node[key] = {}
    node = node[key]
  })
  node[keys[keys.length - 1]] = value
  return object
}

/** The form/body names of a field (a bilingual field is two). */
export const fieldNames = (field) => (field.type === 'bilingual' ? [`${field.name}_ar`, `${field.name}_en`] : [field.name])

/** The fields that hold a value (sections and read-only displays do not). */
export const valueFields = (fields) => fields.filter((field) => field && !SKIPPED.has(field.type) && !field.hidden)

export function toFormValue(field, raw) {
  switch (field.type) {
    case 'switch':
      return Boolean(raw ?? field.defaultValue ?? false)
    case 'tags':
    case 'lines':
    case 'checkboxes':
      return Array.isArray(raw) ? raw.map(String) : []
    case 'objectList':
      return Array.isArray(raw) ? raw.map((item) => itemToForm(field, item)) : []
    case 'number':
      return raw === null || raw === undefined ? '' : String(raw)
    case 'date':
      return raw ? String(raw).slice(0, 10) : ''
    case 'boolSelect':
      return raw === true ? '1' : raw === false ? '0' : ''
    case 'select':
      return raw === null || raw === undefined ? (field.defaultValue ?? '') : String(raw)
    default:
      return raw === null || raw === undefined ? '' : String(raw)
  }
}

/** Form value → body value. `undefined` = leave the key out (an optional select without a "none" choice). */
export function fromFormValue(field, value) {
  switch (field.type) {
    case 'switch':
      return Boolean(value)
    case 'tags':
    case 'lines':
    case 'checkboxes':
      return (value ?? []).map((item) => String(item).trim()).filter(Boolean)
    case 'objectList':
      return (value ?? []).map((item) => itemFromForm(field, item))
    case 'number':
      return value === '' || value === null || value === undefined ? null : Number(value)
    case 'boolSelect':
      return value === '1' ? true : value === '0' ? false : null
    case 'date':
      return value ? value : null
    case 'select':
      if (value === '' || value === null || value === undefined) return field.nullable === false ? undefined : null
      return field.numeric ? Number(value) : value
    default: {
      const text = typeof value === 'string' ? value.trim() : value
      if (text === '' || text === null || text === undefined) return field.required ? '' : null
      return text
    }
  }
}

function itemToForm(field, item) {
  const source = item && typeof item === 'object' ? item : {}
  return { ...source, ...Object.fromEntries(field.fields.map((sub) => [sub.name, toFormValue(sub, source[sub.name])])) }
}

function itemFromForm(field, item) {
  const out = { ...item }
  field.fields.forEach((sub) => {
    const value = fromFormValue(sub, item?.[sub.name])
    if (value === undefined) delete out[sub.name]
    else out[sub.name] = value
  })
  return out
}

/** An empty item of an objectList field. */
export const emptyItem = (field) => Object.fromEntries(field.fields.map((sub) => [sub.name, toFormValue(sub, undefined)]))

/** API record (or `null` for "new") → form values; `defaults` fill what a new record starts with. */
export function recordToValues(fields, record, defaults = {}) {
  const values = {}
  valueFields(fields).forEach((field) => {
    fieldNames(field).forEach((name) => {
      const raw = record ? getPath(record, name) : getPath(defaults, name)
      const sub = field.type === 'bilingual' ? { ...field, type: field.multiline ? 'textarea' : 'text' } : field
      setPath(values, name, toFormValue(sub, raw))
    })
  })
  return values
}

/** Form values → request body (every field). */
export function valuesToPayload(fields, values) {
  const payload = {}
  valueFields(fields).forEach((field) => {
    fieldNames(field).forEach((name) => {
      const sub = field.type === 'bilingual' ? { ...field, type: 'text' } : field
      const value = fromFormValue(sub, getPath(values, name))
      if (value !== undefined) setPath(payload, name, value)
    })
  })
  return payload
}

/**
 * Only what changed, by top-level key (the API takes partial updates; a nested value such as `tests` or
 * `run_requirements` is sent whole when any part of it changed).
 */
export function changedPayload(fields, before, after) {
  const previous = valuesToPayload(fields, before)
  const next = valuesToPayload(fields, after)
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])))
}

function validateValue(field, name, value, fail, c, r) {
  if (STRING_TYPES.has(field.type) || field.type === 'date') {
    const text = typeof value === 'string' ? value.trim() : ''
    if (field.required && !text) return fail(name, c.required)
    if (field.max && text.length > field.max) return fail(name, c.maxLength(field.max))
    if (text && field.type === 'url' && !/^https?:\/\/\S+$/i.test(text)) return fail(name, c.invalidUrl)
    if (text && field.pattern && !field.pattern.test(text)) return fail(name, field.patternMessage ?? r.invalidFormat)
    return undefined
  }
  if (field.type === 'select' || field.type === 'boolSelect') {
    if (field.required && (value === '' || value === null || value === undefined)) return fail(name, c.required)
    return undefined
  }
  if (field.type === 'number') {
    if (value === '' || value === null || value === undefined) return field.required ? fail(name, c.required) : undefined
    const number = Number(value)
    if (!Number.isInteger(number)) return fail(name, c.invalidNumber)
    if ((field.min !== undefined && number < field.min) || (field.maxValue !== undefined && number > field.maxValue)) {
      return fail(name, c.numberRange(field.min ?? '−∞', field.maxValue ?? '∞'))
    }
    return undefined
  }
  if (LIST_TYPES.has(field.type)) {
    const items = (value ?? []).map((item) => String(item).trim()).filter(Boolean)
    if (field.required && !items.length) return fail(name, c.required)
    if (field.maxItems && items.length > field.maxItems) return fail(name, r.maxItems(field.maxItems))
    if (field.itemMax && items.some((item) => item.length > field.itemMax)) return fail(name, c.maxLength(field.itemMax))
    if (field.itemPattern && items.some((item) => !field.itemPattern.test(item))) return fail(name, field.patternMessage ?? r.invalidFormat)
    return undefined
  }
  if (field.type === 'objectList') {
    const items = value ?? []
    if (field.maxItems && items.length > field.maxItems) return fail(name, r.maxItems(field.maxItems))
    items.forEach((item, index) => field.fields.forEach((sub) => validateValue(sub, `${name}.${index}.${sub.name}`, item?.[sub.name], fail, c, r)))
  }
  return undefined
}

/** RHF resolver from the field list: `useForm({ resolver: makeResolver(fields, c, r) })`. */
export function makeResolver(fields, c, r) {
  return async (values) => {
    const errors = {}
    const fail = (name, message) => setPath(errors, name, { type: 'validate', message })
    valueFields(fields).forEach((field) => {
      fieldNames(field).forEach((name) => validateValue(field, name, getPath(values, name), fail, c, r))
    })
    return Object.keys(errors).length ? { values: {}, errors } : { values, errors: {} }
  }
}

/** [values] + a label table → Select options. */
export const toOptions = (values, labels = {}) => values.map((value) => ({ value, label: labels[value] ?? value }))

/** Every field name (dotted) a form shows, so 422 messages for other keys can be listed apart. */
export const formNames = (fields) => valueFields(fields).flatMap(fieldNames)

/** Is a server error key (`tests.paths.0`, `name_ar`) one of the form's own fields? */
export const belongsToForm = (fields, key) => formNames(fields).some((name) => key === name || key.startsWith(`${name}.`))
