import { useEffect, useState } from 'react'
import { Textarea } from '@/ui'

const parse = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const same = (a, b) => a.length === b.length && a.every((item, index) => item === b[index])

/**
 * A list of sentences, one per line (implemented / verified / procedures…): unlike <TagsInput>, commas stay inside
 * an item. Controlled: `value` (string[]) + `onChange(string[])`; the raw text (blank lines while typing) is kept
 * locally and re-synced only when the value changes from outside (a reset after save).
 */
export function ListInput({ value = [], onChange, rows = 4, ...rest }) {
  const [text, setText] = useState(() => value.join('\n'))

  useEffect(() => {
    setText((current) => (same(parse(current), value) ? current : value.join('\n')))
  }, [value])

  return (
    <Textarea
      rows={rows}
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const next = parse(event.target.value)
        if (!same(next, value)) onChange?.(next)
      }}
      {...rest}
    />
  )
}
