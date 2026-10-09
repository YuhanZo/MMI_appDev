import { useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import * as api from './api'
import InterviewWorkspace, {
  type InterviewLaunchRequest,
} from './features/interview/InterviewWorkspace'
import ProfileView from './features/profile/ProfileView'
import { Icon, type IconName } from './icons'
import type {
  EmploymentType,
  ExperienceLevel,
  FitAnalysisResult,
  InterviewMode,
  Job,
  JobSearchRequest,
  WorkArrangement,
} from './types'

const DEMO_PROFILE = {
  skills: ['Python', 'Java', 'React'],
  education: 'BS Computer Science',
  experience: 'Backend and web development project experience.',
}

// Display-only user info. Kept separate from DEMO_PROFILE because DEMO_PROFILE
// is sent to the API and must match the shared data format.
const DEMO_USER = { name: 'Demo User', initials: 'DU' }

type View = 'home' | 'jobs' | 'behavioral' | 'technical' | 'profile'

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'sparkle' },
  { view: 'jobs', label: 'Job Search', icon: 'work' },
  { view: 'behavioral', label: 'Behavioral Interview', icon: 'mic' },
  { view: 'technical', label: 'Technical Interview', icon: 'search' },
]

const HOME_OPTIONS: { view: View; title: string; description: string; icon: IconName }[] = [
  {
    view: 'jobs',
    title: 'Job Search',
    description: 'Find real job opportunities and get AI-powered fit analysis.',
    icon: 'work',
  },
  {
    view: 'behavioral',
    title: 'Behavioral Interview',
    description: 'Practice common behavioral questions and get feedback on your answers.',
    icon: 'mic',
  },
  {
    view: 'technical',
    title: 'Technical Interview',
    description: 'Work through technical questions and sharpen your problem-solving.',
    icon: 'search',
  },
]

// Used by JobSearchView; the view stays mounted when hidden, so results survive switching views.
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

function HomeView({ onSelect }: { onSelect: (view: View) => void }) {
  return (
    <>
      <h1>What would you like to work on?</h1>
      <div className="home-grid">
        {HOME_OPTIONS.map((o) => (
          <button key={o.view} type="button" className="home-card" onClick={() => onSelect(o.view)}>
            <span className="home-card-icon">
              <Icon name={o.icon} />
            </span>
            <span className="home-card-title">{o.title}</span>
            <span className="home-card-desc">{o.description}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function toNumberOrNull(value: string): number | null {
  return value === '' ? null : Number(value)
}

function JobSearchView({ onPracticeInterview }: { onPracticeInterview: () => void }) {
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

function ProfileMenu({ onOpenProfile }: { onOpenProfile: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="profile" ref={ref}>
      <button
        type="button"
        className="profile-btn"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar">{DEMO_USER.initials}</span>
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-header">
            <span className="avatar">{DEMO_USER.initials}</span>
            <span className="profile-menu-name">{DEMO_USER.name}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenProfile()
            }}
          >
            My Profile
          </button>
          <button type="button" role="menuitem" disabled title="Sign-in is not built yet">
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [status, setStatus] = useState('checking...')
  const [interviewLaunch, setInterviewLaunch] = useState<
    (InterviewLaunchRequest & { mode: InterviewMode }) | null
  >(null)
  const launchNonce = useRef(0)

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`${h.status} (db: ${h.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  function launchOtherInterview(mode: InterviewMode, company: string, position: string) {
    launchNonce.current += 1
    setInterviewLaunch({ mode, company, position, nonce: launchNonce.current })
    setView(mode)
  }

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

        <ProfileMenu onOpenProfile={() => setView('profile')} />
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

      {/* All views stay mounted (just hidden) so switching keeps their state. */}
      <main className="panel">
        <section hidden={view !== 'home'}>
          <HomeView onSelect={setView} />
        </section>
        <section hidden={view !== 'jobs'}>
          <JobSearchView onPracticeInterview={() => setView('behavioral')} />
        </section>
        <section hidden={view !== 'behavioral'}>
          <InterviewWorkspace
            mode="behavioral"
            launchRequest={interviewLaunch?.mode === 'behavioral' ? interviewLaunch : null}
            onTryOtherMode={launchOtherInterview}
          />
        </section>
        <section hidden={view !== 'technical'}>
          <InterviewWorkspace
            mode="technical"
            launchRequest={interviewLaunch?.mode === 'technical' ? interviewLaunch : null}
            onTryOtherMode={launchOtherInterview}
          />
        </section>
        <section hidden={view !== 'profile'}>
          <ProfileView />
        </section>
      </main>
    </div>
  )
}
