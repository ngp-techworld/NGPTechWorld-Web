import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useCommon } from '@/i18n'
import { cx } from '@/lib/cx'
import { useFieldContext } from './Field'

/**
 * Editable list of short strings (features, tasks…). Controlled: `value` (string[]) + `onChange(string[])`.
 * Enter, comma or Arabic comma add the typed text; Backspace on an empty box removes the last tag;
 * pasted text with commas / new lines becomes several tags; duplicates are ignored. Enter never submits the form.
 * `dir="rtl"` / `dir="ltr"` sets the writing direction of the tags (use per language for `_ar` / `_en` lists).
 */
export function TagsInput({ value = [], onChange, placeholder, max, maxLength = 200, dir, disabled = false, invalid, id, className, ...rest }) {
  const c = useCommon()
  const field = useFieldContext()
  const isInvalid = invalid ?? field?.invalid
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const atMax = Boolean(max) && value.length >= max

  const commit = (text) => {
    const parts = text
      .split(/[\n,،]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (!parts.length) {
      setDraft('')
      return
    }
    const next = [...value]
    for (const part of parts) {
      if (max && next.length >= max) break
      const tag = part.slice(0, maxLength)
      if (!next.includes(tag)) next.push(tag)
    }
    if (next.length !== value.length) onChange?.(next)
    setDraft('')
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '،') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length) {
      onChange?.(value.slice(0, -1))
    }
  }

  const onInputChange = (event) => {
    const text = event.target.value
    if (/[,،]/.test(text)) commit(text)
    else setDraft(text)
  }

  // a single-line <input> flattens pasted new lines, so read the clipboard ourselves
  const onPaste = (event) => {
    const text = event.clipboardData?.getData('text') ?? ''
    if (!/[\n,،]/.test(text)) return
    event.preventDefault()
    commit(`${draft}${text}`)
  }

  return (
    <div
      dir={dir}
      onClick={() => inputRef.current?.focus()}
      className={cx(
        'flex min-h-[46px] w-full flex-wrap items-center gap-1.5 rounded-xl border bg-white/[.04] px-2.5 py-2 transition-colors',
        'focus-within:ring-2',
        isInvalid
          ? 'border-danger/70 focus-within:border-danger focus-within:ring-danger/30'
          : 'border-white/[.12] focus-within:border-accent-light focus-within:ring-accent-light/30',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-accent/25 py-1 ps-2.5 pe-1 text-[13px] text-accent-lighter">
          <bdi className="break-words">{tag}</bdi>
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              onChange?.(value.filter((item) => item !== tag))
            }}
            aria-label={c.removeTag(tag)}
            className="inline-flex size-5 items-center justify-center rounded-md text-accent-lighter transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id ?? field?.id}
        value={draft}
        disabled={disabled || atMax}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => commit(draft)}
        placeholder={atMax ? c.tagsMax(max) : (placeholder ?? c.tagsPlaceholder)}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        dir={dir ? undefined : 'auto'}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink placeholder:text-faint focus:outline-none"
        {...rest}
      />
    </div>
  )
}
