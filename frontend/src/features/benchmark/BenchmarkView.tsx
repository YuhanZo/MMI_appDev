import { type FormEvent, useEffect, useRef, useState } from 'react'
import * as api from '../../api'
import { Markdown } from '../../markdown'
import { MAX_BENCHMARK_PROMPT, type ModelReply } from '../../types'
import './benchmark.css'
import { addVote, EMPTY_TALLY, loadTally, saveTally, systemName, type Tally, totalVotes, type Vote } from './votes'

const EXAMPLES = [
  'Correct grammar: I are happy.',
  'I know Java and Spring Boot. Am I a good fit for a JavaScript and Node.js internship?',
  'Give me three tips for answering "Tell me about yourself" in an interview.',
]

const VOTES: { vote: Vote; label: string }[] = [
  { vote: 'a', label: '👈 A is better' },
  { vote: 'b', label: '👉 B is better' },
  { vote: 'tie', label: '🤝 About the same' },
  { vote: 'bad', label: '👎 Both are bad' },
]

interface Round {
  prompt: string
  startedAt: number
  replies: [ModelReply, ModelReply] | null // in the order shown as A and B; null while waiting
  vote: Vote | null
}

function cost(reply: ModelReply): string {
  if (reply.cost === null) return reply.cost_unit === 'usd' ? 'price not set' : 'cost not reported'
  const amount = String(Number(reply.cost.toPrecision(3))) // 3 significant digits, no trailing zeros
  return reply.cost_unit === 'usd' ? `$${amount}` : `${amount} credits`
}

function summary(round: Round): string {
  const [a, b] = round.replies!
  if (round.vote === 'a') return `You picked Model A — ${systemName(a)}.`
  if (round.vote === 'b') return `You picked Model B — ${systemName(b)}.`
  const both = `Model A was ${systemName(a)} and Model B was ${systemName(b)}.`
  return round.vote === 'tie' ? `You called it about the same. ${both}` : `You said both answers were bad. ${both}`
}

// One question at a time: ask → both models answer (names hidden, order random) →
// vote → see which model was which → ask the next question. Each step shows only
// what can be done at that point. A round where a model failed can't be voted on, so
// it names both models straight away (errors name their model anyway); votes on
// mock replies reveal the models but aren't counted.
export default function BenchmarkView() {
  const [prompt, setPrompt] = useState('')
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState('')
  const [tally, setTally] = useState<Tally>(loadTally)
  const [now, setNow] = useState(() => Date.now())
  const input = useRef<HTMLTextAreaElement>(null)

  const waiting = round !== null && round.replies === null
  const failed = round?.replies?.some((r) => r.text === null) ?? false
  const mock = round?.replies?.some((r) => r.mock) ?? false

  // Tick once a second while waiting, so the user can see the models are still working.
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [waiting])

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = prompt.trim()
    if (!text || waiting) return
    const startedAt = Date.now()
    setError('')
    setNow(startedAt)
    setRound({ prompt: text, startedAt, replies: null, vote: null })
    setPrompt('')
    try {
      const { replies } = await api.askBenchmark(text)
      const shown: [ModelReply, ModelReply] =
        Math.random() < 0.5 ? [replies[0], replies[1]] : [replies[1], replies[0]]
      setRound({ prompt: text, startedAt, replies: shown, vote: null })
    } catch (err) {
      setRound(null)
      setPrompt(text)
      setError(`Couldn't get both answers: ${String(err)}`)
    }
  }

  function vote(v: Vote) {
    if (!round?.replies || round.vote || failed) return
    setRound({ ...round, vote: v })
    if (mock) return // canned replies say nothing about the models
    const next = addVote(tally, v, round.replies)
    setTally(next)
    saveTally(next)
  }

  function askAnother() {
    setRound(null)
    setError('')
    // The composer is rendered again on this update; focus it once it's there.
    requestAnimationFrame(() => input.current?.focus())
  }

  function resetTally() {
    setTally(EMPTY_TALLY)
    saveTally(EMPTY_TALLY)
  }

  return (
    <>
      <div className="page-head">
        <h1>Benchmark</h1>
      </div>

      {totalVotes(tally) > 0 && <Scoreboard tally={tally} onReset={resetTally} />}

      {mock && (
        <p className="bench-note" role="note">
          Mock mode: canned replies. Votes aren't counted. Set AIVANA_MODE and BASELINE_MODE to live in backend/.env
          for real answers.
        </p>
      )}

      {!round && (
        <form className="arena-start" onSubmit={(e) => void send(e)}>
          <label className="arena-start-title" htmlFor="arena-message">
            Ask a question — two anonymous models will answer
          </label>
          <div className="arena-composer">
            <textarea
              id="arena-message"
              ref={input}
              placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
              value={prompt}
              maxLength={MAX_BENCHMARK_PROMPT}
              rows={2}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button type="submit" className="btn-filled" disabled={!prompt.trim()}>
              Send
            </button>
          </div>
          <div className="arena-examples">
            <p className="arena-examples-label">Or try one of these:</p>
            <ul>
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button type="button" className="arena-example" onClick={() => setPrompt(ex)}>
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {round && (
        <>
          {waiting && (
            <p className="arena-status" role="status">
              <span className="arena-spinner" aria-hidden="true" />
              Both models are answering… {Math.max(0, Math.round((now - round.startedAt) / 1000))} s
            </p>
          )}

          <div className="arena">
            {(['A', 'B'] as const).map((side, i) => (
              <Panel
                key={side}
                side={side}
                round={round}
                reply={round.replies?.[i] ?? null}
                revealed={failed || round.vote !== null}
                picked={round.vote === side.toLowerCase()}
              />
            ))}
          </div>

          {round.replies && !round.vote && !failed && (
            <div className="arena-vote-step">
              <p className="arena-question" id="arena-vote-question">
                Which answer is better?
              </p>
              <div className="arena-votes" role="group" aria-labelledby="arena-vote-question">
                {VOTES.map((v) => (
                  <button key={v.vote} type="button" className="arena-vote" onClick={() => vote(v.vote)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(round.vote || failed) && (
            <div className="arena-result" role="status">
              <p>{failed ? "One model couldn't answer, so this round can't be voted on." : summary(round)}</p>
              <button type="button" className="btn-filled" onClick={askAnother}>
                Ask another question
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

function Panel({
  side,
  round,
  reply,
  revealed,
  picked,
}: {
  side: 'A' | 'B'
  round: Round
  reply: ModelReply | null
  revealed: boolean
  picked: boolean
}) {
  return (
    <section className={`arena-panel${picked ? ' picked' : ''}`} aria-label={`Model ${side}`}>
      <div className="arena-panel-head">
        <p className="arena-label">
          Model {side}
          {revealed && reply && (
            <>
              {' = '}
              <strong>{systemName(reply)}</strong>
              <span className="arena-model">{reply.model}</span>
            </>
          )}
        </p>
        {picked && <span className="arena-pick">★ Your pick</span>}
      </div>

      <div className="bubble bubble-user">{round.prompt}</div>
      {!reply ? (
        <div className="bubble bubble-model arena-thinking">Thinking…</div>
      ) : reply.text !== null ? (
        <div className="bubble bubble-model">
          <Markdown text={reply.text} />
        </div>
      ) : (
        <div className="bubble bubble-model error">{reply.error}</div>
      )}

      {revealed && reply && reply.text !== null && !reply.mock && (
        <p className="arena-meta">
          {(reply.latency_ms / 1000).toFixed(1)} s · {cost(reply)}
        </p>
      )}
    </section>
  )
}

function Scoreboard({ tally, onReset }: { tally: Tally; onReset: () => void }) {
  const total = totalVotes(tally)
  const rows = [
    { key: 'aivana', label: 'Aivana MMI', count: tally.aivana },
    { key: 'baseline', label: tally.baselineName || 'General model', count: tally.baseline },
    { key: 'tie', label: 'About the same', count: tally.tie },
    { key: 'bad', label: 'Both bad', count: tally.bad },
  ]
  return (
    <section className="arena-score" aria-label="Your votes">
      <div className="arena-score-head">
        <p>
          Your votes <span>({total})</span>
        </p>
        <button type="button" className="btn-outline arena-reset" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="arena-score-bar" aria-hidden="true">
        {rows.map((r) => r.count > 0 && <span key={r.key} className={`seg-${r.key}`} style={{ flexGrow: r.count }} />)}
      </div>
      <ul className="arena-score-legend">
        {rows.map((r) => (
          <li key={r.key}>
            <span className={`arena-dot seg-${r.key}`} aria-hidden="true" />
            {r.label} <strong>{r.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}
