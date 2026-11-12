import { Icon } from '../../icons'
import type { JobSearchState } from './useJobSearch'

/** The open job's fit analysis: waiting, error with Retry, or the result. */
export default function FitPanel({ js }: { js: JobSearchState }) {
  const { fit, analyzing, waiting, fitError } = js

  return (
    <aside className="fit-panel" aria-label="Fit analysis" aria-busy={analyzing || waiting}>
      <p className="fit-for">
        <Icon name="sparkle" size={18} />
        Your fit
      </p>

      {analyzing && <p className="empty">Analyzing your fit…</p>}
      {waiting && (
        <p className="empty" role="status">
          Waiting for the current analysis to finish…
        </p>
      )}

      {fitError && (
        <>
          <p className="error" role="alert">
            {fitError}
          </p>
          <button type="button" className="btn-outline" onClick={js.retry}>
            Retry
          </button>
        </>
      )}

      {fit && (
        <>
          <p className="fit-summary">{fit.summary}</p>
          <div className="fit-sections">
            <FitList title="Strengths" tone="good" items={fit.strengths} />
            <FitList title="Gaps" tone="warn" items={fit.gaps} />
            <FitList title="Recommendations" items={fit.recommendations} />
          </div>
        </>
      )}
    </aside>
  )
}

function FitList({ title, items, tone }: { title: string; items: string[]; tone?: 'good' | 'warn' }) {
  return (
    <div className={`tile${tone ? ` tile-${tone}` : ''}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
