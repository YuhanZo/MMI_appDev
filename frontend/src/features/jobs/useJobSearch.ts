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

  // Id of the job whose analysis is in flight. If the user clicks another card
  // before a slow response comes back, the stale response is ignored.
  const pendingId = useRef<string | null>(null)

  async function analyze(job: Job) {
    pendingId.current = job.id
    setSelected(job)
    setFit(null)
    setFitError('')
    setAnalyzing(true)
    try {
      // Read at call time, so edits saved on the Profile page apply to the next analysis.
      const result = await api.fitAnalysis({ job, user_profile: toUserProfile(loadCareerProfile()) })
      if (pendingId.current === job.id) setFit(result)
    } catch (e) {
      if (pendingId.current === job.id) setFitError(`Couldn't analyze this job: ${String(e)}`)
    } finally {
      if (pendingId.current === job.id) setAnalyzing(false)
    }
  }

  async function search() {
    if (filters.salary_min !== null && filters.salary_max !== null && filters.salary_min > filters.salary_max) {
      setSearchError('Minimum salary can’t be higher than maximum salary.')
      return
    }

    pendingId.current = null
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
