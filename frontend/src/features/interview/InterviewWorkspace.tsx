import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../api'
import type {
  InterviewAnswerType,
  InterviewMode,
  InterviewQuestion,
  InterviewSummary as InterviewSummaryData,
} from '../../types'
import InterviewSession from './InterviewSession'
import InterviewSetup from './InterviewSetup'
import InterviewSummary from './InterviewSummary'
import {
  createCrossModeSessionState,
  createSetupResetState,
  type InterviewSessionState,
} from './sessionState'
import './interview.css'

export interface InterviewLaunchRequest {
  nonce: number
  company: string
  position: string
}

interface InterviewWorkspaceProps {
  mode: InterviewMode
  launchRequest?: InterviewLaunchRequest | null
  onTryOtherMode: (mode: InterviewMode, company: string, position: string) => void
}

export default function InterviewWorkspace({
  mode,
  launchRequest = null,
  onTryOtherMode,
}: InterviewWorkspaceProps) {
  const [session, setSession] = useState<InterviewSessionState>(() => createSetupResetState(mode))
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [summary, setSummary] = useState<InterviewSummaryData | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const lastLaunchNonce = useRef<number | null>(null)

  const beginInterview = useCallback(async (company: string, position: string) => {
    setSummary(null)
    setStarting(true)
    setSession((current) => ({ ...current, error: '' }))
    try {
      const result = await api.createInterviewSession({
        company: company.trim(),
        position: position.trim(),
        mode,
      })
      setQuestions(result.questions)
      setSession({
        ...createCrossModeSessionState(
          result.company,
          result.position,
          result.mode,
          result.session_id,
        ),
        currentQuestion: result.current_question_index,
      })
    } catch (error) {
      setSession((current) => ({
        ...current,
        company,
        position,
        stage: 'setup',
        error: String(error),
      }))
    } finally {
      setStarting(false)
    }
  }, [mode])

  useEffect(() => {
    if (!launchRequest || launchRequest.nonce === lastLaunchNonce.current) return
    lastLaunchNonce.current = launchRequest.nonce
    void beginInterview(launchRequest.company, launchRequest.position)
  }, [beginInterview, launchRequest])

  const question = questions[session.currentQuestion]
  const currentAnswer = question ? session.answers[question.id]?.value ?? '' : ''
  const modeLabel = mode === 'behavioral' ? 'Behavioral' : 'Technical'

  function updateSession(patch: Partial<InterviewSessionState>) {
    setSession((current) => ({ ...current, ...patch }))
  }

  function startInterview() {
    void beginInterview(session.company, session.position)
  }

  function updateAnswer(value: string) {
    if (!question) return
    setSession((current) => ({
      ...current,
      error: '',
      answers: {
        ...current.answers,
        [question.id]: {
          value,
          answerType: current.answerType,
          language: current.answerType === 'code' && mode === 'technical' ? current.language : null,
        },
      },
    }))
  }

  function updateAnswerType(answerType: InterviewAnswerType) {
    setSession((current) => {
      if (!question) return { ...current, answerType }
      const stored = current.answers[question.id]
      return {
        ...current,
        answerType,
        answers: stored
          ? {
              ...current.answers,
              [question.id]: {
                ...stored,
                answerType,
                language: answerType === 'code' ? current.language : null,
              },
            }
          : current.answers,
      }
    })
  }

  function updateLanguage(language: string) {
    setSession((current) => {
      if (!question || !current.answers[question.id]) return { ...current, language }
      return {
        ...current,
        language,
        answers: {
          ...current.answers,
          [question.id]: { ...current.answers[question.id], language },
        },
      }
    })
  }

  async function submitAnswer() {
    if (submitting || !session.sessionId || !question || !currentAnswer.trim()) return
    setSubmitting(true)
    updateSession({ error: '' })
    try {
      const result = await api.submitInterviewAnswer(session.sessionId, {
        question_index: session.currentQuestion,
        answer: currentAnswer,
        answer_type: session.answerType,
        language: mode === 'technical' && session.answerType === 'code' ? session.language : null,
      })
      setSession((current) => ({
        ...current,
        feedback: { ...current.feedback, [question.id]: result },
        currentQuestion: result.current_question_index,
        stage: result.current_question_index >= questions.length ? 'complete' : 'session',
      }))
    } catch (error) {
      updateSession({ error: String(error) })
    } finally {
      setSubmitting(false)
    }
  }

  async function showSummary() {
    if (!session.sessionId) return
    updateSession({ error: '' })
    try {
      const result = await api.getInterviewSummary(session.sessionId)
      setSummary(result)
      updateSession({ stage: 'summary' })
    } catch (error) {
      updateSession({ error: String(error) })
    }
  }

  function resetToSetup() {
    setSummary(null)
    setQuestions([])
    setSession(createSetupResetState(mode))
  }

  function restartInterview() {
    void beginInterview(session.company, session.position)
  }

  const otherMode: InterviewMode = mode === 'behavioral' ? 'technical' : 'behavioral'

  return (
    <div className="interview-workspace">
      <header className="interview-page-header">
        <div>
          <p className="interview-eyebrow">Aivana MMI Frontend Prototype</p>
          <h1>{modeLabel} Interview</h1>
          <p>Practice five {modeLabel.toLowerCase()} questions with real Aivana feedback.</p>
        </div>
        <div className="interview-header-meta">
          {session.stage !== 'setup' && (
            <button type="button" className="interview-ghost-button" onClick={resetToSetup}>
              Back to Interview Setup
            </button>
          )}
          <aside className="interview-status-card" aria-label="Session status">
            <span>Current Mode</span>
            <strong>{modeLabel} Interview</strong>
          </aside>
        </div>
      </header>

      {session.stage === 'setup' && (
        <>
          {session.error && <p className="interview-error" role="alert">{session.error}</p>}
          <InterviewSetup
            mode={mode}
            company={session.company}
            position={session.position}
            starting={starting}
            onCompanyChange={(company) => updateSession({ company, error: '' })}
            onPositionChange={(position) => updateSession({ position, error: '' })}
            onStart={startInterview}
          />
        </>
      )}

      {session.stage === 'session' && question && (
        <InterviewSession
          mode={mode}
          company={session.company}
          position={session.position}
          questions={questions}
          questionIndex={session.currentQuestion}
          answers={session.answers}
          feedback={session.feedback}
          answer={currentAnswer}
          answerType={session.answerType}
          language={session.language}
          error={session.error}
          submitting={submitting}
          onAnswerChange={updateAnswer}
          onAnswerTypeChange={updateAnswerType}
          onLanguageChange={updateLanguage}
          onSubmit={submitAnswer}
        />
      )}

      {session.stage === 'session' && !question && (
        <section className="interview-panel interview-completion-panel">
          <h2>Loading interview questions...</h2>
        </section>
      )}

      {session.stage === 'complete' && (
        <>
          <InterviewSession
            mode={mode}
            company={session.company}
            position={session.position}
            questions={questions}
            questionIndex={questions.length - 1}
            answers={session.answers}
            feedback={session.feedback}
            answer=""
            answerType={session.answerType}
            language={session.language}
            error=""
            submitting={false}
            completed
            onAnswerChange={updateAnswer}
            onAnswerTypeChange={updateAnswerType}
            onLanguageChange={updateLanguage}
            onSubmit={submitAnswer}
          />
          <section className="interview-panel interview-completion-panel" aria-label="Interview complete">
            <h2>Interview Complete</h2>
            <p>You completed five interview questions for {session.company} · {session.position}.</p>
            {session.error && <p className="interview-error" role="alert">{session.error}</p>}
            <div className="interview-actions">
              <button type="button" className="interview-primary-button" onClick={restartInterview}>
                Generate 5 More Questions
              </button>
              <button type="button" className="interview-secondary-button" onClick={showSummary}>
                View Interview Summary
              </button>
            </div>
          </section>
        </>
      )}

      {session.stage === 'summary' && summary && (
        <InterviewSummary
          mode={mode}
          summary={summary}
          onTryOtherMode={() => onTryOtherMode(otherMode, session.company, session.position)}
        />
      )}
    </div>
  )
}
