import { useEffect, useRef, useState } from 'react'
import './App.css'
import * as api from './api'
import InterviewWorkspace, {
  type InterviewLaunchRequest,
} from './features/interview/InterviewWorkspace'
import JobSearchView from './features/jobs/JobSearchView'
import ProfileView from './features/profile/ProfileView'
import { Icon, type IconName } from './icons'
import type { InterviewMode } from './types'

// Display-only user info for the account menu (no sign-in yet).
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

  // Opens an interview straight at question one for a company and position, from a
  // finished interview ("try the other mode") or from a job's fit panel.
  function launchInterview(mode: InterviewMode, company: string, position: string) {
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
          <JobSearchView onPracticeInterview={(job) => launchInterview('behavioral', job.company, job.title)} />
        </section>
        <section hidden={view !== 'behavioral'}>
          <InterviewWorkspace
            mode="behavioral"
            launchRequest={interviewLaunch?.mode === 'behavioral' ? interviewLaunch : null}
            onTryOtherMode={launchInterview}
          />
        </section>
        <section hidden={view !== 'technical'}>
          <InterviewWorkspace
            mode="technical"
            launchRequest={interviewLaunch?.mode === 'technical' ? interviewLaunch : null}
            onTryOtherMode={launchInterview}
          />
        </section>
        <section hidden={view !== 'profile'}>
          <ProfileView />
        </section>
      </main>
    </div>
  )
}
