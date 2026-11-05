import { type FormEvent, useState } from 'react'
import * as api from '../../api'
import { MAX_BENCHMARK_PROMPT, type ModelReply } from '../../types'
import './benchmark.css'
import { addVote, EMPTY_TALLY, loadTally, saveTally, type Tally, type Vote } from './votes'

const EXAMPLES = [
  'Correct grammar: I are happy.',
  'I know Java and Spring Boot. Am I a good fit for a JavaScript and Node.js internship?',
  'Give me three tips for answering "Tell me about yourself" in an interview.',
]

const VOTES: { vote: Vote; label: string }[] = [
  { vote: 'a', label: '👈 A is better' },
  { vote: 'b', label: '👉 B is better' },
  { vote: 'tie', label: '🤝 Tie' },
  { vote: 'bad', label: '👎 Both are bad' },
]

interface Round {
  prompt: string
  replies: [ModelReply, ModelReply] | null // in the order shown as A and B; null while waiting
  vote: Vote | null
}

/** "Aivana MMI", or the baseline's provider read from its model id. */
function systemName(reply: Pick<ModelReply, 'system' | 'model'>): string {
  if (reply.system === 'aivana') return 'Aivana MMI'
  if (reply.model.startsWith('gemini')) return 'Gemini'
  if (/^(gpt|o\d)/.test(reply.model)) return 'OpenAI'
  return 'General model'
}

function cost(reply: ModelReply): string {
  if (reply.cost === null) return reply.cost_unit === 'usd' ? 'price not set' : 'cost not reported'
  const amount = String(Number(reply.cost.toPrecision(3))) // 3 significant digits, no trailing zeros
  return reply.cost_unit === 'usd' ? `$${amount}` : `${amount} credits`
}

// Two models answer the same prompt side by side as Model A and Model B, in random
// order and without names, so the vote isn't swayed by who answered. Names, speed
// and cost are shown once the user has voted. A round where a model failed can't be
// voted on, so it shows them straight away; errors name their model anyway.
export default function BenchmarkView() {
  const [prompt, setPrompt] = useState('')
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState('')
  const [tally, setTally] = useState<Tally>(loadTally)

  const waiting = round !== null && round.replies === null
  const failed = round?.replies?.some((r) => r.text === null) ?? false
  const mock = round?.replies?.some((r) => r.mock) ?? false

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = prompt.trim()
    if (!text || waiting) return
    setError('')
    setRound({ prompt: text, replies: null, vote: null })
    setPrompt('')
    try {
      const { replies } = await api.askBenchmark(text)
      const shown: [ModelReply, ModelReply] =
        Math.random() < 0.5 ? [replies[0], replies[1]] : [replies[1], replies[0]]
      setRound({ prompt: text, replies: shown, vote: null })
    } catch (err) {
      setRound(null)
      setPrompt(text)
      setError(`Couldn't get both answers: ${String(err)}`)
    }
  }

  function vote(v: Vote) {
    if (!round?.replies || round.vote) return
    setRound({ ...round, vote: v })
    if (mock) return // canned replies say nothing about the models
    const next = addVote(tally, v, round.replies)
    setTally(next)
    saveTally(next)
  }

  function clearTally() {
    setTally(EMPTY_TALLY)
    saveTally(EMPTY_TALLY)
  }

  const rounds = tally.aivana + tally.baseline + tally.tie + tally.bad

  return (
    <>
      <div className="page-head">
        <h1>Benchmark</h1>
        <p className="page-sub">
          Ask anything. Aivana MMI and a general model answer side by side without their names; vote for the better
          answer, then see which model was which.
        </p>
      </div>

      {mock && (
        <p className="bench-note" role="note">
          Mock mode: canned replies. Votes aren't counted. Set AIVANA_MODE and BASELINE_MODE to live in backend/.env for
          real answers.
        </p>
      )}

      <div className="arena">
        {(['A', 'B'] as const).map((side, i) => (
          <Panel key={side} side={side} round={round} reply={round?.replies?.[i] ?? null} revealed={failed || round?.vote != null} />
        ))}
      </div>

      <div className="arena-votes" role="group" aria-label="Vote">
        {VOTES.map((v) => (
          <button
            key={v.vote}
            type="button"
            className={`arena-vote${round?.vote === v.vote ? ' chosen' : ''}`}
            aria-pressed={round?.vote === v.vote}
            disabled={!round?.replies || round.vote !== null || failed}
            onClick={() => vote(v.vote)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {failed && (
        <p className="bench-note arena-no-vote" role="status">
          One model couldn't answer, so this round can't be voted on.
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="arena-composer" onSubmit={(e) => void send(e)}>
        <textarea
          aria-label="Your message"
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
        <button type="submit" className="btn-filled" disabled={!prompt.trim() || waiting}>
          {waiting ? 'Waiting…' : 'Send'}
        </button>
      </form>

      <div className="arena-examples">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="arena-example" disabled={waiting} onClick={() => setPrompt(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {rounds > 0 && (
        <p className="arena-tally" aria-label="Votes so far">
          Votes so far: Aivana MMI {tally.aivana} · General model {tally.baseline} · Tie {tally.tie} · Both bad{' '}
          {tally.bad}
          <button type="button" className="arena-clear" onClick={clearTally}>
            Clear
          </button>
        </p>
      )}
    </>
  )
}

function Panel({
  side,
  round,
  reply,
  revealed,
}: {
  side: 'A' | 'B'
  round: Round | null
  reply: ModelReply | null
  revealed: boolean
}) {
  return (
    <section className="arena-panel" aria-label={`Model ${side}`}>
      <p className="arena-label">Model {side}</p>
      {!round ? (
        <p className="arena-empty">Ask a question below to compare the two models.</p>
      ) : (
        <>
          <div className="bubble bubble-user">{round.prompt}</div>
          {!reply ? (
            <div className="bubble bubble-model arena-thinking">Thinking…</div>
          ) : reply.text !== null ? (
            <div className="bubble bubble-model">{reply.text}</div>
          ) : (
            <div className="bubble bubble-model error">{reply.error}</div>
          )}
          {revealed && reply && (
            <p className="arena-reveal">
              <strong>{systemName(reply)}</strong> · {reply.model}
              {!reply.mock && ` · ${(reply.latency_ms / 1000).toFixed(1)} s · ${cost(reply)}`}
            </p>
          )}
        </>
      )}
    </section>
  )
}
