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

export interface InterviewAnswer {
  question_id: string
  answer: string
}

export interface InterviewFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
}
