import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelReply, Scenario, ScenarioJudgement } from '../../types'
import ScenarioTestView from './ScenarioTestView'

const SCENARIOS: Scenario[] = [
  {
    id: 'basic',
    number: 1,
    type: 'Basic Q&A',
    title: 'Fix a recruiter email',
    question: 'Fix the grammar.',
    key_points: ['Fixes every error', 'Keeps a polite tone'],
  },
  {
    id: 'calculation',
    number: 2,
    type: 'Calculation',
    title: 'Compare two internship offers',
    question: 'Which offer leaves more?',
    key_points: ['A leaves $12,660', 'B leaves $15,900', 'B leaves $3,240 more'],
  },
]

const reply = (id: string, extra: Partial<ModelReply> = {}): ModelReply => ({
  system: 'aivana',
  model: 'aivana-mmi',
  mock: false,
  text: `Answer to ${id}`,
  latency_ms: 8200,
  cost: 0.0012,
  cost_unit: 'credits',
  input_tokens: 40,
  output_tokens: 300,
  error: null,
  request_id: `req_${id}`,
  ...extra,
})

const JUDGEMENT: ScenarioJudgement = {
  model: 'gemini-judge',
  mock: false,
  latency_ms: 3000,
  summary: 'Solid answers, one arithmetic slip.',
  overall_score: 86,
  passed: 1,
  results: [
    {
      scenario_id: 'basic',
      correctness: 5,
      helpfulness: 5,
      honesty: 5,
      speed: 5,
      score: 100,
      key_points_met: [true, true],
      verdict: 'pass',
      comment: 'Fixed every error.',
    },
    {
      scenario_id: 'calculation',
      correctness: 3,
      helpfulness: 4,
      honesty: 5,
      speed: 3,
      score: 72,
      key_points_met: [true, true, false],
      verdict: 'partial',
      comment: 'Got the difference wrong.',
    },
  ],
}

type Route = (init?: RequestInit) => unknown

function mockApi(routes: Record<string, Route> = {}) {
  const all: Record<string, Route> = {
    '/api/scenarios': () => SCENARIOS,
    '/api/scenarios/basic/answer': () => reply('basic'),
    '/api/scenarios/calculation/answer': () => reply('calculation'),
    '/api/scenarios/judge': () => JUDGEMENT,
    ...routes,
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const route = all[url]
    if (!route) throw new Error(`unmocked route: ${url}`)
    const body = await route(init)
    if (body instanceof Error) {
      return new Response(JSON.stringify({ detail: { message: body.message } }), { status: 502 })
    }
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Resolves once the overview shows the judged overall score. */
const judged = () => within(screen.getByRole('region', { name: 'Overview' })).findByText('86')

const card = (title: string) => screen.getByRole('region', { name: new RegExp(title) })

async function runAll() {
  const user = userEvent.setup()
  render(<ScenarioTestView />)
  await user.click(await screen.findByRole('button', { name: /Run scenario test/ }))
  return user
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('ScenarioTestView', () => {
  it('lists every scenario with its key points before a run', async () => {
    mockApi()
    render(<ScenarioTestView />)

    const calc = await screen.findByRole('region', { name: 'Scenario 2: Compare two internship offers' })
    expect(within(calc).getByText('Upcoming')).toBeInTheDocument()
    expect(within(calc).getByText('Which offer leaves more?')).toBeInTheDocument()
    expect(within(calc).getAllByLabelText('Not judged')).toHaveLength(3)
    expect(within(calc).getByRole('button', { name: 'View details' })).toBeDisabled()
  })

  it('asks Aivana one scenario at a time, then sends the answers to the judge once', async () => {
    const fetchMock = mockApi()
    await runAll()

    await judged()
    const urls = fetchMock.mock.calls.map(([url]) => url)
    expect(urls).toEqual([
      '/api/scenarios',
      '/api/scenarios/basic/answer',
      '/api/scenarios/calculation/answer',
      '/api/scenarios/judge',
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({
      answers: [
        { scenario_id: 'basic', text: 'Answer to basic', latency_ms: 8200 },
        { scenario_id: 'calculation', text: 'Answer to calculation', latency_ms: 8200 },
      ],
    })
  })

  it('shows progress while Aivana answers', async () => {
    let finish!: (r: ModelReply) => void
    mockApi({ '/api/scenarios/calculation/answer': () => new Promise((resolve) => (finish = resolve)) })
    await runAll()

    expect(await screen.findByRole('button', { name: /Answering 2 of 2/ })).toBeDisabled()
    expect(within(card('Compare two')).getByText('Answering…')).toBeInTheDocument()
    expect(within(card('Fix a recruiter')).getByText('Answered')).toBeInTheDocument()

    finish(reply('calculation'))
    await screen.findByRole('button', { name: /Run again/ })
  })

  it('shows the verdicts: pass and partial, key points, scores and the overview', async () => {
    mockApi()
    await runAll()

    const calc = card('Compare two')
    expect(await within(calc).findByText('Partial')).toBeInTheDocument()
    expect(within(card('Fix a recruiter')).getByText('Pass')).toBeInTheDocument()
    expect(within(calc).getAllByLabelText('Met')).toHaveLength(2)
    expect(within(calc).getByLabelText('Missed')).toBeInTheDocument()
    expect(within(calc).getByLabelText('Score 72 of 100')).toHaveTextContent('Correct 3 · Helpful 4 · Honest 5 · Speed 3')
    expect(within(calc).getByText('40 in / 300 out · 0.0012 credits')).toBeInTheDocument()

    const overview = screen.getByRole('region', { name: 'Overview' })
    expect(within(overview).getByText('86')).toBeInTheDocument()
    expect(within(overview).getByText('1 of 2')).toBeInTheDocument()
    expect(within(overview).getByText('16.4 s')).toBeInTheDocument()
  })

  it("opens a scenario's details as a score chart, with Aivana's answer on request", async () => {
    mockApi()
    const user = await runAll()
    const calc = card('Compare two')
    await within(calc).findAllByText('Partial')

    await user.click(within(calc).getByRole('button', { name: 'View details' }))
    expect(within(calc).getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true')

    const chart = within(calc).getByRole('region', { name: 'Scores' })
    expect(chart).toHaveTextContent('Score 72 / 100')
    const col = (label: string) => within(chart).getByRole('listitem', { name: new RegExp(`^${label}:`) })
    expect(col('Correct')).toHaveAccessibleName('Correct: 3 of 5, weight 35%')
    expect(col('Correct')).toHaveClass('tone-ok')
    expect(col('Helpful')).toHaveClass('tone-good')
    expect(col('Speed')).toHaveAccessibleName('Speed: 3 of 5, weight 10%')
    expect(within(chart).getByText('Got the difference wrong.')).toBeInTheDocument()
    expect(within(chart).getByText('Judge (gemini-judge):')).toBeInTheDocument()

    expect(within(calc).queryByRole('region', { name: "Aivana's answer" })).not.toBeInTheDocument()
    await user.click(within(calc).getByRole('button', { name: "Show Aivana's answer" }))
    const answer = within(calc).getByRole('region', { name: "Aivana's answer" })
    expect(within(answer).getByText('Answer to calculation')).toBeInTheDocument()
    expect(within(answer).getByText('Request req_calculation')).toBeInTheDocument()
  })

  it("renders the answer's Markdown instead of showing the symbols", async () => {
    mockApi({
      '/api/scenarios/basic/answer': () =>
        reply('basic', { text: 'Lookup is **O(1)** on average.\n\n- `load factor` stays low\n- <b>not html</b>' }),
    })
    const user = await runAll()
    const basic = card('Fix a recruiter')
    await within(basic).findAllByText('Pass')
    await user.click(within(basic).getByRole('button', { name: 'View details' }))
    await user.click(within(basic).getByRole('button', { name: "Show Aivana's answer" }))

    const answer = within(basic).getByRole('region', { name: "Aivana's answer" })
    expect(within(answer).getByText('O(1)').tagName).toBe('STRONG')
    expect(within(answer).getByText('load factor').tagName).toBe('CODE')
    expect(within(answer).getAllByRole('listitem')).toHaveLength(2)
    expect(within(answer).getByText('<b>not html</b>')).toBeInTheDocument() // shown as text, not markup
    expect(answer.querySelector('b')).toBeNull()
    expect(answer.textContent).not.toContain('**')
  })

  it('leaves a failed answer out of the judging and marks it as an error', async () => {
    const fetchMock = mockApi({
      '/api/scenarios/calculation/answer': () => reply('calculation', { text: null, error: 'Aivana timed out' }),
      '/api/scenarios/judge': () => ({ ...JUDGEMENT, passed: 1, overall_score: 100, results: [JUDGEMENT.results[0]] }),
    })
    await runAll()

    expect(await within(card('Compare two')).findByText('Error')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const sent = JSON.parse(String(fetchMock.mock.calls[3][1]?.body))
    expect(sent.answers.map((a: { scenario_id: string }) => a.scenario_id)).toEqual(['basic'])
  })

  it('explains a failed judgement and can judge the same answers again', async () => {
    let calls = 0
    const fetchMock = mockApi({
      '/api/scenarios/judge': () => (++calls === 1 ? new Error("The judge's reply wasn't the expected JSON") : JUDGEMENT),
    })
    const user = await runAll()

    expect(await screen.findByRole('alert')).toHaveTextContent("The judge's reply wasn't the expected JSON")
    await user.click(screen.getByRole('button', { name: 'Judge again' }))

    expect(await judged()).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/answer'))).toHaveLength(2) // no new answers
  })

  it('keeps the last run across visits', async () => {
    mockApi()
    await runAll()
    await judged()

    const { unmount } = render(<ScenarioTestView />)
    const overviews = await screen.findAllByRole('region', { name: 'Overview' })
    expect(overviews).toHaveLength(2)
    for (const o of overviews) expect(within(o).getByText('86')).toBeInTheDocument()
    unmount()
  })

  it('says when the answers are placeholders', async () => {
    mockApi({
      '/api/scenarios/basic/answer': () => reply('basic', { mock: true }),
      '/api/scenarios/calculation/answer': () => reply('calculation', { mock: true }),
    })
    await runAll()
    expect(await screen.findByRole('note')).toHaveTextContent('Mock mode')
  })
})
