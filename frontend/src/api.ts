import type {
  FitAnalysisRequest,
  FitAnalysisResult,
  InterviewAnswer,
  InterviewFeedback,
  InterviewQuestion,
  Job,
  JobSearchRequest,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const health = () => request<{ status: string; database: string }>('/api/health')

export const searchJobs = (req: JobSearchRequest) => post<Job[]>('/api/jobs/search', req)

export const fitAnalysis = (req: FitAnalysisRequest) =>
  post<FitAnalysisResult>('/api/jobs/fit-analysis', req)

export const getQuestions = () => request<InterviewQuestion[]>('/api/interview/questions')

export const getFeedback = (answer: InterviewAnswer) =>
  post<InterviewFeedback>('/api/interview/feedback', answer)
