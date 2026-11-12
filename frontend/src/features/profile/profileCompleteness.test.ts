import { describe, expect, it } from 'vitest'
import { completenessItems, completenessPercent } from './profileCompleteness'
import { MOCK_CAREER_PROFILE } from './profileStorage'

describe('profile completeness', () => {
  it('weights the resume at 25% and the other five items at 15% each', () => {
    const weights = completenessItems(MOCK_CAREER_PROFILE).map((i) => i.weight)
    expect(weights).toEqual([25, 15, 15, 15, 15, 15])
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('is 75% for the demo profile, which has everything but a resume', () => {
    expect(completenessPercent(MOCK_CAREER_PROFILE)).toBe(75)
    expect(completenessItems(MOCK_CAREER_PROFILE).filter((i) => !i.done).map((i) => i.todo)).toEqual([
      'Upload your resume',
    ])
  })

  it('is 100% with a resume', () => {
    expect(completenessPercent({ ...MOCK_CAREER_PROFILE, resumeText: 'Resume.' })).toBe(100)
  })

  it('lists what is missing, with the section to fix it in', () => {
    const p = { ...MOCK_CAREER_PROFILE, skills: ['Python'], experienceSummary: ' ', salaryRange: '', priorities: [] }
    const missing = completenessItems(p).filter((i) => !i.done)
    expect(missing.map((i) => [i.section, i.todo])).toEqual([
      ['resume', 'Upload your resume'],
      ['skills', 'Add at least 3 skills'],
      ['skills', 'Write an experience summary'],
      ['preferences', 'Fill in your career preferences'],
      ['priorities', 'Pick your career priorities'],
    ])
    expect(completenessPercent(p)).toBe(15)
  })
})
