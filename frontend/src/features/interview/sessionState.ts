import type { InterviewAnswerType, InterviewFeedbackDetail, InterviewMode } from '../../types'

export type InterviewStage = 'setup' | 'session' | 'complete' | 'summary'

export interface StoredInterviewAnswer {
  value: string
  answerType: InterviewAnswerType
  language: string | null
}

export interface InterviewSessionState {
  sessionId: string | null
  mode: InterviewMode
  company: string
  position: string
  currentQuestion: number
  answers: Record<string, StoredInterviewAnswer>
  feedback: Record<string, InterviewFeedbackDetail>
  stage: InterviewStage
  answerType: InterviewAnswerType
  language: string
  error: string
}

export function createSetupResetState(mode: InterviewMode): InterviewSessionState {
  return {
    sessionId: null,
    mode,
    company: '',
    position: '',
    currentQuestion: 0,
    answers: {},
    feedback: {},
    stage: 'setup',
    answerType: 'text',
    language: 'Python',
    error: '',
  }
}

export function createCrossModeSessionState(
  company: string,
  position: string,
  mode: InterviewMode,
  sessionId: string | null = null,
): InterviewSessionState {
  return {
    ...createSetupResetState(mode),
    sessionId,
    company,
    position,
    stage: 'session',
  }
}
