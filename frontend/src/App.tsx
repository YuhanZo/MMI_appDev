import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import * as api from './api'
import { Icon, type IconName } from './icons'
import type {
  EmploymentType,
  ExperienceLevel,
  FitAnalysisResult,
  InterviewFeedback,
  InterviewQuestion,
  Job,
  JobSearchRequest,
  WorkArrangement,
} from './types'

// Placeholder until profiles are stored per user.
const DEMO_PROFILE = {
  skills: ['Python', 'Java', 'React'],
  education: 'BS Computer Science',
  experience: 'Backend and web development project experience.',
}

type View = 'jobs' | 'interview'

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'jobs', label: 'Job Search', icon: 'work' },
  { view: 'interview', label: 'Mock Interview', icon: 'mic' },
]

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

// Lives in App (not the Job Search view) so results survive switching views.
function useJobSearch() {
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
      const result = await api.fitAnalysis({ job, user_profile: DEMO_PROFILE })
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

type JobSearchState = ReturnType<typeof useJobSearch>

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="section">
      <summary>
        <span className="chevron">
          <Icon name="expand" />
        </span>
        {title}
      </summary>
      {children}
    </details>
  )
}

function toNumberOrNull(value: string): number | null {
  return value === '' ? null : Number(value)
}

function JobSearchView({ js, onPracticeInterview }: { js: JobSearchState; onPracticeInterview: () => void }) {
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

// Shows the company's logo, or its first letter if there's no logo or the image fails to load.
function CompanyLogo({ job }: { job: Job }) {
  const [failed, setFailed] = useState(false)

  if (job.company_logo && !failed) {
    return (
      <img
        className="job-logo job-logo-img"
        src={job.company_logo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className="job-logo" aria-hidden="true">
      {job.company.charAt(0)}
    </span>
  )
}

function FitPanel({ js, onPracticeInterview }: { js: JobSearchState; onPracticeInterview: () => void }) {
  const { selected, fit, analyzing, fitError } = js

  if (!selected) {
    return (
      <aside className="fit-panel" aria-label="Fit analysis">
        <p className="empty">Select a job to see how well you fit.</p>
      </aside>
    )
  }

  return (
    <aside className="fit-panel" aria-label="Fit analysis" aria-busy={analyzing}>
      <h2 className="fit-title">{selected.title}</h2>
      <p className="fit-meta">
        {selected.company}
        <span className="job-location">
          <Icon name="place" size={14} />
          {selected.location}
        </span>
      </p>

      {analyzing && <p className="empty">Analyzing your fit…</p>}

      {fitError && (
        <p className="error" role="alert">
          {fitError}
        </p>
      )}

      {fit && (
        <>
          <p className="fit-for">
            <Icon name="sparkle" size={18} />
            Fit analysis
          </p>
          <p className="fit-summary">{fit.summary}</p>
          <div className="fit-sections">
            <FitList title="Strengths" tone="good" items={fit.strengths} />
            <FitList title="Gaps" tone="warn" items={fit.gaps} />
            <FitList title="Recommendations" items={fit.recommendations} />
          </div>

          <div className="next-steps">
            <button type="button" className="btn-filled" onClick={onPracticeInterview}>
              <Icon name="mic" size={18} />
              Practice interview
            </button>
            {selected.url && (
              <a className="btn-outline" href={selected.url} target="_blank" rel="noreferrer">
                View posting
              </a>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

function FitList({ title, items, tone }: { title: string; items: string[]; tone?: 'good' | 'warn' }) {
  return (
    <div className={`tile${tone ? ` tile-${tone}` : ''}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function MockInterviewView() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  // Keyed by question id so each question keeps its own answer and feedback.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, InterviewFeedback>>({})

  useEffect(() => {
    api.getQuestions().then(setQuestions).catch(() => setQuestions([]))
  }, [])

  async function onSubmit(questionId: string) {
    const fb = await api.getFeedback({ question_id: questionId, answer: answers[questionId] ?? '' })
    setFeedback((prev) => ({ ...prev, [questionId]: fb }))
  }

  return (
    <>
      <h1>Mock Interview</h1>
      <Section title="Questions">
        {questions.map((q) => {
          const fb = feedback[q.id]
          return (
            <div key={q.id} className="tile question">
              <span className="badge">{q.type}</span>
              <p className="question-text">{q.question}</p>
              <textarea
                aria-label="Your answer"
                placeholder="Type your answer..."
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                rows={3}
              />
              <button className="btn-filled" onClick={() => onSubmit(q.id)}>
                Submit answer
              </button>
              {fb && (
                <div className="feedback">
                  <p className="fit-for">
                    <Icon name="sparkle" size={18} />
                    Feedback
                  </p>
                  <p>{fb.summary}</p>
                  <p>
                    <b>Strengths:</b> {fb.strengths.join(', ')}
                  </p>
                  <p>
                    <b>Improve:</b> {fb.improvements.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </Section>
    </>
  )
}

export default function App() {
  const [view, setView] = useState<View>('jobs')
  const [status, setStatus] = useState('checking...')
  const js = useJobSearch()

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`${h.status} (db: ${h.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  const health = status.startsWith('ok') ? 'ok' : status === 'backend unreachable' ? 'down' : 'checking'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="work" size={22} />
          </span>
          <span className="brand-name">Career Assistant</span>
        </div>

        <div className={`status status-${health}`} title={`Backend: ${status}`}>
          <span className="dot" />
          <span className="status-label">Backend: {status}</span>
        </div>
      </header>

      <nav className="sidebar" aria-label="Sections">
        {NAV.map((n) => (
          <button
            key={n.view}
            type="button"
            className={`nav-item${view === n.view ? ' active' : ''}`}
            aria-current={view === n.view ? 'page' : undefined}
            onClick={() => setView(n.view)}
          >
            <Icon name={n.icon} />
            {n.label}
          </button>
        ))}
      </nav>

      {/* Both views stay mounted (just hidden) so switching keeps their state. */}
      <main className="panel">
        <section hidden={view !== 'jobs'}>
          <JobSearchView js={js} onPracticeInterview={() => setView('interview')} />
        </section>
        <section hidden={view !== 'interview'}>
          <MockInterviewView />
        </section>
      </main>
    </div>
  )
}