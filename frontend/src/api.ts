import type {
  DetailedFeedbackRequest,
  DetailedInterviewFeedback,
  FitAnalysisRequest,
  FitAnalysisResult,
  InterviewAnswer,
  InterviewFeedback,
  InterviewMode,
  InterviewQuestion,
  InterviewSummary,
  Job,
  JobSearchRequest,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(await errorMessage(res))
  }
  return res.json() as Promise<T>
}

// Backend errors look like {"detail": ...}. Aivana failures put {message, code, request_id}
// there; anything else (e.g. a 422's list of field errors) falls back to the status line.
async function errorMessage(res: Response): Promise<string> {
  try {
    const detail = (await res.json())?.detail
    if (typeof detail?.message === 'string') {
      return detail.request_id ? `${detail.message} (request ${detail.request_id})` : detail.message
    }
  } catch {
    // body wasn't JSON
  }
  return `${res.status} ${res.statusText}`
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const health = () => request<{ status: string; database: string }>('/api/health')

export const searchJobs = (req: JobSearchRequest) => post<Job[]>('/api/jobs/search', req)

export const fitAnalysis = (req: FitAnalysisRequest) =>
  post<FitAnalysisResult>('/api/jobs/fit-analysis', req)

export const getQuestions = (mode?: InterviewMode) =>
  request<InterviewQuestion[]>(
    `/api/interview/questions${mode ? `?mode=${encodeURIComponent(mode)}` : ''}`,
  )

export const getFeedback = (answer: InterviewAnswer) =>
  post<InterviewFeedback>('/api/interview/feedback', answer)

export const getDetailedFeedback = (answer: DetailedFeedbackRequest) =>
  post<DetailedInterviewFeedback>('/api/interview/detailed-feedback', answer)

export const getInterviewSummary = (mode: InterviewMode) =>
  request<InterviewSummary>(`/api/interview/summary?mode=${encodeURIComponent(mode)}`)
