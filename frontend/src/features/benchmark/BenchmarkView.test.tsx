import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelReply } from '../../types'
import BenchmarkView from './BenchmarkView'

const AIVANA: ModelReply = {
  system: 'aivana',
  model: 'aivana-mmi',
  mock: false,
  text: 'I am happy.',
  latency_ms: 3300,
  cost: 0.000039,
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
  text: 'The correct sentence is:\n\n**"I am happy."**\n\n*(The pronoun "I" takes "am".)*',
  latency_ms: 75900,
  cost: 0.0000924,
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
  await user.type(screen.getByLabelText(/Ask a question/), text)
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
  it('starts with just the question box: no empty answers, no vote buttons', () => {
    mockBenchmarkApi()
    render(<BenchmarkView />)

    expect(screen.getByLabelText(/Ask a question/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Model A' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /A is better/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your votes' })).not.toBeInTheDocument()
  })

  it('shows a running timer and no vote buttons while the models answer', async () => {
    let finish!: (r: ModelReply[]) => void
    mockBenchmarkApi(() => new Promise((resolve) => (finish = resolve)))
    await ask('Hello')

    expect(screen.getByRole('status')).toHaveTextContent(/Both models are answering… \d+ s/)
    expect(within(panel('A')).getByText('Thinking…')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Ask a question/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /A is better/ })).not.toBeInTheDocument()

    finish([AIVANA, GEMINI])
    expect(await screen.findByText('Which answer is better?')).toBeInTheDocument()
    expect(screen.queryByText(/Both models are answering/)).not.toBeInTheDocument()
  })

  it('sends the message unchanged and shows both answers without names, as Markdown', async () => {
    const fetchMock = mockBenchmarkApi()
    await ask('Correct grammar: I are happy.', false) // Gemini is A

    expect(await within(panel('A')).findByText('"I am happy."', { selector: 'strong' })).toBeInTheDocument()
    expect(within(panel('A')).getByText('(The pronoun "I" takes "am".)', { selector: 'em' })).toBeInTheDocument()
    expect(within(panel('A')).queryByText(/\*\*/)).not.toBeInTheDocument()
    expect(within(panel('B')).getByText('I am happy.')).toBeInTheDocument()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ prompt: 'Correct grammar: I are happy.' })
    expect(screen.queryByText(/Aivana MMI|Gemini/)).not.toBeInTheDocument()
  })

  it('reveals the models after the vote, marks the pick, and offers the next question', async () => {
    mockBenchmarkApi()
    const user = await ask('Correct grammar: I are happy.', false) // Gemini is A, Aivana is B

    await user.click(await screen.findByRole('button', { name: '👉 B is better' }))

    expect(screen.getByRole('status')).toHaveTextContent('You picked Model B — Aivana MMI.')
    expect(panel('B')).toHaveClass('picked')
    expect(within(panel('B')).getByText('★ Your pick')).toBeInTheDocument()
    expect(panel('B')).toHaveTextContent('Model B = Aivana MMIaivana-mmi')
    expect(within(panel('B')).getByText('3.3 s · 0.000039 credits')).toBeInTheDocument()
    expect(panel('A')).toHaveTextContent('Model A = Geminigemini-3.5-flash-lite')
    expect(within(panel('A')).getByText('75.9 s · $0.0000924')).toBeInTheDocument()
    expect(screen.queryByText('Which answer is better?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ask another question' }))
    expect(screen.queryByRole('region', { name: 'Model A' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Ask a question/)).toHaveFocus())
  })

  it('says so for a tie, and counts every vote in the scoreboard', async () => {
    mockBenchmarkApi()
    const user = await ask('Hi')
    await user.click(await screen.findByRole('button', { name: '🤝 About the same' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'You called it about the same. Model A was Aivana MMI and Model B was Gemini.',
    )
    const score = screen.getByRole('region', { name: 'Your votes' })
    expect(score).toHaveTextContent('Your votes (1)')
    expect(score).toHaveTextContent('Aivana MMI 0Gemini 0About the same 1Both bad 0')
  })

  it('keeps the scoreboard across visits until it is reset', async () => {
    mockBenchmarkApi()
    const user = await ask('Hi')
    await user.click(await screen.findByRole('button', { name: '👈 A is better' })) // Aivana

    const { unmount } = render(<BenchmarkView />)
    expect(screen.getAllByRole('region', { name: 'Your votes' })[1]).toHaveTextContent('Aivana MMI 1')
    unmount()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.queryByRole('region', { name: 'Your votes' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('mmi-benchmark-votes')!)).toMatchObject({ aivana: 0, baseline: 0 })
  })

  it('does not take votes when a model failed, and names both models straight away', async () => {
    mockBenchmarkApi(() => [AIVANA, { ...GEMINI, text: null, error: 'Baseline model returned 503: high demand' }])
    const user = await ask('Hi') // Aivana is A

    expect(await within(panel('B')).findByText('Baseline model returned 503: high demand')).toBeInTheDocument()
    expect(within(panel('A')).getByText('I am happy.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /A is better/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("One model couldn't answer, so this round can't be voted on.")
    expect(panel('A')).toHaveTextContent('Model A = Aivana MMI')
    expect(panel('B')).toHaveTextContent('Model B = Gemini')

    await user.click(screen.getByRole('button', { name: 'Ask another question' }))
    expect(screen.getByLabelText(/Ask a question/)).toBeInTheDocument()
    expect(localStorage.getItem('mmi-benchmark-votes')).toBeNull()
  })

  it('reveals the models after a mock vote without counting it', async () => {
    mockBenchmarkApi(() => [
      { ...AIVANA, mock: true },
      { ...GEMINI, mock: true },
    ])
    const user = await ask('Hi')

    expect(await screen.findByRole('note')).toHaveTextContent("Votes aren't counted")
    await user.click(screen.getByRole('button', { name: '👈 A is better' }))
    expect(screen.getByRole('status')).toHaveTextContent('You picked Model A — Aivana MMI.')
    expect(screen.queryByRole('region', { name: 'Your votes' })).not.toBeInTheDocument()
    expect(localStorage.getItem('mmi-benchmark-votes')).toBeNull()
  })

  it('sends with Enter and fills the box from an example', async () => {
    const fetchMock = mockBenchmarkApi()
    const user = userEvent.setup()
    render(<BenchmarkView />)

    await user.click(screen.getByRole('button', { name: 'Correct grammar: I are happy.' }))
    expect(screen.getByLabelText(/Ask a question/)).toHaveValue('Correct grammar: I are happy.')
    await user.type(screen.getByLabelText(/Ask a question/), '{Enter}')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('goes back to the question box, with the message kept, when the request fails', async () => {
    mockBenchmarkApi(() => new Error('A comparison is already running. Wait for it to finish.'))
    await ask('Hello there')
    expect(await screen.findByRole('alert')).toHaveTextContent('A comparison is already running')
    expect(screen.getByLabelText(/Ask a question/)).toHaveValue('Hello there')
  })
})
