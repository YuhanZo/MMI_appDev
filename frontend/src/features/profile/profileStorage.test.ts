import { beforeEach, describe, expect, it } from 'vitest'
import {
  MOCK_CAREER_PROFILE,
  PROFILE_STORAGE_KEY,
  loadCareerProfile,
  saveCareerProfile,
} from './profileStorage'

describe('profileStorage', () => {
  beforeEach(() => localStorage.clear())

  it('uses independent mock data when no stored profile exists', () => {
    const first = loadCareerProfile()
    first.skills.push('Rust')

    expect(loadCareerProfile()).toEqual(MOCK_CAREER_PROFILE)
    expect(loadCareerProfile().skills).not.toContain('Rust')
  })

  it('saves and restores a valid profile', () => {
    const profile = {
      ...MOCK_CAREER_PROFILE,
      targetRole: 'Product Engineer',
      priorities: ['Career Growth', 'Location'] as const,
    }

    saveCareerProfile({ ...profile, priorities: [...profile.priorities] })

    expect(loadCareerProfile()).toEqual(profile)
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toContain('Product Engineer')
  })

  it('falls back to mock data for malformed or invalid stored values', () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '{not json')
    expect(loadCareerProfile()).toEqual(MOCK_CAREER_PROFILE)

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: 'Incomplete' }))
    expect(loadCareerProfile()).toEqual(MOCK_CAREER_PROFILE)
  })
})
