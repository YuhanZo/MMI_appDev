import type {
  DetailedInterviewFeedback,
  InterviewAnswerType,
  InterviewMode,
  InterviewQuestion,
} from '../../types'
import InterviewFeedback from './InterviewFeedback'

interface InterviewSessionProps {
  mode: InterviewMode
  company: string
  position: string
  question: InterviewQuestion
  questionIndex: number
  questionCount: number
  answer: string
  answerType: InterviewAnswerType
  language: string
  feedback?: DetailedInterviewFeedback
  error: string
  submitting: boolean
  onAnswerChange: (value: string) => void
  onAnswerTypeChange: (value: InterviewAnswerType) => void
  onLanguageChange: (value: string) => void
  onSubmit: () => void
  onPrevious: () => void
  onNext: () => void
}

export default function InterviewSession({
  mode,
  company,
  position,
  question,
  questionIndex,
  questionCount,
  answer,
  answerType,
  language,
  feedback,
  error,
  submitting,
  onAnswerChange,
  onAnswerTypeChange,
  onLanguageChange,
  onSubmit,
  onPrevious,
  onNext,
}: InterviewSessionProps) {
  const questionNumber = questionIndex + 1
  const progress = (questionNumber / questionCount) * 100
  const modeLabel = mode === 'behavioral' ? 'Behavioral Interview' : 'Technical Interview'
  const isCode = mode === 'technical' && answerType === 'code'

  return (
    <section className="interview-session-layout" aria-label="Interview session">
      <div className="interview-panel interview-main-panel">
        <div className="interview-context-row">
          <span className="interview-pill">{company} · {position}</span>
          <span className="interview-pill">{modeLabel}</span>
        </div>

        <div className="interview-question-topline">
          <p className="interview-question-count">Question {questionNumber} of {questionCount}</p>
          <div className="interview-progress-track" aria-label={`Interview progress ${Math.round(progress)} percent`}>
            <div className="interview-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <h2 className="interview-question-text">{question.question}</h2>

        {mode === 'technical' && (
          <div className="interview-answer-controls">
            <span className="interview-control-label">Answer Type</span>
            <div className="interview-answer-type-group" role="group" aria-label="Answer type">
              <button
                type="button"
                className={`interview-answer-type-button${answerType === 'text' ? ' active' : ''}`}
                onClick={() => onAnswerTypeChange('text')}
              >
                Text / Explanation
              </button>
              <button
                type="button"
                className={`interview-answer-type-button${answerType === 'code' ? ' active' : ''}`}
                onClick={() => onAnswerTypeChange('code')}
              >
                Code
              </button>
            </div>
          </div>
        )}

        {isCode && (
          <div className="interview-technical-toolbar">
            <p className="interview-assessment-note">AI Assessment Only — Code has not been executed against real test cases.</p>
            <div className="interview-field">
              <label htmlFor={`${question.id}-language`}>Programming Language</label>
              <select id={`${question.id}-language`} value={language} onChange={(event) => onLanguageChange(event.target.value)}>
                <option>Python</option>
                <option>Java</option>
                <option>C++</option>
                <option>JavaScript</option>
              </select>
            </div>
          </div>
        )}

        <div className="interview-field interview-answer-field">
          <label htmlFor={`${question.id}-answer`}>{isCode ? 'Code Answer' : 'Your Answer'}</label>
          <textarea
            id={`${question.id}-answer`}
            className={isCode ? 'interview-code-editor' : undefined}
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            spellCheck={!isCode}
            placeholder={isCode ? 'Write your solution or pseudocode here.' : 'Type your response here.'}
          />
        </div>

        {error && <p className="interview-error" role="alert">{error}</p>}

        <div className="interview-actions">
          <button
            type="button"
            className="interview-primary-button"
            onClick={onSubmit}
            disabled={submitting || answer.trim().length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
          <button
            type="button"
            className="interview-secondary-button"
            onClick={onPrevious}
            disabled={questionIndex === 0}
          >
            Previous
          </button>
          <button type="button" className="interview-secondary-button" onClick={onNext}>
            {questionIndex === questionCount - 1 ? 'Finish Interview' : 'Next Question'}
          </button>
        </div>
      </div>

      <aside className="interview-panel interview-feedback-panel" aria-label="Interview feedback">
        {feedback ? (
          <InterviewFeedback feedback={feedback} />
        ) : (
          <div className="interview-feedback-empty">
            <h2 className="interview-section-title">Feedback Preview</h2>
            <p>Submit an answer to display prepared AI-style feedback for this question.</p>
          </div>
        )}
      </aside>
    </section>
  )
}
