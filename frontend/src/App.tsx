import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import * as api from './api'
import { Icon, type IconName } from './icons'
import type { FitAnalysisResult, InterviewFeedback, InterviewQuestion, Job } from './types'

const DEMO_PROFILE = {
  skills: ['Python', 'Java', 'React'],
  education: 'BS Computer Science',
  experience: 'Backend and web development project experience.',
}

// Display-only user info. Kept separate from DEMO_PROFILE because DEMO_PROFILE
// is sent to the API and must match the shared data format.
const DEMO_USER = { name: 'Demo User', initials: 'DU' }

type View = 'home' | 'jobs' | 'behavioral' | 'technical' | 'profile'
type InterviewKind = 'behavioral' | 'technical'

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

// Lives in App (not the Job Search view) because the search box is in the top bar.
function useJobSearch() {
  const [role, setRole] = useState('Software Engineer Intern')
  const [location, setLocation] = useState('Columbus, OH')
  const [remote, setRemote] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [fit, setFit] = useState<{ job: Job; result: FitAnalysisResult } | null>(null)
  const [error, setError] = useState('')

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
    try {
      setFit({ job, result: await api.fitAnalysis({ job, user_profile: DEMO_PROFILE }) })
    } catch (e) {
      setError(String(e))
    }
  }

  return { role, setRole, location, setLocation, remote, setRemote, jobs, fit, error, search, analyze }
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

function JobSearchView({ js }: { js: JobSearchState }) {
  return (
    <>
      <h1>Welcome to Career Assistant</h1>

      <Section title="Filters">
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
        </div>
      </Section>

      {js.error && (
        <p className="error" role="alert">
          {js.error}
        </p>
      )}

      <Section title="Results">
        {js.jobs.length === 0 ? (
          <p className="empty">Search for a role in the bar above to see matching jobs.</p>
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
                      <button className="btn-outline" onClick={() => js.analyze(job)}>
                        Analyze fit
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

function MockInterviewView({ kind, title }: { kind: InterviewKind; title: string }) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  // Keyed by question id so each question keeps its own answer and feedback.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, InterviewFeedback>>({})

  useEffect(() => {
    api.getQuestions().then(setQuestions).catch(() => setQuestions([]))
  }, [])

  // Only show questions of this view's type (behavioral or technical).
  const visible = questions.filter((q) => String(q.type).toLowerCase().includes(kind))

  async function onSubmit(questionId: string) {
    const fb = await api.getFeedback({ question_id: questionId, answer: answers[questionId] ?? '' })
    setFeedback((prev) => ({ ...prev, [questionId]: fb }))
  }

  return (
    <>
      <h1>{title}</h1>
      <Section title="Questions">
        {visible.length === 0 && <p className="empty">No {kind} questions available yet.</p>}
        {visible.map((q) => {
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

function ProfileView() {
  return (
    <>
      <h1>My Profile</h1>
      <Section title="About">
        <div className="tile profile-card">
          <span className="avatar avatar-lg">{DEMO_USER.initials}</span>
          <div>
            <p className="profile-name">{DEMO_USER.name}</p>
            <p>{DEMO_PROFILE.education}</p>
          </div>
        </div>
      </Section>
      <Section title="Skills">
        <div className="chips">
          {DEMO_PROFILE.skills.map((skill) => (
            <span key={skill} className="chip">
              {skill}
            </span>
          ))}
        </div>
      </Section>
      <Section title="Experience">
        <p>{DEMO_PROFILE.experience}</p>
      </Section>
    </>
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
  const js = useJobSearch()

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`${h.status} (db: ${h.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    setView('jobs')
    js.search()
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

        <form className="searchbar" role="search" onSubmit={onSearch}>
          <button type="submit" className="icon-btn" aria-label="Search">
            <Icon name="search" />
          </button>
          <input
            aria-label="Role"
            value={js.role}
            onChange={(e) => js.setRole(e.target.value)}
            placeholder="Search roles, e.g. Software Engineer Intern"
          />
        </form>

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
          <JobSearchView js={js} />
        </section>
        <section hidden={view !== 'behavioral'}>
          <MockInterviewView kind="behavioral" title="Behavioral Interview" />
        </section>
        <section hidden={view !== 'technical'}>
          <MockInterviewView kind="technical" title="Technical Interview" />
        </section>
        <section hidden={view !== 'profile'}>
          <ProfileView />
        </section>
      </main>
    </div>
  )
}