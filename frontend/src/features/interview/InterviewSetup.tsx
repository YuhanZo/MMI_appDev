import type { InterviewMode } from '../../types'

interface InterviewSetupProps {
  mode: InterviewMode
  company: string
  position: string
  onCompanyChange: (value: string) => void
  onPositionChange: (value: string) => void
  onStart: () => void
}

export default function InterviewSetup({
  mode,
  company,
  position,
  onCompanyChange,
  onPositionChange,
  onStart,
}: InterviewSetupProps) {
  const label = mode === 'behavioral' ? 'Behavioral' : 'Technical'
  const ready = company.trim().length > 0 && position.trim().length > 0

  return (
    <section className="interview-panel interview-setup-panel" aria-labelledby={`${mode}-setup-title`}>
      <h2 id={`${mode}-setup-title`} className="interview-section-title">
        {label} Interview Setup
      </h2>
      <p className="interview-muted">
        Tell us which opportunity you are preparing for, then start your {label.toLowerCase()} practice session.
      </p>
      <div className="interview-setup-grid">
        <div className="interview-field">
          <label htmlFor={`${mode}-company`}>Company</label>
          <input
            id={`${mode}-company`}
            value={company}
            onChange={(event) => onCompanyChange(event.target.value)}
            placeholder="Example: Microsoft"
          />
        </div>
        <div className="interview-field">
          <label htmlFor={`${mode}-position`}>Position / Job Title</label>
          <input
            id={`${mode}-position`}
            value={position}
            onChange={(event) => onPositionChange(event.target.value)}
            placeholder="Example: Software Engineer Intern"
          />
        </div>
      </div>
      <div className="interview-actions">
        <button className="interview-primary-button" type="button" disabled={!ready} onClick={onStart}>
          Start Interview
        </button>
      </div>
    </section>
  )
}
