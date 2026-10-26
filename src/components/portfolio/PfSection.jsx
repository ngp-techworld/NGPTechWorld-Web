import { useId } from 'react'

/**
 * One section of a project page: an h2 and, when the content is a list, how many items it holds.
 * The count is information (twelve features is a different project from two), so it is shown only
 * where there is something to count.
 */
export default function PfSection({ title, count, children, className = '', action }) {
  const id = useId()
  return (
    <section className={'pf-section ' + className} aria-labelledby={id}>
      <div className="pf-section__head">
        <h2 id={id} className="pf-section__title ngp-fluid">{title}</h2>
        {count != null && <span className="pf-section__count">{count}</span>}
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}
