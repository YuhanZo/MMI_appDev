import type { CareerProfile } from './profileStorage'

/** The profile's sections, in page order; each card on the page has one of these ids. */
export const SECTIONS = [
  { id: 'about', title: 'About Me' },
  { id: 'skills', title: 'Skills & Experience' },
  { id: 'preferences', title: 'Career Preferences' },
  { id: 'priorities', title: 'Career Priorities' },
  { id: 'resume', title: 'Resume' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

export const MIN_SKILLS = 3

export interface CompletenessItem {
  section: SectionId
  todo: string // what to do while it's missing
  weight: number // percentage points it adds
  done: boolean
}

const filled = (...values: string[]) => values.every((v) => v.trim() !== '')

/** The resume counts most, since fit analysis reads it; the other five items share the rest equally. */
export function completenessItems(p: CareerProfile): CompletenessItem[] {
  return [
    { section: 'resume', todo: 'Upload your resume', weight: 25, done: filled(p.resumeText) },
    {
      section: 'about',
      todo: 'Complete your basic info',
      weight: 15,
      done: filled(p.name, p.major, p.university, p.graduationYear),
    },
    { section: 'skills', todo: `Add at least ${MIN_SKILLS} skills`, weight: 15, done: p.skills.length >= MIN_SKILLS },
    { section: 'skills', todo: 'Write an experience summary', weight: 15, done: filled(p.experienceSummary) },
    {
      section: 'preferences',
      todo: 'Fill in your career preferences',
      weight: 15,
      done: filled(p.targetRole, p.preferredLocation, p.salaryRange),
    },
    { section: 'priorities', todo: 'Pick your career priorities', weight: 15, done: p.priorities.length > 0 },
  ]
}

export function completenessPercent(p: CareerProfile): number {
  return completenessItems(p).reduce((sum, item) => sum + (item.done ? item.weight : 0), 0)
}
