import type { UserProfile } from '../../types'

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
  resumeText: string // '' when no resume is uploaded
  resumeFileName: string
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
  resumeText: '',
  resumeFileName: '',
}

// Fields added after profiles were first saved. A stored profile without them gets
// these values instead of failing validation and being replaced by the mock profile.
const ADDED_FIELD_DEFAULTS = { resumeText: '', resumeFileName: '' }

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
    'resumeText',
    'resumeFileName',
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

/** True once the user has saved their own profile; until then the mock profile is used. */
export function hasSavedProfile(): boolean {
  try {
    return localStorage.getItem(PROFILE_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function loadCareerProfile(): CareerProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!stored) return cloneProfile(MOCK_CAREER_PROFILE)
    const parsed: unknown = JSON.parse(stored)
    const withDefaults = parsed && typeof parsed === 'object' ? { ...ADDED_FIELD_DEFAULTS, ...parsed } : parsed
    return isCareerProfile(withDefaults) ? cloneProfile(withDefaults) : cloneProfile(MOCK_CAREER_PROFILE)
  } catch {
    return cloneProfile(MOCK_CAREER_PROFILE)
  }
}

export function saveCareerProfile(profile: CareerProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

/** The profile in the API's UserProfile format, for fit analysis. */
export function toUserProfile(profile: CareerProfile): UserProfile {
  const school = [profile.university, profile.graduationYear && `class of ${profile.graduationYear}`]
    .filter(Boolean)
    .join(', ')
  return {
    skills: [...profile.skills],
    education: [profile.major, school].filter(Boolean).join(', '),
    experience: [profile.experienceLevel, profile.experienceSummary].filter(Boolean).join('. '),
    target_role: profile.targetRole,
    preferred_location: profile.preferredLocation,
    work_arrangement: profile.workArrangement,
    salary_range: profile.salaryRange,
    priorities: [...profile.priorities],
    resume_text: profile.resumeText,
  }
}