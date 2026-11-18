import type { InterviewHistoryItem } from '../../types'

// Practice history turned into what the profile overview shows: sessions per day in
// the user's own time zone, streaks of days in a row, a year's calendar grid and how
// the answers scored. Every interview started counts as one session.

/** A local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Sessions started on each local day. */
export function sessionsByDay(history: InterviewHistoryItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of history) {
    const key = dayKey(new Date(item.started_at))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Days in a row with practice. The current streak still counts when today has nothing
 * yet but yesterday did, so it doesn't reset before the day is over.
 */
export function streaks(days: Map<string, number>, today = new Date()): { current: number; best: number } {
  let current = 0
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1)
  while (days.has(dayKey(cursor))) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let best = 0
  for (const key of days.keys()) {
    const [y, m, d] = key.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    if (days.has(dayKey(addDays(start, -1)))) continue // not the first day of a run
    let length = 0
    let run = start
    while (days.has(dayKey(run))) {
      length += 1
      run = addDays(run, 1)
    }
    best = Math.max(best, length)
  }
  return { current, best }
}

/** A year as weeks (columns) of seven days, Sunday first; days outside the year are null. */
export function yearWeeks(year: number): (Date | null)[][] {
  const first = new Date(year, 0, 1)
  let cursor = addDays(first, -first.getDay())
  const weeks: (Date | null)[][] = []
  while (cursor.getFullYear() <= year) {
    const week: (Date | null)[] = []
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor.getFullYear() === year ? cursor : null)
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** How dark a day's cell is: 0 for none, then 1, 2, 3-4 and 5 or more sessions. */
export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

export const SCORE_BANDS = ['1-2', '3-4', '5-6', '7-8', '9-10'] as const

/** Every answer's score: the average, and how many fell in each band of SCORE_BANDS. */
export function scoreSummary(history: InterviewHistoryItem[]): { answers: number; average: number | null; bands: number[] } {
  const scores = history.flatMap((item) => item.scores)
  const bands = SCORE_BANDS.map(() => 0)
  for (const score of scores) bands[Math.min(4, Math.max(0, Math.ceil(score / 2) - 1))] += 1
  const average = scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null
  return { answers: scores.length, average, bands }
}

/** The band an average falls in, so the chart can mark it. */
export function bandOf(score: number): number {
  return Math.min(4, Math.max(0, Math.ceil(Math.round(score) / 2) - 1))
}
