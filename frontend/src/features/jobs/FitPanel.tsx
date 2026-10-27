import { Icon } from '../../icons'
import type { Job } from '../../types'
import type { JobSearchState } from './useJobSearch'

export default function FitPanel({ js, onPracticeInterview }: { js: JobSearchState; onPracticeInterview: (job: Job) => void }) {
  const { selected, fit, analyzing, waiting, fitError } = js

  if (!selected) {
    return (
      <aside className="fit-panel" aria-label="Fit analysis">
        <p className="empty">Select a job to see how well you fit.</p>
      </aside>
    )
  }

  return (
    <aside className="fit-panel" aria-label="Fit analysis" aria-busy={analyzing || waiting}>
      <h2 className="fit-title">{selected.title}</h2>
      <p className="fit-meta">
        {selected.company}
        <span className="job-location">
          <Icon name="place" size={14} />
          {selected.location}
        </span>
      </p>

      {analyzing && <p className="empty">Analyzing your fit…</p>}
      {waiting && (
        <p className="empty" role="status">
          Waiting for the current analysis to finish…
        </p>
      )}

      {fitError && (
        <p className="error" role="alert">
          {fitError}
        </p>
      )}

      {fit && (
        <>
          <p className="fit-for">
            <Icon name="sparkle" size={18} />
            Fit analysis
          </p>
          <p className="fit-summary">{fit.summary}</p>
          <div className="fit-sections">
            <FitList title="Strengths" tone="good" items={fit.strengths} />
            <FitList title="Gaps" tone="warn" items={fit.gaps} />
            <FitList title="Recommendations" items={fit.recommendations} />
          </div>

          <div className="next-steps">
            <button type="button" className="btn-filled" onClick={() => onPracticeInterview(selected)}>
              <Icon name="mic" size={18} />
              Practice interview
            </button>
            {selected.url && (
              <a className="btn-outline" href={selected.url} target="_blank" rel="noreferrer">
                View posting
              </a>
            )}
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
