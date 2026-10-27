import { useRef, useState } from 'react'
import * as api from '../../api'
import { loadCareerProfile, toUserProfile } from '../profile/profileStorage'
import type { FitAnalysisResult, Job, JobSearchRequest } from '../../types'

const DEFAULT_FILTERS: JobSearchRequest = {
  role: 'Software Engineer Intern',
  location: 'Columbus, OH',
  work_arrangement: 'any',
  experience_level: 'any',
  employment_type: 'any',
  salary_min: null,
  salary_max: null,
  industry: '',
}

// Used by JobSearchView; the view stays mounted when hidden, so results survive switching views.
export function useJobSearch() {
  const [filters, setFilters] = useState<JobSearchRequest>(DEFAULT_FILTERS)

  function setFilter<K extends keyof JobSearchRequest>(key: K, value: JobSearchRequest[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const [jobs, setJobs] = useState<Job[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [selected, setSelected] = useState<Job | null>(null)
  const [fit, setFit] = useState<FitAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [fitError, setFitError] = useState('')

  // Key of the analysis the panel is waiting for. A response for any other key --
  // another job, or the same job with older content or an older profile -- is stale
  // and ignored.
  const pendingKey = useRef<string | null>(null)

  // Finished analyses, keyed by the exact request sent (the whole job + profile). Each
  // live analysis is a rate-limited Aivana call (20/min), so re-opening a job reuses
  // its result; if anything sent would differ -- an edited profile, or a job whose
  // title/description changed under the same id -- the key differs and the job is
  // analyzed again. Failures aren't stored, so clicking again retries.
  const analyses = useRef(new Map<string, FitAnalysisResult>())
  // Requests still running, by the same key: clicking a job again while it is being
  // analyzed joins that request instead of starting (and paying for) another.
  const inFlight = useRef(new Map<string, Promise<FitAnalysisResult>>())

  async function analyze(job: Job) {
    setSelected(job)
    setFitError('')

    // Read at call time, so edits saved on the Profile page apply to the next analysis.
    const request = { job, user_profile: toUserProfile(loadCareerProfile()) }
    const key = JSON.stringify(request)
    pendingKey.current = key

    const cached = analyses.current.get(key)
    if (cached) {
      setFit(cached)
      setAnalyzing(false)
      return
    }

    setFit(null)
    setAnalyzing(true)
    let running = inFlight.current.get(key)
    if (!running) {
      running = api.fitAnalysis(request)
      inFlight.current.set(key, running)
      running
        .then((result) => analyses.current.set(key, result), () => {}) // failures aren't stored
        .finally(() => inFlight.current.delete(key))
    }
    try {
      const result = await running
      if (pendingKey.current === key) setFit(result)
    } catch (e) {
      if (pendingKey.current === key) setFitError(`Couldn't analyze this job: ${String(e)}`)
    } finally {
      if (pendingKey.current === key) setAnalyzing(false)
    }
  }

  async function search() {
    if (filters.salary_min !== null && filters.salary_max !== null && filters.salary_min > filters.salary_max) {
      setSearchError('Minimum salary can’t be higher than maximum salary.')
      return
    }

    pendingKey.current = null
    setSearchError('')
    setSelected(null)
    setFit(null)
    setFitError('')
    setAnalyzing(false)
    setSearching(true)
    try {
      const results = await api.searchJobs(filters)
      setJobs(results)
      setSearched(true)
      // Open the top result right away, like the mockup.
      if (results.length > 0) void analyze(results[0])
    } catch (e) {
      setJobs([])
      setSearchError(`Search failed: ${String(e)}`)
    } finally {
      setSearching(false)
    }
  }

  return {
    filters,
    setFilter,
    jobs,
    searched,
    searching,
    searchError,
    selected,
    fit,
    analyzing,
    fitError,
    search,
    analyze,
  }
}

export type JobSearchState = ReturnType<typeof useJobSearch>
