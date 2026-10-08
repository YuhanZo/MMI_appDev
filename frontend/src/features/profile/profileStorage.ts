export const PROFILE_STORAGE_KEY = 'mmi-career-profile'

export const WORK_ARRANGEMENTS = ['Remote', 'Hybrid', 'On-site'] as const
export const CAREER_PRIORITIES = [
  'Salary',
  'Career Growth',
  'Work-Life Balance',
  'Location',
  'Job Stability',
  'Company Culture',
] as const

export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number]
export type CareerPriority = (typeof CAREER_PRIORITIES)[number]

export interface CareerProfile {
  name: string
  initials: string
  major: string
  university: string
  graduationYear: string
  experienceLevel: string
  skills: string[]
  experienceSummary: string
  targetRole: string
  preferredLocation: string
  salaryRange: string
  workArrangement: WorkArrangement
  priorities: CareerPriority[]
}

export const MOCK_CAREER_PROFILE: CareerProfile = {
  name: 'Demo User',
  initials: 'DU',
  major: 'BS Computer Science',
  university: 'The Ohio State University',
  graduationYear: '2027',
  experienceLevel: 'Entry Level',
  skills: ['Python', 'Java', 'React'],
  experienceSummary: 'Backend and web development project experience.',
  targetRole: 'Software Engineer',
  preferredLocation: 'Columbus, OH',
  salaryRange: '$70,000 – $90,000',
  workArrangement: 'Hybrid',
  priorities: ['Career Growth', 'Work-Life Balance', 'Salary'],
}

function cloneProfile(profile: CareerProfile): CareerProfile {
  return { ...profile, skills: [...profile.skills], priorities: [...profile.priorities] }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isCareerProfile(value: unknown): value is CareerProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Record<string, unknown>
  const stringFields = [
    'name',
    'initials',
    'major',
    'university',
    'graduationYear',
    'experienceLevel',
    'experienceSummary',
    'targetRole',
    'preferredLocation',
    'salaryRange',
  ]

  return (
    stringFields.every((field) => typeof profile[field] === 'string') &&
    isStringArray(profile.skills) &&
    typeof profile.workArrangement === 'string' &&
    WORK_ARRANGEMENTS.includes(profile.workArrangement as WorkArrangement) &&
    isStringArray(profile.priorities) &&
    profile.priorities.length <= 3 &&
    profile.priorities.every((priority) => CAREER_PRIORITIES.includes(priority as CareerPriority))
  )
}

export function loadCareerProfile(): CareerProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!stored) return cloneProfile(MOCK_CAREER_PROFILE)
    const parsed: unknown = JSON.parse(stored)
    return isCareerProfile(parsed) ? cloneProfile(parsed) : cloneProfile(MOCK_CAREER_PROFILE)
  } catch {
    return cloneProfile(MOCK_CAREER_PROFILE)
  }
}

export function saveCareerProfile(profile: CareerProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}
