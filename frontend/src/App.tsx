import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import * as api from './api'
import InterviewWorkspace, {
  type InterviewLaunchRequest,
} from './features/interview/InterviewWorkspace'
import ProfileView from './features/profile/ProfileView'
import { Icon, type IconName } from './icons'
import type { FitAnalysisResult, InterviewMode, Job } from './types'

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

function useJobSearch() {
  const [role, setRole] = useState('Software Engineer Intern')
  const [location, setLocation] = useState('Columbus, OH')
  const [remote, setRemote] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [fit, setFit] = useState<{ job: Job; result: FitAnalysisResult } | null>(null)
  const [error, setError] = useState('')
  // Live fit analysis takes 8-20 s; track which job is running so the button can say so.
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  async function search() {
    setError('')
    setFit(null)
    try {
      setJobs(await api.searchJobs({ role, location, remote }))
    } catch (e) {
      setError(String(e))
    }
  }

  async function analyze(job: Job) {
    setError('')
    setAnalyzingId(job.id)
    try {
      setFit({ job, result: await api.fitAnalysis({ job, user_profile: DEMO_PROFILE }) })
    } catch (e) {
      setError(String(e))
    } finally {
      setAnalyzingId(null)
    }
  }

  return { role, setRole, location, setLocation, remote, setRemote, jobs, fit, error, analyzingId, search, analyze }
}

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

function JobSearchView() {
  const js = useJobSearch()

  function onSearch(e: FormEvent) {
    e.preventDefault()
    js.search()
  }

  return (
    <>
      <h1>Welcome to Career Assistant</h1>

      {/* Job search lives here, not in the top bar: a top-bar box reads as site-wide search. */}
      <Section title="Search jobs">
        <form className="job-search" onSubmit={onSearch}>
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Role"
              value={js.role}
              onChange={(e) => js.setRole(e.target.value)}
              placeholder="Role, e.g. Software Engineer Intern"
            />
          </label>
          <div className="chips">
            <label className="chip chip-input">
              <Icon name="place" size={18} />
              <input aria-label="Location" value={js.location} onChange={(e) => js.setLocation(e.target.value)} />
            </label>
            <label className={`chip${js.remote ? ' chip-on' : ''}`}>
              <input
                className="visually-hidden"
                type="checkbox"
                checked={js.remote}
                onChange={(e) => js.setRemote(e.target.checked)}
              />
              {js.remote && <Icon name="check" size={18} />}
              Remote
            </label>
            <button type="submit" className="btn-filled">
              Search
            </button>
          </div>
        </form>
      </Section>

      {js.error && (
        <p className="error" role="alert">
          {js.error}
        </p>
      )}

      <Section title="Results">
        {js.jobs.length === 0 ? (
          <p className="empty">Search for a role above to see matching jobs.</p>
        ) : (
          <div className="table-wrap">
            <table className="file-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th className="col-location">Location</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {js.jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="cell-title">
                        <span className="file-icon">
                          <Icon name="work" size={18} />
                        </span>
                        <div>
                          <span className="job-title">{job.title}</span>
                          <span className="job-desc">{job.description}</span>
                        </div>
                      </div>
                    </td>
                    <td>{job.company}</td>
                    <td className="col-location">{job.location}</td>
                    <td className="cell-actions">
                      {/* One analysis at a time: each live run spends Aivana credits. */}
                      <button
                        className="btn-outline"
                        disabled={js.analyzingId !== null}
                        onClick={() => js.analyze(job)}
                      >
                        {js.analyzingId === job.id ? 'Analyzing…' : 'Analyze fit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {js.fit && (
        <Section title="Fit analysis">
          <div className="fit">
            <p className="fit-for">
              <Icon name="sparkle" size={18} />
              {js.fit.job.title} · {js.fit.job.company}
            </p>
            <p className="fit-summary">{js.fit.result.summary}</p>
            <div className="fit-grid">
              <FitList title="Strengths" items={js.fit.result.strengths} />
              <FitList title="Gaps" items={js.fit.result.gaps} />
              <FitList title="Recommendations" items={js.fit.result.recommendations} />
            </div>
          </div>
        </Section>
      )}
    </>
  )
}

function FitList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="tile">
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
          <JobSearchView />
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
