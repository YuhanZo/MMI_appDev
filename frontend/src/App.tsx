import { useEffect, useRef, useState } from 'react'
import './App.css'
import * as api from './api'
import BenchmarkView from './features/benchmark/BenchmarkView'
import InterviewWorkspace, {
  type InterviewLaunchRequest,
} from './features/interview/InterviewWorkspace'
import JobSearchView from './features/jobs/JobSearchView'
import { loadSavedJobs, saveSavedJobs, toggleSaved } from './features/jobs/savedJobs'
import ProfilePage from './features/profile/ProfilePage'
import ScenarioTestView from './features/scenarios/ScenarioTestView'
import { Icon, type IconName } from './icons'
import TypingTitle from './TypingTitle'
import type { InterviewMode, Job } from './types'

// Display-only user info for the account menu (no sign-in yet)
const DEMO_USER = { name: 'Demo User', initials: 'DU' }

type View = 'home' | 'jobs' | 'behavioral' | 'technical' | 'benchmark' | 'scenarios' | 'profile'

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'sparkle' },
  { view: 'jobs', label: 'Job Search', icon: 'work' },
  { view: 'behavioral', label: 'Behavioral Interview', icon: 'mic' },
  { view: 'technical', label: 'Technical Interview', icon: 'search' },
  { view: 'benchmark', label: 'Benchmark', icon: 'chart' },
  { view: 'scenarios', label: 'Scenario Test', icon: 'flask' },
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

function HomeView({ onSelect }: { onSelect: (view: View) => void }) {
  return (
    <>
      <TypingTitle className="home-title" text="What would you like to work on?" />
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

function ProfileMenu({
  onOpenProfile,
  savedCount,
  onOpenSaved,
}: {
  onOpenProfile: () => void
  savedCount: number
  onOpenSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenSaved()
            }}
          >
            Saved jobs ({savedCount})
          </button>
          <button type="button" role="menuitem" disabled title="Sign-in is not built yet">
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

type Theme = 'light' | 'dark'
const THEME_KEY = 'theme'

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Until the user picks a theme, follow the operating system's setting as it changes
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = (e: MediaQueryListEvent) => {
      if (!storedTheme()) setTheme(e.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage can be blocked, the theme still changes for this visit
    }
  }

  return { theme, toggle }
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [profileVisit, setProfileVisit] = useState(0) // bumped each time My Profile opens, so it starts at the overview with fresh data
  // Saved jobs live here so the account menu can count them and open the list.
  const [savedJobs, setSavedJobs] = useState<Job[]>(loadSavedJobs)
  const [showSaved, setShowSaved] = useState(false)
  const [savedRequest, setSavedRequest] = useState(0) // bumped each time the menu opens the list

  function toggleSavedJob(job: Job) {
    const next = toggleSaved(savedJobs, job)
    setSavedJobs(next)
    saveSavedJobs(next)
  }
  const [status, setStatus] = useState('checking...')
  const [interviewLaunch, setInterviewLaunch] = useState<
    (InterviewLaunchRequest & { mode: InterviewMode }) | null
  >(null)
  const launchNonce = useRef(0)
  // The job an interview was started from, if any, so the interview can link back to it.
  const [interviewJob, setInterviewJob] = useState<{ mode: InterviewMode; title: string } | null>(null)
  const [interviewReset, setInterviewReset] = useState({ behavioral: 0, technical: 0 })
  const { theme, toggle } = useTheme()

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`${h.status} (db: ${h.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  // Opens an interview straight at question one for a company and position, from a
  // finished interview ("try the other mode") or from a job's page.
  function launchInterview(mode: InterviewMode, company: string, position: string, jobTitle: string | null = null) {
    launchNonce.current += 1
    setInterviewLaunch({ mode, company, position, nonce: launchNonce.current })
    setInterviewJob(jobTitle ? { mode, title: jobTitle } : null)
    setView(mode)
  }

  // Opening a view from the sidebar or Home. An interview started from a job goes back
  // to an empty setup, so it asks for a company instead of reusing that job's; one the
  // user started here keeps its progress.
  function openView(next: View) {
    if ((next === 'behavioral' || next === 'technical') && interviewJob?.mode === next) {
      setInterviewReset((r) => ({ ...r, [next]: r[next] + 1 }))
      setInterviewJob(null)
    }
    setView(next)
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

          <div className="topbar-actions">
            <div className={`status status-${health}`} title={`Backend: ${status}`}>
              <span className="dot" />
              <span className="status-label">Backend: {status}</span>
            </div>

            <button
            type="button"
            className="theme-toggle"
            aria-pressed={theme === 'dark'}
            onClick={toggle}
            >
              <Icon name={theme === 'dark' ? 'dark' : 'light'} size={18} />
              <span className="theme-toggle-label">Dark mode</span>
            </button>

            <ProfileMenu
              onOpenProfile={() => {
                setProfileVisit((n) => n + 1)
                setView('profile')
              }}
              savedCount={savedJobs.length}
              onOpenSaved={() => {
                setShowSaved(true)
                setSavedRequest((n) => n + 1)
                setView('jobs')
              }}
            />
          </div>
      </header>

      <nav className="sidebar" aria-label="Sections">
        {NAV.map((n) => (
          <button
            key={n.view}
            type="button"
            className={`nav-item${view === n.view ? ' active' : ''}`}
            aria-current={view === n.view ? 'page' : undefined}
            onClick={() => openView(n.view)}
          >
            <Icon name={n.icon} />
            {n.label}
          </button>
        ))}
      </nav>

      { }
      <main className="panel">
        <section hidden={view !== 'home'}>
          <HomeView onSelect={openView} />
        </section>
        <section hidden={view !== 'jobs'}>
          <JobSearchView
            saved={savedJobs}
            onToggleSave={toggleSavedJob}
            showSaved={showSaved}
            savedRequest={savedRequest}
            onShowSaved={setShowSaved}
            onPracticeInterview={(job) => launchInterview('behavioral', job.company, job.title, job.title)}
          />
        </section>
        <section hidden={view !== 'behavioral'}>
          <InterviewWorkspace
            mode="behavioral"
            launchRequest={interviewLaunch?.mode === 'behavioral' ? interviewLaunch : null}
            resetRequest={interviewReset.behavioral}
            back={
              interviewJob?.mode === 'behavioral'
                ? { label: `Back to ${interviewJob.title}`, onClick: () => setView('jobs') }
                : null
            }
            onTryOtherMode={(m, company, position) => launchInterview(m, company, position, interviewJob?.title ?? null)}
          />
        </section>
        <section hidden={view !== 'technical'}>
          <InterviewWorkspace
            mode="technical"
            launchRequest={interviewLaunch?.mode === 'technical' ? interviewLaunch : null}
            resetRequest={interviewReset.technical}
            back={
              interviewJob?.mode === 'technical'
                ? { label: `Back to ${interviewJob.title}`, onClick: () => setView('jobs') }
                : null
            }
            onTryOtherMode={(m, company, position) => launchInterview(m, company, position, interviewJob?.title ?? null)}
          />
        </section>
        <section hidden={view !== 'benchmark'}>
          <BenchmarkView />
        </section>
        <section hidden={view !== 'scenarios'}>
          <ScenarioTestView active={view === 'scenarios'} />
        </section>
        <section hidden={view !== 'profile'}>
          {view === 'profile' && <ProfilePage key={profileVisit} />}
        </section>
      </main>
    </div>
  )
}