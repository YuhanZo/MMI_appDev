import type { Job } from '../../types'

const KEY = 'mmi-saved-jobs'

// Saved jobs are kept whole, so they can be opened again without a new search. They
// live in this browser only; storage can be blocked, so failures just mean nothing is kept.
export function loadSavedJobs(): Job[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((j) => j && typeof j.id === 'string') : []
  } catch {
    return []
  }
}

export function saveSavedJobs(jobs: Job[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs))
  } catch {
    // Storage blocked: the list still works for this visit.
  }
}

/** Saves the job, or removes it if it's already saved; newest first. */
export function toggleSaved(jobs: Job[], job: Job): Job[] {
  return jobs.some((j) => j.id === job.id) ? jobs.filter((j) => j.id !== job.id) : [job, ...jobs]
}
