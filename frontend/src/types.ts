// Mirrors ref/prototype-data-format-v0.1.md -- keep in sync with backend/app/schemas.py.

export type WorkArrangement = 'any' | 'remote' | 'onsite' | 'hybrid'
export type ExperienceLevel = 'any' | 'entry' | 'mid' | 'senior'
export type EmploymentType = 'any' | 'full_time' | 'part_time' | 'contract' | 'internship'

export interface JobSearchRequest {
  role: string
  location: string
  work_arrangement: WorkArrangement
  experience_level: ExperienceLevel
  employment_type: EmploymentType
  salary_min: number | null // yearly, USD
  salary_max: number | null // yearly, USD
  industry: string
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
