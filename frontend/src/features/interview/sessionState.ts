import type {
  DetailedInterviewFeedback,
  InterviewAnswerType,
  InterviewMode,
} from '../../types'

export type InterviewStage = 'setup' | 'session' | 'complete' | 'summary'

export interface StoredInterviewAnswer {
  value: string
  answerType: InterviewAnswerType
  language: string | null
}

export interface InterviewSessionState {
  mode: InterviewMode
  company: string
  position: string
  currentQuestion: number
  answers: Record<string, StoredInterviewAnswer>
  feedback: Record<string, DetailedInterviewFeedback>
  stage: InterviewStage
  answerType: InterviewAnswerType
  language: string
  error: string
}

export function createSetupResetState(mode: InterviewMode): InterviewSessionState {
  return {
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
): InterviewSessionState {
  return {
    ...createSetupResetState(mode),
    company,
    position,
    stage: 'session',
  }
}
