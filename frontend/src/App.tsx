import { useEffect, useState } from 'react'
import './App.css'
import * as api from './api'
import type { FitAnalysisResult, InterviewQuestion, Job } from './types'

// Placeholder until profiles are stored per user.
const DEMO_PROFILE = {
  skills: ['Python', 'Java', 'React'],
  education: 'BS Computer Science',
  experience: 'Backend and web development project experience.',
}

function JobSearch() {
  const [role, setRole] = useState('Software Engineer Intern')
  const [location, setLocation] = useState('Columbus, OH')
  const [remote, setRemote] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [fit, setFit] = useState<FitAnalysisResult | null>(null)
  const [error, setError] = useState('')

  async function onSearch() {
    setError('')
    setFit(null)
    try {
      setJobs(await api.searchJobs({ role, location, remote }))
    } catch (e) {
      setError(String(e))
    }
  }

  async function onAnalyze(job: Job) {
    setError('')
    try {
      setFit(await api.fitAnalysis({ job, user_profile: DEMO_PROFILE }))
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <section>
      <h2>Job Search + Fit Analysis</h2>
      <div className="row">
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
        <label>
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Remote
        </label>
        <button onClick={onSearch}>Search</button>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="jobs">
        {jobs.map((job) => (
          <li key={job.id}>
            <strong>{job.title}</strong> — {job.company} ({job.location})
            <p>{job.description}</p>
            <button onClick={() => onAnalyze(job)}>Analyze fit</button>
          </li>
        ))}
      </ul>

      {fit && (
        <div className="card">
          <h3>Fit analysis</h3>
          <p>{fit.summary}</p>
          <p>
            <b>Strengths:</b> {fit.strengths.join(', ')}
          </p>
          <p>
            <b>Gaps:</b> {fit.gaps.join(', ')}
          </p>
          <p>
            <b>Recommendations:</b> {fit.recommendations.join(', ')}
          </p>
        </div>
      )}
    </section>
  )
}

function MockInterview() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string>('')

  useEffect(() => {
    api.getQuestions().then(setQuestions).catch(() => setQuestions([]))
  }, [])

  async function onSubmit(questionId: string) {
    const fb = await api.getFeedback({ question_id: questionId, answer })
    setFeedback(`${fb.summary} | strengths: ${fb.strengths.join(', ')} | improve: ${fb.improvements.join(', ')}`)
  }

  return (
    <section>
      <h2>Mock Interview</h2>
      {questions.map((q) => (
        <div key={q.id} className="card">
          <p>
            <b>[{q.type}]</b> {q.question}
          </p>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
          <button onClick={() => onSubmit(q.id)}>Submit answer</button>
        </div>
      ))}
      {feedback && <p className="card">{feedback}</p>}
    </section>
  )
}

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(`${h.status} (db: ${h.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <main>
      <h1>Career Decision Assistant</h1>
      <p className="status">Backend: {status}</p>
      <JobSearch />
      <MockInterview />
    </main>
  )
}
