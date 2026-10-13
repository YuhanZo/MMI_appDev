import type { InterviewMode, InterviewSummary as InterviewSummaryData } from '../../types'

interface InterviewSummaryProps {
  mode: InterviewMode
  summary: InterviewSummaryData
  onTryOtherMode: () => void
}

export default function InterviewSummary({ mode, summary, onTryOtherMode }: InterviewSummaryProps) {
  const otherModeLabel = mode === 'behavioral' ? 'Technical' : 'Behavioral'

  return (
    <section className="interview-panel interview-summary-panel" aria-label="Interview summary">
      <h2>Interview Summary</h2>
      <p>{summary.overall_performance}</p>

      <div className="interview-summary-grid">
        <section className="interview-summary-section">
          <h3>Strong Areas</h3>
          <ul>{summary.strong_areas.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="interview-summary-section">
          <h3>Areas to Improve</h3>
          <ul>{summary.areas_to_improve.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="interview-summary-section full">
          <h3>Question-by-Question Results</h3>
          <ul className="interview-result-list">
            {summary.question_results.map((item) => (
              <li key={item.question}>
                <strong>{item.question}</strong>
                <span>{item.result}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="interview-summary-section full">
          <h3>Suggested Next Steps</h3>
          <ul>{summary.suggested_next_steps.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>

      <div className="interview-actions interview-summary-actions">
        <button type="button" className="interview-primary-button" onClick={onTryOtherMode}>
          Try {otherModeLabel} Interview
        </button>
      </div>
    </section>
  )
}
