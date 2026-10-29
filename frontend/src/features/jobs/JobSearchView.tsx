import { type FormEvent } from 'react'
import { Icon } from '../../icons'
import type { EmploymentType, ExperienceLevel, Job, WorkArrangement } from '../../types'
import CompanyLogo from './CompanyLogo'
import FitPanel from './FitPanel'
import { useJobSearch } from './useJobSearch'

const WORK_ARRANGEMENTS: { value: WorkArrangement; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
]

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
]

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

function toNumberOrNull(value: string): number | null {
  return value === '' ? null : Number(value)
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
              value={f.role}
              onChange={(e) => js.setFilter('role', e.target.value)}
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
              value={f.work_arrangement}
              onChange={(e) => js.setFilter('work_arrangement', e.target.value as WorkArrangement)}
            >
              {WORK_ARRANGEMENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Experience level</span>
            <select
              value={f.experience_level}
              onChange={(e) => js.setFilter('experience_level', e.target.value as ExperienceLevel)}
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
              value={f.employment_type}
              onChange={(e) => js.setFilter('employment_type', e.target.value as EmploymentType)}
            >
              {EMPLOYMENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Industry (optional)</span>
            <input
              value={f.industry}
              onChange={(e) => js.setFilter('industry', e.target.value)}
              placeholder="e.g. Healthcare"
            />
          </label>

          <fieldset className="field salary">
            <legend className="field-label">Yearly salary, USD (optional)</legend>
            <div className="salary-inputs">
              <input
                type="number"
                min={0}
                step={1000}
                aria-label="Minimum salary"
                placeholder="Min"
                value={f.salary_min ?? ''}
                onChange={(e) => js.setFilter('salary_min', toNumberOrNull(e.target.value))}
              />
              <span aria-hidden="true">to</span>
              <input
                type="number"
                min={0}
                step={1000}
                aria-label="Maximum salary"
                placeholder="Max"
                value={f.salary_max ?? ''}
                onChange={(e) => js.setFilter('salary_max', toNumberOrNull(e.target.value))}
              />
            </div>
          </fieldset>
        </div>
        <p className="filter-note">
          Salary filtering only applies to postings that list pay, so jobs without a listed salary still appear.
        </p>
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
