import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import * as api from './api'
import { Icon, type IconName } from './icons'
import type { FitAnalysisResult, InterviewFeedback, InterviewQuestion, Job } from './types'

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

// Lives in App (not the Job Search view) because the search box is in the top bar.
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
          <JobSearchView js={js} />
        </section>
        <section hidden={view !== 'interview'}>
          <MockInterviewView />
        </section>
      </main>
    </div>
  )
}
