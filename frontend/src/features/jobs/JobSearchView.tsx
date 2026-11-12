import { useEffect, useRef } from 'react'
import { Icon } from '../../icons'
import { type ExperienceLevel, type Job, type JobType, MAX_JOB_DESCRIPTION, type WorkModel } from '../../types'
import CompanyLogo from './CompanyLogo'
import FilterChip, { CheckboxList } from './FilterChip'
import JobDetail from './JobDetail'
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

/** "Full-time · Onsite · $90K–$116K a year", from whatever the posting says. */
function cardFacts(job: Job): string {
  const model = WORK_MODELS.find((m) => m.value === job.work_model)?.label
  return [job.employment_type, model, job.salary].filter(Boolean).join(' · ')
}

export default function JobSearchView({
  onPracticeInterview,
  saved,
  onToggleSave,
  showSaved,
  savedRequest,
  onShowSaved,
}: {
  onPracticeInterview: (job: Job) => void
  saved: Job[]
  onToggleSave: (job: Job) => void
  showSaved: boolean // the saved list (opened from the account menu) instead of search
  savedRequest: number // changes each time the account menu opens the saved list
  onShowSaved: (show: boolean) => void
}) {
  const js = useJobSearch()
  const f = js.filters

  // Opening the saved list from the account menu leaves any open job page, even when
  // the saved list was already showing.
  const { close } = js
  const lastRequest = useRef(savedRequest)
  useEffect(() => {
    if (savedRequest !== lastRequest.current) {
      lastRequest.current = savedRequest
      close()
    }
  }, [savedRequest, close])

  // A job's page replaces the list; Back returns to the list it was opened from.
  if (js.selected) {
    const count = showSaved ? saved.length : js.jobs.length
    return (
      <JobDetail
        job={js.selected}
        js={js}
        backLabel={showSaved ? 'Back to saved jobs' : `Back to ${count} ${count === 1 ? 'result' : 'results'}`}
        onBack={js.close}
        saved={saved.some((j) => j.id === js.selected!.id)}
        onToggleSave={() => onToggleSave(js.selected!)}
        onPracticeInterview={onPracticeInterview}
      />
    )
  }

  if (showSaved) {
    return (
      <>
        <div className="page-head">
          <h1>Saved jobs</h1>
        </div>
        <button type="button" className="job-back" onClick={() => onShowSaved(false)}>
          <Icon name="back" size={18} />
          Back to search
        </button>
        {saved.length === 0 ? (
          <p className="empty">No saved jobs yet. Open a job and press Save to keep it here.</p>
        ) : (
          <JobList label="Saved jobs" jobs={saved} count={`${saved.length} saved ${saved.length === 1 ? 'job' : 'jobs'}`} onOpen={js.open} />
        )}
      </>
    )
  }

  // The description is the search text; the chips narrow it down. Nothing is searched
  // until Search (or Enter in the description) is pressed.
  return (
    <>
      <div className="page-head">
        <h1>Job Search</h1>
      </div>

      <form
        className="job-describe"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          void js.search()
        }}
      >
        <Icon name="search" size={20} />
        <input
          aria-label="Describe a job you want"
          placeholder="Describe a job you want"
          value={js.description}
          maxLength={MAX_JOB_DESCRIPTION}
          disabled={js.searching}
          onChange={(e) => js.setDescription(e.target.value)}
        />
      </form>

      <div className="chip-row" aria-label="Job filters">
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

        <button
          type="button"
          className="btn-filled"
          disabled={!js.canSearch || js.searching}
          title={js.canSearch ? undefined : 'Describe a job first'}
          onClick={() => void js.search()}
        >
          <Icon name="search" size={18} />
          {js.searching ? 'Searching…' : 'Search'}
        </button>

      </div>

      {js.searchError && (
        <p className="error" role="alert">
          {js.searchError}
        </p>
      )}

      {js.searching ? (
        <p className="empty">Searching…</p>
      ) : !js.searched ? null : js.jobs.length === 0 ? (
        <p className="empty">No jobs matched. Try describing the job differently, fewer filters, or another location.</p>
      ) : (
        <JobList
          label="Job results"
          jobs={js.jobs}
          count={`${js.jobs.length} ${js.jobs.length === 1 ? 'job' : 'jobs'} found`}
          onOpen={js.open}
        />
      )}
    </>
  )
}

function JobList({ label, jobs, count, onOpen }: { label: string; jobs: Job[]; count: string; onOpen: (job: Job) => void }) {
  return (
    <>
      <p className="result-count">{count}</p>
      <ul className="job-list" aria-label={label}>
        {jobs.map((job) => (
          <li key={job.id}>
            <button type="button" className="job-card" onClick={() => onOpen(job)}>
              <CompanyLogo job={job} />
              <span className="job-card-body">
                <span className="job-title">{job.title}</span>
                <span className="job-company">{job.company}</span>
                <span className="job-location">
                  <Icon name="place" size={14} />
                  {job.location}
                </span>
                {cardFacts(job) && <span className="job-facts">{cardFacts(job)}</span>}
                <span className="job-desc">{job.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
