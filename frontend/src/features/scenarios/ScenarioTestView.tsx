import { useEffect, useRef, useState } from 'react'
import * as api from '../../api'
import { Icon, type IconName } from '../../icons'
import type { ModelReply, Scenario, ScenarioJudgement, ScenarioVerdict } from '../../types'
import { Markdown } from './markdown'
import './scenarios.css'

const ICONS: Record<string, IconName> = {
  basic: 'pencil',
  calculation: 'calculator',
  'false-premise': 'warning',
  unknowable: 'question',
  'cs-concept': 'code',
  'trade-off': 'scale',
  critique: 'comment',
  'study-plan': 'calendar',
}

type Status = 'upcoming' | 'running' | 'answered' | 'judging' | 'pass' | 'partial' | 'fail' | 'error'

const STATUS_LABEL: Record<Status, string> = {
  upcoming: 'Upcoming',
  running: 'Answering…',
  answered: 'Answered',
  judging: 'Judging…',
  pass: 'Pass',
  partial: 'Partial',
  fail: 'Fail',
  error: 'Error',
}

/** The last run, kept in the browser so a reload doesn't spend another 9 calls. */
interface Run {
  answers: Record<string, ModelReply>
  judgement: ScenarioJudgement | null
  judgeError: string
}

const KEY = 'mmi-scenario-run'
const EMPTY_RUN: Run = { answers: {}, judgement: null, judgeError: '' }

function loadRun(): Run {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved && typeof saved === 'object' && saved.answers ? { ...EMPTY_RUN, ...saved } : EMPTY_RUN
  } catch {
    return EMPTY_RUN
  }
}

function saveRun(run: Run): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run))
  } catch {
    // Storage blocked: the run still shows for this visit.
  }
}

function failedReply(error: string): ModelReply {
  return {
    system: 'aivana',
    model: 'aivana-mmi',
    mock: false,
    text: null,
    latency_ms: 0,
    cost: null,
    cost_unit: 'credits',
    input_tokens: null,
    output_tokens: null,
    error,
    request_id: null,
  }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const credits = (n: number) => `${Number(n.toPrecision(3))} credits`

// Eight questions a CSE student might ask, one per scenario type. Aivana answers each
// once (effort auto); one call to a judge model grades all the answers. The questions
// load the first time the tab is opened.
export default function ScenarioTestView({ active = true }: { active?: boolean }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loadError, setLoadError] = useState('')
  const [run, setRun] = useState<Run>(loadRun)
  const [phase, setPhase] = useState<'idle' | 'answering' | 'judging'>('idle')
  const [current, setCurrent] = useState<string | null>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (!active || requested.current) return
    requested.current = true
    api.getScenarios().then(setScenarios, (e) => setLoadError(`Couldn't load the scenarios: ${String(e)}`))
  }, [active])

  function update(next: Run) {
    setRun(next)
    saveRun(next)
  }

  async function judge(state: Run) {
    const answered = scenarios.flatMap((s) => {
      const reply = state.answers[s.id]
      return reply?.text ? [{ scenario_id: s.id, text: reply.text, latency_ms: reply.latency_ms }] : []
    })
    if (answered.length === 0) {
      update({ ...state, judgeError: 'No answers to judge: every question failed.' })
      return
    }
    setPhase('judging')
    try {
      update({ ...state, judgement: await api.judgeScenarios(answered), judgeError: '' })
    } catch (e) {
      update({ ...state, judgement: null, judgeError: `The judge failed: ${String(e)}` })
    } finally {
      setPhase('idle')
    }
  }

  async function start() {
    let state: Run = EMPTY_RUN
    update(state)
    setPhase('answering')
    for (const s of scenarios) {
      setCurrent(s.id)
      let reply: ModelReply
      try {
        reply = await api.answerScenario(s.id)
      } catch (e) {
        reply = failedReply(String(e))
      }
      state = { ...state, answers: { ...state.answers, [s.id]: reply } }
      update(state)
    }
    setCurrent(null)
    await judge(state)
  }

  const busy = phase !== 'idle'
  const verdicts = new Map((run.judgement?.results ?? []).map((v) => [v.scenario_id, v]))

  function status(id: string): Status {
    const reply = run.answers[id]
    if (phase === 'answering' && current === id) return 'running'
    if (!reply) return 'upcoming'
    if (reply.text === null) return 'error'
    const v = verdicts.get(id)
    if (v) return v.verdict
    return phase === 'judging' ? 'judging' : 'answered'
  }

  const replies = Object.values(run.answers)
  const done = replies.length
  const totalMs = replies.reduce((sum, r) => sum + r.latency_ms, 0)
  const totalCredits = replies.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const mock = replies.some((r) => r.mock) || run.judgement?.mock
  const canRejudge = !busy && done > 0 && !run.judgement && replies.some((r) => r.text)

  return (
    <div className="scn">
      <div className="scn-head">
        <div className="scn-intro">
          <p className="scn-eyebrow">Aivana MMI · CSE student</p>
          <h1>Scenario Test</h1>
          <span className="scn-rule" aria-hidden="true" />
          <p className="scn-sub">
            Eight questions a CSE student might ask, one per scenario type. Aivana answers each once at its default
            effort; a separate judge model checks every answer against its key points.
          </p>
          <div className="scn-actions">
            <button type="button" className="scn-run" onClick={() => void start()} disabled={busy || !scenarios.length}>
              {phase === 'answering'
                ? `Answering ${Math.min(done + 1, scenarios.length)} of ${scenarios.length}…`
                : phase === 'judging'
                  ? 'Judging…'
                  : done
                    ? 'Run again'
                    : 'Run scenario test'}
              <Icon name="arrow" size={18} />
            </button>
            {canRejudge && (
              <button type="button" className="btn-outline" onClick={() => void judge(run)}>
                Judge again
              </button>
            )}
          </div>
        </div>

        <Summary judgement={run.judgement} scenarios={scenarios} done={done} totalMs={totalMs} credits={totalCredits} />
      </div>

      {mock && (
        <p className="scn-note" role="note">
          Mock mode: canned answers and verdicts. Set AIVANA_MODE and BASELINE_MODE to live in backend/.env for a real
          run.
        </p>
      )}
      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      {run.judgeError && (
        <p className="error" role="alert">
          {run.judgeError}
        </p>
      )}
      <ol className="scn-list">
        {scenarios.map((s) => (
          <ScenarioRow
            key={s.id}
            scenario={s}
            status={status(s.id)}
            reply={run.answers[s.id]}
            verdict={verdicts.get(s.id)}
            judgeModel={run.judgement?.model ?? ''}
          />
        ))}
      </ol>
    </div>
  )
}

function Summary({
  judgement,
  scenarios,
  done,
  totalMs,
  credits: spent,
}: {
  judgement: ScenarioJudgement | null
  scenarios: Scenario[]
  done: number
  totalMs: number
  credits: number
}) {
  const scores = new Map((judgement?.results ?? []).map((v) => [v.scenario_id, v]))
  return (
    <section className="scn-overview" aria-label="Overview">
      <div className="scn-overall">
        <span className="scn-overall-num">{judgement ? judgement.overall_score : '—'}</span>
        <span className="scn-overall-of">/ 100 overall</span>
      </div>
      <dl className="scn-stats">
        <div>
          <dt>Passed</dt>
          <dd>{judgement ? `${judgement.passed} of ${judgement.results.length}` : '—'}</dd>
        </div>
        <div>
          <dt>Answered</dt>
          <dd>
            {done} of {scenarios.length || 8}
          </dd>
        </div>
        <div>
          <dt>Aivana time</dt>
          <dd>{done ? seconds(totalMs) : '—'}</dd>
        </div>
        <div>
          <dt>Aivana cost</dt>
          <dd>{spent ? credits(spent) : '—'}</dd>
        </div>
      </dl>
      <div className="scn-bars" role="img" aria-label="Score per scenario">
        {scenarios.map((s) => {
          const v = scores.get(s.id)
          return (
            <span key={s.id} className="scn-bar" title={`${s.number}. ${s.title}: ${v ? v.score : 'not judged'}`}>
              <span className={`scn-bar-fill${v ? ` is-${v.verdict}` : ''}`} style={{ height: `${v ? Math.max(v.score, 4) : 0}%` }} />
              <span className="scn-bar-label">{s.number}</span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

function ScenarioRow({
  scenario: s,
  status,
  reply,
  verdict: v,
  judgeModel,
}: {
  scenario: Scenario
  status: Status
  reply: ModelReply | undefined
  verdict: ScenarioVerdict | undefined
  judgeModel: string
}) {
  const [open, setOpen] = useState(false)
  const detailsId = `scn-details-${s.id}`
  return (
    <li className={`scn-row is-${status}`}>
      <span className="scn-marker" aria-hidden="true">
        {(status === 'pass' || status === 'partial') && <Icon name="check" size={16} />}
        {(status === 'fail' || status === 'error') && '!'}
      </span>

      <section className="scn-card" aria-label={`Scenario ${s.number}: ${s.title}`}>
        <div className="scn-cell scn-main">
          <span className="scn-icon">
            <Icon name={ICONS[s.id] ?? 'question'} size={22} />
          </span>
          <div>
            <div className="scn-kicker">
              <span>
                Scenario {s.number} · {s.type}
              </span>
              <span className={`scn-pill is-${status}`}>{STATUS_LABEL[status]}</span>
            </div>
            <h2>{s.title}</h2>
            <p className="scn-question">{s.question}</p>
          </div>
        </div>

        <div className="scn-cell">
          <p className="scn-label">Key points</p>
          <ul className="scn-points">
            {s.key_points.map((p, i) => {
              const met = v?.key_points_met[i]
              const state = met === undefined ? 'open' : met ? 'met' : 'missed'
              return (
                <li key={p} className={`is-${state}`}>
                  <span className="scn-point-mark" aria-label={state === 'open' ? 'Not judged' : state === 'met' ? 'Met' : 'Missed'}>
                    {state === 'met' ? '✓' : state === 'missed' ? '✕' : ''}
                  </span>
                  {p}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="scn-cell scn-meta">
          <p>
            <Icon name="clock" size={16} />
            {reply && reply.text !== null ? seconds(reply.latency_ms) : '—'}
          </p>
          {reply?.input_tokens != null && (
            <p className="scn-quiet">
              {reply.input_tokens} in / {reply.output_tokens} out{reply.cost != null && ` · ${credits(reply.cost)}`}
            </p>
          )}
          {v && (
            <div className="scn-score" aria-label={`Score ${v.score} of 100`}>
              <div className="scn-score-head">
                <span>Score</span>
                <strong>{v.score}</strong>
              </div>
              <span className="scn-track">
                <span className={`scn-track-fill is-${v.verdict}`} style={{ width: `${v.score}%` }} />
              </span>
              <p className="scn-quiet scn-subscores">
                Correct {v.correctness} · Helpful {v.helpfulness} · Honest {v.honesty} · Speed {v.speed}
              </p>
            </div>
          )}
        </div>

        <div className="scn-cell scn-go">
          <button
            type="button"
            className="scn-details-btn"
            aria-expanded={open}
            aria-controls={detailsId}
            disabled={!reply}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide details' : 'View details'}
            <Icon name="arrow" size={18} />
          </button>
        </div>

        {open && reply && (
          <div className="scn-details" id={detailsId}>
            {v ? (
              <ScoreChart verdict={v} judgeModel={judgeModel} />
            ) : (
              <p className="scn-quiet">Not judged yet.</p>
            )}
            <Answer reply={reply} />
          </div>
        )}
      </section>
    </li>
  )
}

const tone = (score: number) => (score >= 4 ? 'good' : score === 3 ? 'ok' : 'bad')

const DIMENSIONS = [
  { key: 'correctness', label: 'Correct', weight: 35 },
  { key: 'helpfulness', label: 'Helpful', weight: 30 },
  { key: 'honesty', label: 'Honest', weight: 25 },
  { key: 'speed', label: 'Speed', weight: 10 },
] as const

/** The four 1-5 scores as a column chart, coloured by how good each is. */
function ScoreChart({ verdict: v, judgeModel }: { verdict: ScenarioVerdict; judgeModel: string }) {
  return (
    <section className="scn-chart-box" aria-label="Scores">
      <p className="scn-chart-head">
        <span>
          Score <strong>{v.score}</strong> / 100
        </span>
        <span className={`scn-pill is-${v.verdict}`}>{STATUS_LABEL[v.verdict]}</span>
      </p>
      <div className="scn-chart">
        <div className="scn-chart-axis" aria-hidden="true">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <ul className="scn-chart-cols">
          {DIMENSIONS.map((d) => {
            const value = v[d.key]
            return (
              <li key={d.key} className={`dim-${d.key} tone-${tone(value)}`} aria-label={`${d.label}: ${value} of 5, weight ${d.weight}%`}>
                <span className="scn-col-area">
                  <span className="scn-col" style={{ height: `${(value / 5) * 100}%` }}>
                    <span className="scn-col-value">{value}</span>
                  </span>
                </span>
                <span className="scn-col-name">{d.label}</span>
                <span className="scn-col-weight">{d.weight}%</span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="scn-comment">
        <strong>Judge{judgeModel && ` (${judgeModel})`}:</strong> {v.comment}
      </p>
    </section>
  )
}

function Answer({ reply }: { reply: ModelReply }) {
  const [shown, setShown] = useState(false)
  if (reply.text === null) return <p className="error">{reply.error}</p>
  return (
    <div className="scn-answer-box">
      <button type="button" className="scn-link" aria-expanded={shown} onClick={() => setShown((x) => !x)}>
        {shown ? "Hide Aivana's answer" : "Show Aivana's answer"}
      </button>
      {shown && (
        <section className="scn-answer" aria-label="Aivana's answer">
          <Markdown text={reply.text} />
          {reply.request_id && <p className="scn-quiet">Request {reply.request_id}</p>}
        </section>
      )}
    </div>
  )
}
