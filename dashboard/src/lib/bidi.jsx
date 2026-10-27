// Mixed-direction text. A Latin snippet that starts or ends with punctuation (`vault://`, `ngp-portfolio/`, `.zip`,
// `http://`) inside an Arabic sentence is laid out by the Unicode bidi rules, which hand its edge punctuation to the
// Arabic around it: `vault://` reads `//:vault`. Isolating the snippet keeps it whole and left-to-right.

const LRI = '\u2066' // LEFT-TO-RIGHT ISOLATE
const PDI = '\u2069' // POP DIRECTIONAL ISOLATE

/**
 * A left-to-right snippet for a plain string (strings.js, toasts, field errors, placeholders): the text equivalent
 * of `<bdi dir="ltr">`, invisible on screen and to screen readers.
 *
 *   ar: { vaultRefHint: `مثل ${ltr('vault://ngp/dawri/production/db')} — لا تكتب كلمة المرور نفسها.` }
 */
export const ltr = (text) => `${LRI}${text}${PDI}`

/**
 * A template whose `{0}`, `{1}`… are filled with left-to-right snippets as `<bdi dir="ltr">` elements, for text that is
 * rendered as JSX (help lists, notes).
 *
 *   withLtr('اسحب المجلد ({0}) إلى هنا.', ['ngp-portfolio/'], 'font-mono')
 */
export function withLtr(template, values = [], className) {
  return String(template)
    .split(/\{(\d+)\}/)
    .map((part, index) =>
      index % 2 ? (
        <bdi key={index} dir="ltr" className={className}>
          {values[Number(part)]}
        </bdi>
      ) : (
        part
      ),
    )
}
