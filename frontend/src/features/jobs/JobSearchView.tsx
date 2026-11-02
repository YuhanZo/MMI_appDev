import { useEffect, useRef } from 'react'
import { Icon } from '../../icons'
import { type ExperienceLevel, type Job, type JobType, MAX_JOB_FUNCTIONS, type WorkModel } from '../../types'
import CompanyLogo from './CompanyLogo'
import FilterChip, { CheckboxList, TagInput } from './FilterChip'
import FitPanel from './FitPanel'
import './jobs.css'
import { useJobSearch } from './useJobSearch'

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'intern', label: 'Intern/New Grad' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior Level' },
  { value: 'lead', label: 'Lead/Staff' },
  { value: 'director', label: 'Director/Executive' },
]

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
]

const WORK_MODELS: { value: WorkModel; label: string }[] = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

function labelsOf<V extends string>(options: { value: V; label: string }[], selected: V[]): string[] {
  return options.filter((o) => selected.includes(o.value)).map((o) => o.label)
}

export default function JobSearchView({
  active,
  onPracticeInterview,
}: {
  active: boolean
  onPracticeInterview: (job: Job) => void
}) {
  const js = useJobSearch()
  const f = js.filters

  // Search with the default filters the first time the view is shown; after that,
  // each confirmed filter change searches again.
  const started = useRef(false)
  useEffect(() => {
    if (active && !started.current) {
      started.current = true
      void js.search()
    }
  }, [active, js])

  return (
    <>
      <div className="page-head">
        <h1>Job Search</h1>
        <p className="page-sub">Find openings for a role, then see how well your profile fits each one.</p>
      </div>

      <div className="chip-row" role="search" aria-label="Job filters">
        <FilterChip
          heading="Location"
          value={f.location}
          labels={f.location.trim() ? [f.location.trim()] : []}
          disabled={js.searching}
          onConfirm={(v) => js.applyFilter('location', v.trim())}
        >
          {(draft, setDraft) => (
            <span className="input-icon">
              <Icon name="place" size={18} />
              <input
                className="chip-input"
                aria-label="City, state or country"
                placeholder="e.g. Columbus, OH"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </span>
          )}
        </FilterChip>

        <FilterChip
          heading="Job Function"
          value={f.job_functions}
          labels={f.job_functions}
          disabled={js.searching}
          canConfirm={(draft) => draft.length > 0}
          onConfirm={(v) => js.applyFilter('job_functions', v)}
        >
          {(draft, setDraft) => (
            <TagInput
              tags={draft}
              max={MAX_JOB_FUNCTIONS}
              placeholder="Enter a job function"
              onChange={setDraft}
            />
          )}
        </FilterChip>

        <FilterChip
          heading="Experience Level"
          value={f.experience_levels}
          labels={labelsOf(EXPERIENCE_LEVELS, f.experience_levels)}
          disabled={js.searching}
          onConfirm={(v) => js.applyFilter('experience_levels', v)}
        >
          {(draft, setDraft) => <CheckboxList options={EXPERIENCE_LEVELS} selected={draft} onChange={setDraft} />}
        </FilterChip>

        <FilterChip
          heading="Job Type"
          value={f.job_types}
          labels={labelsOf(JOB_TYPES, f.job_types)}
          disabled={js.searching}
          onConfirm={(v) => js.applyFilter('job_types', v)}
        >
          {(draft, setDraft) => <CheckboxList options={JOB_TYPES} selected={draft} onChange={setDraft} />}
        </FilterChip>

        <FilterChip
          heading="Work Model"
          value={f.work_models}
          labels={labelsOf(WORK_MODELS, f.work_models)}
          disabled={js.searching}
          onConfirm={(v) => js.applyFilter('work_models', v)}
        >
          {(draft, setDraft) => <CheckboxList options={WORK_MODELS} selected={draft} onChange={setDraft} />}
        </FilterChip>
      </div>

      {js.searchError && (
        <p className="error" role="alert">
          {js.searchError}
        </p>
      )}

      {js.searching ? (
        <p className="empty">Searching…</p>
      ) : !js.searched ? (
        !js.searchError && <p className="empty">Choose your filters to see openings.</p>
      ) : js.jobs.length === 0 ? (
        <p className="empty">No jobs matched these filters. Try another job function, fewer filters, or another location.</p>
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
