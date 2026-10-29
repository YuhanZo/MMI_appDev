import { useEffect, useRef } from 'react'
import type {
  InterviewAnswerType,
  InterviewFeedbackDetail,
  InterviewMode,
  InterviewQuestion,
} from '../../types'
import { Icon } from '../../icons'
import type { StoredInterviewAnswer } from './sessionState'
import InterviewFeedback from './InterviewFeedback'
import InterviewProgress from './InterviewProgress'

interface InterviewSessionProps {
  mode: InterviewMode
  company: string
  position: string
  questions: InterviewQuestion[]
  questionIndex: number
  answers: Record<string, StoredInterviewAnswer>
  feedback: Record<string, InterviewFeedbackDetail>
  answer: string
  answerType: InterviewAnswerType
  language: string
  error: string
  submitting: boolean
  completed?: boolean
  onAnswerChange: (value: string) => void
  onAnswerTypeChange: (value: InterviewAnswerType) => void
  onLanguageChange: (value: string) => void
  onSubmit: () => void
}

export default function InterviewSession({
  mode,
  company,
  position,
  questions,
  questionIndex,
  answers,
  feedback,
  answer,
  answerType,
  language,
  error,
  submitting,
  completed = false,
  onAnswerChange,
  onAnswerTypeChange,
  onLanguageChange,
  onSubmit,
}: InterviewSessionProps) {
  const question = questions[questionIndex]
  const endRef = useRef<HTMLDivElement>(null)
  const modeLabel = mode === 'behavioral' ? 'Behavioral Interview' : 'Technical Interview'
  const isCode = mode === 'technical' && answerType === 'code'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [feedback, questionIndex, submitting])

  return (
    <section className="interview-session-layout" aria-label="Interview session">
      <div className="interview-panel interview-main-panel interview-chat-panel">
        <div className="interview-context-row">
          <span className="interview-pill">{company} · {position}</span>
          <span className="interview-pill">{modeLabel}</span>
        </div>

        <div className="interview-conversation" aria-label="Interview conversation">
          {questions.slice(0, questionIndex + 1).map((item, index) => {
            const storedAnswer = answers[item.id]
            const storedFeedback = feedback[item.id]
            const showSubmittedAnswer = index < questionIndex || Boolean(storedFeedback) || (index === questionIndex && submitting)
            return (
              <div className="interview-turn" key={item.id}>
                <article className="interview-message interview-message-ai">
                  <strong>Question {index + 1}</strong>
                  <p>{item.question}</p>
                </article>
                {showSubmittedAnswer && storedAnswer && (
                  <article className="interview-message interview-message-user">
                    <strong>Your Answer</strong>
                    {storedAnswer.answerType === 'code' ? <pre>{storedAnswer.value}</pre> : <p>{storedAnswer.value}</p>}
                  </article>
                )}
                {storedFeedback && (
                  <article className="interview-message interview-message-ai interview-feedback-message">
                    <InterviewFeedback feedback={storedFeedback} />
                  </article>
                )}
              </div>
            )
          })}
          {submitting && <p className="interview-muted" role="status">Aivana is evaluating your answer...</p>}
          <div ref={endRef} />
        </div>

        {!completed && mode === 'technical' && (
          <div className="interview-answer-controls">
            <span className="interview-control-label">Answer Type</span>
            <div className="interview-answer-type-group" role="group" aria-label="Answer type">
              <button
                type="button"
                className={`interview-answer-type-button${answerType === 'text' ? ' active' : ''}`}
                aria-pressed={answerType === 'text'}
                disabled={submitting}
                onClick={() => onAnswerTypeChange('text')}
              >
                {answerType === 'text' && <Icon name="check" size={18} />}
                Text / Explanation
              </button>
              <button
                type="button"
                className={`interview-answer-type-button${answerType === 'code' ? ' active' : ''}`}
                aria-pressed={answerType === 'code'}
                disabled={submitting}
                onClick={() => onAnswerTypeChange('code')}
              >
                {answerType === 'code' && <Icon name="check" size={18} />}
                Code
              </button>
            </div>
          </div>
        )}

        {!completed && isCode && (
          <div className="interview-technical-toolbar">
            <p className="interview-assessment-note">AI Assessment Only — Code has not been executed against real test cases.</p>
            <div className="interview-field">
              <label htmlFor={`${question.id}-language`}>Programming Language</label>
              <select
                id={`${question.id}-language`}
                value={language}
                disabled={submitting}
                onChange={(event) => onLanguageChange(event.target.value)}
              >
                <option>Python</option>
                <option>Java</option>
                <option>C++</option>
                <option>JavaScript</option>
              </select>
            </div>
          </div>
        )}

        {!completed && (
          <>
            <div className="interview-field interview-answer-field interview-chat-composer">
              <label htmlFor={`${question.id}-answer`}>{isCode ? 'Code Answer' : 'Your Answer'}</label>
              <textarea
                id={`${question.id}-answer`}
                className={isCode ? 'interview-code-editor' : undefined}
                value={answer}
                disabled={submitting}
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
                {submitting ? 'Evaluating...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
      <InterviewProgress
        questions={questions}
        questionIndex={questionIndex}
        feedback={feedback}
      />
    </section>
  )
}
