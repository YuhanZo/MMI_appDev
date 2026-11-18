import { describe, expect, it } from 'vitest'
import type { InterviewHistoryItem } from '../../types'
import { activityLevel, bandOf, dayKey, scoreSummary, sessionsByDay, streaks, yearWeeks } from './practiceActivity'

const item = (started: Date, scores: number[] = []): InterviewHistoryItem => ({
  started_at: started.toISOString(),
  mode: 'behavioral',
  answered: scores.length,
  completed: scores.length === 5,
  scores,
})

const days = (...keys: string[]) => new Map(keys.map((k) => [k, 1]))

describe('practiceActivity', () => {
  it('groups sessions by local day', () => {
    const morning = new Date(2026, 10, 12, 8, 0)
    const night = new Date(2026, 10, 12, 23, 30)
    const next = new Date(2026, 10, 13, 0, 15)
    const counts = sessionsByDay([item(morning), item(night), item(next)])
    expect(counts.get('2026-11-12')).toBe(2)
    expect(counts.get('2026-11-13')).toBe(1)
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('counts the current streak back from today, or from yesterday when today is still empty', () => {
    const today = new Date(2026, 10, 16, 12)
    expect(streaks(days('2026-11-14', '2026-11-15', '2026-11-16'), today).current).toBe(3)
    expect(streaks(days('2026-11-14', '2026-11-15'), today).current).toBe(2)
    expect(streaks(days('2026-11-13', '2026-11-14'), today).current).toBe(0)
  })

  it('finds the longest run of days, across month ends', () => {
    const today = new Date(2026, 10, 16)
    const result = streaks(days('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-10'), today)
    expect(result.best).toBe(4)
    expect(streaks(new Map(), today)).toEqual({ current: 0, best: 0 })
  })

  it('lays a year out as Sunday-first weeks with every day once', () => {
    const weeks = yearWeeks(2026) // Jan 1 2026 is a Thursday
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0][4]?.getDate()).toBe(1)
    const all = weeks.flat().filter((d): d is Date => d !== null)
    expect(all).toHaveLength(365)
    expect(dayKey(all[all.length - 1])).toBe('2026-12-31')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('shades days by how many sessions they had', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(activityLevel)).toEqual([0, 1, 2, 3, 3, 4, 4])
  })

  it('averages every answer and sorts scores into bands', () => {
    const summary = scoreSummary([item(new Date(), [1, 2, 6, 7]), item(new Date(), [10]), item(new Date())])
    expect(summary.answers).toBe(5)
    expect(summary.average).toBeCloseTo(5.2)
    expect(summary.bands).toEqual([2, 0, 1, 1, 1])
    expect(scoreSummary([]).average).toBeNull()
    expect([1, 4.4, 5.2, 8.6, 10].map(bandOf)).toEqual([0, 1, 2, 4, 4])
  })
})
