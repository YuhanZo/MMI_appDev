import { useState } from 'react'
import * as api from '../../api'
import type { ModelRun } from '../../types'
import { loadCareerProfile, toUserProfile } from '../profile/profileStorage'
import './benchmark.css'
import { averages, type BenchmarkEntry, loadHistory, saveHistory } from './benchmarkHistory'
import { SAMPLE_JOBS } from './sampleJobs'

/** "Aivana MMI", or the baseline's provider read from its model id. */
function systemName(run: Pick<ModelRun, 'system' | 'model'>): string {
  if (run.system === 'aivana') return 'Aivana MMI'
  if (run.model.startsWith('gemini')) return 'Gemini'
  if (/^(gpt|o\d)/.test(run.model)) return 'OpenAI'
  return 'General model'
}

function speed(run: Pick<ModelRun, 'mock' | 'latency_ms'>): string {
  return run.mock ? '—' : `${(run.latency_ms / 1000).toFixed(1)} s`
}

function cost(value: number | null, unit: ModelRun['cost_unit']): string {
  if (value === null) return unit === 'usd' ? 'Price not set' : 'Not reported'
  const amount = String(Number(value.toPrecision(3))) // 3 significant digits, no trailing zeros
  return unit === 'usd' ? `$${amount}` : `${amount} credits`
}

interface Shown {
  job: string
  runs: ModelRun[] // Aivana first, then the baseline
}

// Sends the same fit analysis prompt to Aivana and a general model and shows the
// answers side by side; once both are rated, the run can be saved to the table.
export default function BenchmarkView() {
  const [jobId, setJobId] = useState(SAMPLE_JOBS[0].id)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [shown, setShown] = useState<Shown | null>(null)
  const [ratings, setRatings] = useState<number[]>([])
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<BenchmarkEntry[]>(loadHistory)

  async function run() {
    const job = SAMPLE_JOBS.find((j) => j.id === jobId) ?? SAMPLE_JOBS[0]
    setRunning(true)
    setError('')
    setShown(null)
    setRatings([])
    setSaved(false)
    try {
      const result = await api.runBenchmark({ job, user_profile: toUserProfile(loadCareerProfile()) })
      setShown({ job: job.title, runs: result.runs })
    } catch (e) {
      setError(`Benchmark failed: ${String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  function save() {
    if (!shown) return
    setSaved(true)
    const entry: BenchmarkEntry = {
      at: new Date().toISOString(),
      job: shown.job,
      runs: shown.runs.map((r, i) => ({
        system: r.system,
        model: r.model,
        mock: r.mock,
        latency_ms: r.latency_ms,
        cost: r.cost,
        cost_unit: r.cost_unit,
        format_ok: r.format_ok,
        rating: ratings[i],
      })),
    }
    const next = [...history, entry]
    setHistory(next)
    saveHistory(next)
  }

  function clear() {
    setHistory([])
    saveHistory([])
  }

  const bothRated = shown !== null && shown.runs.every((_, i) => ratings[i] !== undefined)

  return (
    <>
      <div className="page-head">
        <h1>Benchmark</h1>
        <p className="page-sub">
          Send the same fit analysis to Aivana MMI and a general model, compare speed, cost and format, and rate
          each answer.
        </p>
      </div>

      <div className="bench-controls">
        <label className="bench-field">
          <span>Job</span>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={running}>
            {SAMPLE_JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} · {j.company}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-filled" onClick={() => void run()} disabled={running}>
          {running ? 'Running both models…' : 'Run benchmark'}
        </button>
      </div>
      <p className="bench-note">Uses the profile saved on your Profile page. Aivana can take 10–40 s.</p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {shown && (
        <>
          {shown.runs.some((r) => r.mock) && (
            <p className="bench-note" role="note">
              Mock mode: canned answers, so the numbers are placeholders. Set AIVANA_MODE and BASELINE_MODE to live in
              backend/.env for real runs.
            </p>
          )}
          <div className="bench-grid">
            {shown.runs.map((r, i) => (
              <RunCard
                key={r.system}
                run={r}
                saved={saved}
                rating={ratings[i]}
                onRate={(n) => setRatings((prev) => Object.assign([...prev], { [i]: n }))}
              />
            ))}
          </div>
          <button type="button" className="btn-outline bench-save" disabled={!bothRated || saved} onClick={save}>
            {saved ? 'Saved to results' : bothRated ? 'Save run' : 'Rate both answers to save'}
          </button>
        </>
      )}

      <History history={history} onClear={clear} />
    </>
  )
}

function RunCard({
  run,
  saved,
  rating,
  onRate,
}: {
  run: ModelRun
  saved: boolean
  rating: number | undefined
  onRate: (n: number) => void
}) {
  const name = systemName(run)
  return (
    <section className="bench-card" aria-label={name}>
      <h2>
        {name}
        <span className="bench-model">{run.model}</span>
      </h2>

      <dl className="bench-metrics">
        <div>
          <dt>Speed</dt>
          <dd>{speed(run)}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{run.mock ? '—' : cost(run.cost, run.cost_unit)}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd className={run.format_ok ? 'bench-ok' : 'bench-bad'}>
            {run.format_ok ? '✓ Matched' : '✗ Didn’t match'}
          </dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>{run.input_tokens === null ? '—' : `${run.input_tokens} in / ${run.output_tokens} out`}</dd>
        </div>
      </dl>

      {run.error && <p className="error">{run.error}</p>}
      {run.answer && (
        <div className="bench-answer">
          <p>{run.answer.summary}</p>
          <AnswerList title="Strengths" items={run.answer.strengths} />
          <AnswerList title="Gaps" items={run.answer.gaps} />
          <AnswerList title="Recommendations" items={run.answer.recommendations} />
        </div>
      )}

      <fieldset className="bench-rating" disabled={saved}>
        <legend>Quality (1 = poor, 5 = excellent)</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n}>
            <input
              type="radio"
              name={`rating-${run.system}`}
              value={n}
              checked={rating === n}
              onChange={() => onRate(n)}
            />
            {n}
          </label>
        ))}
      </fieldset>
    </section>
  )
}

function AnswerList({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  )
}

function History({ history, onClear }: { history: BenchmarkEntry[]; onClear: () => void }) {
  if (history.length === 0) {
    return <p className="empty">Rated runs will appear here.</p>
  }
  const systems: ModelRun['system'][] = ['aivana', 'baseline']
  // Label each row with the model of its latest run (the baseline model can change in .env).
  const label = (system: ModelRun['system']) => {
    const run = history.flatMap((e) => e.runs).findLast((r) => r.system === system)
    return run ? `${systemName(run)} (${run.model})` : systemName({ system, model: '' })
  }

  return (
    <section className="bench-history" aria-label="Benchmark results">
      <div className="bench-history-head">
        <h2>Results</h2>
        <button type="button" className="btn-outline" onClick={onClear}>
          Clear
        </button>
      </div>

      <table className="bench-table">
        <caption>Averages (live runs only)</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Runs</th>
            <th scope="col">Avg speed</th>
            <th scope="col">Avg cost</th>
            <th scope="col">Format matched</th>
            <th scope="col">Avg quality</th>
          </tr>
        </thead>
        <tbody>
          {systems.map((s) => {
            const a = averages(history, s)
            return (
              <tr key={s}>
                <th scope="row">{label(s)}</th>
                <td>{a?.runs ?? 0}</td>
                <td>{a?.latencyS == null ? '—' : `${a.latencyS.toFixed(1)} s`}</td>
                <td>{a ? cost(a.cost, a.costUnit) : '—'}</td>
                <td>{a ? `${Math.round(a.formatRate * 100)}%` : '—'}</td>
                <td>{a ? a.rating.toFixed(1) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <table className="bench-table">
        <caption>Every run</caption>
        <thead>
          <tr>
            <th scope="col">Job</th>
            <th scope="col">Model</th>
            <th scope="col">Speed</th>
            <th scope="col">Cost</th>
            <th scope="col">Format</th>
            <th scope="col">Quality</th>
          </tr>
        </thead>
        <tbody>
          {history.flatMap((e) =>
            e.runs.map((r) => (
              <tr key={`${e.at}-${r.system}`}>
                <td>{e.job}</td>
                <td>
                  {systemName(r)} ({r.model})
                  {r.mock && ' (mock)'}
                </td>
                <td>{speed(r)}</td>
                <td>{r.mock ? '—' : cost(r.cost, r.cost_unit)}</td>
                <td>{r.format_ok ? '✓' : '✗'}</td>
                <td>{r.rating}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  )
}
