// Mirrors ref/prototype-data-format-v0.1.md -- keep in sync with backend/app/schemas.py.

export type WorkModel = 'onsite' | 'hybrid' | 'remote'
export type ExperienceLevel = 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'director'
export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship'

export const MAX_JOB_FUNCTIONS = 5 // each one is a separate JSearch request

// An empty list means "any" for that filter.
export interface JobSearchRequest {
  location: string
  job_functions: string[] // 1-5
  experience_levels: ExperienceLevel[]
  job_types: JobType[]
  work_models: WorkModel[]
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  description: string
  url: string
  company_logo: string // image URL
}

export interface UserProfile {
  skills: string[]
  education: string
  experience: string
  target_role: string
  preferred_location: string
  work_arrangement: string
  salary_range: string
  priorities: string[]
  resume_text: string // '' when no resume is uploaded
}

export interface ResumeUploadResult {
  filename: string
  text: string // plain text extracted from the file
  truncated: boolean // the file had more text than was kept
}

export interface FitAnalysisRequest {
  job: Job
  user_profile: UserProfile
}

export interface FitAnalysisResult {
  summary: string
  strengths: string[]
  gaps: string[]
  recommendations: string[]
}

export const MAX_BENCHMARK_PROMPT = 4000 // characters

export interface ModelReply {
  system: 'aivana' | 'baseline'
  model: string
  mock: boolean // canned reply: the numbers are placeholders
  text: string | null // null if the call failed
  latency_ms: number
  cost: number | null // in cost_unit; null if unknown
  cost_unit: 'credits' | 'usd'
  input_tokens: number | null
  output_tokens: number | null
  error: string | null
  request_id: string | null
}

export interface BenchmarkResult {
  replies: ModelReply[] // Aivana first, then the baseline
}

/** One question of the Scenario Test, with the points the judge checks. */
export interface Scenario {
  id: string
  number: number // 1-8, the order shown
  type: string // e.g. "Calculation"
  title: string
  question: string // sent to Aivana unchanged
  key_points: string[]
}

export interface ScenarioAnswer {
  scenario_id: string
  text: string // Aivana's answer
  latency_ms: number
}

export interface ScenarioVerdict {
  scenario_id: string
  correctness: number // 1-5, from the judge
  helpfulness: number // 1-5, from the judge
  honesty: number // 1-5, from the judge
  speed: number // 1-5, from the measured latency
  score: number // 0-100, the weighted total
  key_points_met: boolean[] // one per key point, in order
  verdict: 'pass' | 'partial' | 'fail'
  comment: string
}

export interface ScenarioJudgement {
  model: string // the judge model
  mock: boolean // canned verdicts
  latency_ms: number
  summary: string
  overall_score: number // 0-100, the mean of the scenario scores
  passed: number
  results: ScenarioVerdict[] // in the order of the request
}

export interface InterviewQuestion {
  id: string
  question: string
  type: 'behavioral' | 'technical' | 'general'
}

export interface CreateInterviewSessionRequest {
  company: string
  position: string
  mode: InterviewMode
}

export interface CreatedInterviewSession {
  session_id: string
  company: string
  position: string
  mode: InterviewMode
  status: 'active'
  current_question_index: number
  questions: InterviewQuestion[]
}

export interface InterviewFeedbackDetail {
  score: number
  feedback: string
  strengths: string[]
  areas_to_improve: string[]
  improved_answer: string
}

export interface InterviewTurnAnswerRequest {
  question_index: number
  answer: string
  answer_type: InterviewAnswerType
  language: string | null
}

export interface InterviewTurnEvaluated extends InterviewFeedbackDetail {
  session_id: string
  question_index: number
  question_id: string
  current_question_index: number
  next_question: InterviewQuestion | null
}

export interface InterviewAnswer {
  question_id: string
  answer: string
}

export interface InterviewFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
}

export type InterviewMode = 'behavioral' | 'technical'

export type InterviewAnswerType = 'text' | 'code'

export interface DetailedFeedbackRequest {
  question_id: string
  answer: string
  answer_type: InterviewAnswerType
  language: string | null
  company: string
  position: string
}

export interface BehavioralDetailedFeedback {
  mode: 'behavioral'
  ai_feedback: string
  strengths: string[]
  areas_to_improve: string[]
  star_structure: string
  improved_answer: string
}

export interface TechnicalDetailedFeedback {
  mode: 'technical'
  assessment: string
  explanation: string
  missing_points: string[]
  time_complexity: string
  space_complexity: string
  suggested_solution: string
}

export type DetailedInterviewFeedback = BehavioralDetailedFeedback | TechnicalDetailedFeedback

export interface InterviewSummary {
  session_id: string
  overall_evaluation: string
  strong_areas: string[]
  areas_to_improve: string[]
  total_score: number
  average_score: number
  question_results: Array<{
    question: string
    answer: string
    score: number
    feedback: string
  }>
  suggested_next_steps: string[]
}