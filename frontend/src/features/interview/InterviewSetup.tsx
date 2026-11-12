import type { InterviewMode } from '../../types'

interface InterviewSetupProps {
  mode: InterviewMode
  company: string
  position: string
  hasResume: boolean
  starting: boolean
  onCompanyChange: (value: string) => void
  onPositionChange: (value: string) => void
  onStart: () => void
}

export default function InterviewSetup({
  mode,
  company,
  position,
  hasResume,
  starting,
  onCompanyChange,
  onPositionChange,
  onStart,
}: InterviewSetupProps) {
  const label = mode === 'behavioral' ? 'Behavioral' : 'Technical'
  const ready = company.trim().length > 0 && position.trim().length > 0

  return (
    <section className="interview-panel interview-setup-panel" aria-label={`${label} Interview Setup`}>
      <div className={`interview-resume-status${hasResume ? ' uploaded' : ''}`} aria-label="Resume status">
        <strong>{hasResume ? 'Resume Uploaded' : 'No Resume Uploaded'}</strong>
        <span>
          {hasResume
            ? 'Questions will be personalized using your uploaded resume.'
            : 'Upload a resume from Profile to personalize your interview.'}
        </span>
      </div>
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
        <button className="interview-primary-button" type="button" disabled={!ready || starting} onClick={onStart}>
          {starting ? 'Generating Questions...' : 'Start Interview'}
        </button>
      </div>
    </section>
  )
}
