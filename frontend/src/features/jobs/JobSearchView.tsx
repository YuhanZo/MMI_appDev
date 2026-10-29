import { type FormEvent } from 'react'
import { Icon } from '../../icons'
import type { ExperienceLevel, Job, JobType, WorkModel } from '../../types'
import CompanyLogo from './CompanyLogo'
import FitPanel from './FitPanel'
import { useJobSearch } from './useJobSearch'

const WORK_MODELS: { value: WorkModel | 'any'; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
]

const EXPERIENCE_LEVELS: { value: ExperienceLevel | 'any'; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
]

const JOB_TYPES: { value: JobType | 'any'; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

// Each select picks one value; the request takes a list, where empty means any.
function toList<T extends string>(value: T | 'any'): T[] {
  return value === 'any' ? [] : [value]
}

export default function JobSearchView({ onPracticeInterview }: { onPracticeInterview: (job: Job) => void }) {
  const js = useJobSearch()
  const f = js.filters

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void js.search()
  }

  return (
    <>
      <div className="page-head">
        <h1>Job Search</h1>
        <p className="page-sub">Find openings for a role, then see how well your profile fits each one.</p>
      </div>

      <form className="search-card" role="search" onSubmit={onSubmit}>
        <div className="search-row">
          <label className="field">
            <span className="field-label">Role</span>
            <input
              value={f.job_functions[0] ?? ''}
              onChange={(e) => js.setFilter('job_functions', [e.target.value])}
              placeholder="e.g. Frontend Developer"
            />
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <span className="input-icon">
              <Icon name="place" size={18} />
              <input
                value={f.location}
                onChange={(e) => js.setFilter('location', e.target.value)}
                placeholder="e.g. Columbus, OH"
              />
            </span>
          </label>

          <button type="submit" className="btn-filled btn-search" disabled={js.searching}>
            <Icon name="search" size={18} />
            {js.searching ? 'Searching…' : 'Search jobs'}
          </button>
        </div>

        <div className="filter-row">
          <label className="field">
            <span className="field-label">Work arrangement</span>
            <select
              value={f.work_models[0] ?? 'any'}
              onChange={(e) => js.setFilter('work_models', toList(e.target.value as WorkModel | 'any'))}
            >
              {WORK_MODELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Experience level</span>
            <select
              value={f.experience_levels[0] ?? 'any'}
              onChange={(e) => js.setFilter('experience_levels', toList(e.target.value as ExperienceLevel | 'any'))}
            >
              {EXPERIENCE_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Employment type</span>
            <select
              value={f.job_types[0] ?? 'any'}
              onChange={(e) => js.setFilter('job_types', toList(e.target.value as JobType | 'any'))}
            >
              {JOB_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {js.searchError && (
        <p className="error" role="alert">
          {js.searchError}
        </p>
      )}

      {!js.searched ? (
        !js.searchError && <p className="empty">Enter a role and select Search jobs to see openings.</p>
      ) : js.jobs.length === 0 ? (
        <p className="empty">No jobs matched this search. Try a broader role or another location.</p>
      ) : (
        <>
          <p className="result-count">
            {js.jobs.length} {js.jobs.length === 1 ? 'job' : 'jobs'} found
          </p>
          <div className="results">
            <ul className="job-list" aria-label="Job results">
              {js.jobs.map((job) => {
                const isSelected = js.selected?.id === job.id
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      className={`job-card${isSelected ? ' selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => void js.analyze(job)}
                    >
                      <CompanyLogo job={job} />
                      <span className="job-card-body">
                        <span className="job-title">{job.title}</span>
                        <span className="job-company">{job.company}</span>
                        <span className="job-location">
                          <Icon name="place" size={14} />
                          {job.location}
                        </span>
                        <span className="job-desc">{job.description}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <FitPanel js={js} onPracticeInterview={onPracticeInterview} />
          </div>
        </>
      )}
    </>
  )
}
