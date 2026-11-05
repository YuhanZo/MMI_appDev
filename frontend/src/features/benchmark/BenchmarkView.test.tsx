import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelReply } from '../../types'
import BenchmarkView from './BenchmarkView'

const AIVANA: ModelReply = {
  system: 'aivana',
  model: 'aivana-mmi',
  mock: false,
  text: 'The correct grammar would be "I am happy."',
  latency_ms: 12200,
  cost: 0.00121,
  cost_unit: 'credits',
  input_tokens: 12,
  output_tokens: 9,
  error: null,
  request_id: 'req_1',
}

const GEMINI: ModelReply = {
  ...AIVANA,
  system: 'baseline',
  model: 'gemini-3.5-flash-lite',
  text: "I'm happy to help with your English grammar.",
  latency_ms: 1200,
  cost: 0.00005,
  cost_unit: 'usd',
  request_id: null,
}

type Reply = ModelReply[] | Error | Promise<ModelReply[]>

function mockBenchmarkApi(reply: () => Reply = () => [AIVANA, GEMINI]) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url !== '/api/benchmark/chat') throw new Error(`unmocked route: ${url}`)
    const r = await reply()
    if (r instanceof Error) return new Response(JSON.stringify({ detail: { message: r.message } }), { status: 429 })
    return new Response(JSON.stringify({ replies: r }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Aivana is shown as Model A when Math.random() is below 0.5. */
async function ask(text: string, aivanaFirst = true) {
  vi.spyOn(Math, 'random').mockReturnValue(aivanaFirst ? 0.1 : 0.9)
  const user = userEvent.setup()
  render(<BenchmarkView />)
  await user.type(screen.getByLabelText('Your message'), text)
  await user.click(screen.getByRole('button', { name: 'Send' }))
  return user
}

const panel = (side: 'A' | 'B') => screen.getByRole('region', { name: `Model ${side}` })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('BenchmarkView', () => {
  it('sends the message unchanged and shows both answers without names', async () => {
    const fetchMock = mockBenchmarkApi()
    await ask('Correct grammar: I are happy.', false)

    expect(await within(panel('A')).findByText("I'm happy to help with your English grammar.")).toBeInTheDocument()
    expect(within(panel('B')).getByText('The correct grammar would be "I am happy."')).toBeInTheDocument()
    for (const side of ['A', 'B'] as const) {
      expect(within(panel(side)).getByText('Correct grammar: I are happy.')).toHaveClass('bubble-user')
    }
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ prompt: 'Correct grammar: I are happy.' })
    expect(screen.queryByText(/Aivana MMI ·|Gemini/)).not.toBeInTheDocument()
  })

  it('shows "Thinking…" and locks voting until both answers arrive', async () => {
    let finish!: (r: ModelReply[]) => void
    mockBenchmarkApi(() => new Promise((resolve) => (finish = resolve)))
    await ask('Hello')

    expect(within(panel('A')).getByText('Thinking…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Waiting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '👈 A is better' })).toBeDisabled()

    finish([AIVANA, GEMINI])
    await waitFor(() => expect(screen.getByRole('button', { name: '👈 A is better' })).toBeEnabled())
  })

  it('reveals each model with its speed and cost after the vote, and counts the vote', async () => {
    mockBenchmarkApi()
    const user = await ask('Correct grammar: I are happy.', false) // Gemini is A

    await user.click(await screen.findByRole('button', { name: '👉 B is better' }))

    expect(within(panel('A')).getByText('Gemini').closest('p')).toHaveTextContent(
      'Gemini · gemini-3.5-flash-lite · 1.2 s · $0.00005',
    )
    expect(within(panel('B')).getByText('Aivana MMI').closest('p')).toHaveTextContent(
      'Aivana MMI · aivana-mmi · 12.2 s · 0.00121 credits',
    )
    expect(screen.getByRole('button', { name: '👉 B is better' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '👈 A is better' })).toBeDisabled()
    expect(screen.getByLabelText('Votes so far')).toHaveTextContent('Aivana MMI 1 · General model 0 · Tie 0 · Both bad 0')
  })

  it('keeps the vote tally across visits until cleared', async () => {
    mockBenchmarkApi()
    const user = await ask('Hi')
    await user.click(await screen.findByRole('button', { name: '🤝 Tie' }))

    const { unmount } = render(<BenchmarkView />)
    expect(screen.getAllByLabelText('Votes so far')[1]).toHaveTextContent('Tie 1')
    unmount()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByLabelText('Votes so far')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('mmi-benchmark-votes')!)).toEqual({ aivana: 0, baseline: 0, tie: 0, bad: 0 })
  })

  it('shows a failed side as an error and still shows the other answer', async () => {
    mockBenchmarkApi(() => [AIVANA, { ...GEMINI, text: null, error: 'Baseline model returned 503: high demand' }])
    await ask('Hi')
    expect(await within(panel('B')).findByText('Baseline model returned 503: high demand')).toBeInTheDocument()
    expect(within(panel('A')).getByText('The correct grammar would be "I am happy."')).toBeInTheDocument()
  })

  it('does not take votes when a model failed, and names both models straight away', async () => {
    mockBenchmarkApi(() => [AIVANA, { ...GEMINI, text: null, error: 'Baseline model returned 503: high demand' }])
    await ask('Hi')

    expect(await screen.findByRole('status')).toHaveTextContent("can't be voted on")
    for (const name of ['👈 A is better', '👉 B is better', '🤝 Tie', '👎 Both are bad']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(within(panel('A')).getByText('Aivana MMI')).toBeInTheDocument()
    expect(within(panel('B')).getByText('Gemini')).toBeInTheDocument()
    expect(screen.queryByLabelText('Votes so far')).not.toBeInTheDocument()
  })

  it('reveals the models after a mock vote without counting it', async () => {
    mockBenchmarkApi(() => [
      { ...AIVANA, mock: true },
      { ...GEMINI, mock: true },
    ])
    const user = await ask('Hi')

    await user.click(await screen.findByRole('button', { name: '👈 A is better' }))

    expect(within(panel('A')).getByText('Aivana MMI')).toBeInTheDocument()
    expect(screen.queryByLabelText('Votes so far')).not.toBeInTheDocument()
    expect(localStorage.getItem('mmi-benchmark-votes')).toBeNull()
  })

  it('sends with Enter and fills the box from an example', async () => {
    const fetchMock = mockBenchmarkApi()
    const user = userEvent.setup()
    render(<BenchmarkView />)

    await user.click(screen.getByRole('button', { name: 'Correct grammar: I are happy.' }))
    expect(screen.getByLabelText('Your message')).toHaveValue('Correct grammar: I are happy.')
    await user.type(screen.getByLabelText('Your message'), '{Enter}')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Your message')).toHaveValue('')
  })

  it('says when the answers are placeholders', async () => {
    mockBenchmarkApi(() => [
      { ...AIVANA, mock: true },
      { ...GEMINI, mock: true },
    ])
    await ask('Hi')
    expect(await screen.findByRole('note')).toHaveTextContent('Mock mode')
  })

  it('keeps the message and explains when the request fails', async () => {
    mockBenchmarkApi(() => new Error('A comparison is already running. Wait for it to finish.'))
    await ask('Hello there')
    expect(await screen.findByRole('alert')).toHaveTextContent('A comparison is already running')
    expect(screen.getByLabelText('Your message')).toHaveValue('Hello there')
  })
})
