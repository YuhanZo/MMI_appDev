import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelRun } from '../../types'
import BenchmarkView from './BenchmarkView'

const ANSWER = { summary: 'Partial fit.', strengths: ['Python'], gaps: ['AWS'], recommendations: ['Learn AWS'] }

const AIVANA: ModelRun = {
  system: 'aivana',
  model: 'aivana-mmi',
  mock: false,
  answer: ANSWER,
  format_ok: true,
  latency_ms: 13400,
  cost: 0.000243,
  cost_unit: 'credits',
  input_tokens: 120,
  output_tokens: 80,
  error: null,
  request_id: 'req_1',
}

const BASELINE: ModelRun = {
  ...AIVANA,
  system: 'baseline',
  model: 'gemini-3.5-flash',
  answer: null,
  format_ok: false,
  latency_ms: 2100,
  cost: 0.00005,
  cost_unit: 'usd',
  request_id: null,
}

function mockBenchmarkApi(runs: ModelRun[] | Error = [AIVANA, BASELINE]) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url !== '/api/benchmark/run') throw new Error(`unmocked route: ${url}`)
    if (runs instanceof Error) return new Response(JSON.stringify({ detail: { message: runs.message } }), { status: 429 })
    return new Response(JSON.stringify({ runs }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function runBenchmark() {
  const user = userEvent.setup()
  render(<BenchmarkView />)
  await user.click(screen.getByRole('button', { name: 'Run benchmark' }))
  await screen.findByRole('region', { name: 'Aivana MMI' })
  return user
}

async function rateAndSave(user: ReturnType<typeof userEvent.setup>, aivana: number, gemini: number) {
  await user.click(within(screen.getByRole('region', { name: 'Aivana MMI' })).getByLabelText(String(aivana)))
  await user.click(within(screen.getByRole('region', { name: 'Gemini' })).getByLabelText(String(gemini)))
  await user.click(screen.getByRole('button', { name: 'Save run' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('BenchmarkView', () => {
  it('sends the chosen sample job with the saved profile', async () => {
    const fetchMock = mockBenchmarkApi()
    const user = userEvent.setup()
    render(<BenchmarkView />)

    await user.selectOptions(screen.getByLabelText('Job'), 'Data Analyst Intern · Scarlet Analytics')
    await user.click(screen.getByRole('button', { name: 'Run benchmark' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.job.title).toBe('Data Analyst Intern')
    expect(Object.keys(body.user_profile)).toEqual(expect.arrayContaining(['skills', 'education', 'experience']))
  })

  it('names each model and shows its speed, cost, format and tokens', async () => {
    mockBenchmarkApi()
    await runBenchmark()

    const [first, second] = screen.getAllByRole('region').filter((r) => r.classList.contains('bench-card'))
    expect(first).toHaveAccessibleName('Aivana MMI')
    expect(second).toHaveAccessibleName('Gemini')

    const aivana = screen.getByRole('region', { name: 'Aivana MMI' })
    const gemini = screen.getByRole('region', { name: 'Gemini' })
    expect(within(aivana).getByText('aivana-mmi')).toBeInTheDocument()
    expect(within(aivana).getByText('13.4 s')).toBeInTheDocument()
    expect(within(aivana).getByText('0.000243 credits')).toBeInTheDocument()
    expect(within(aivana).getByText('120 in / 80 out')).toBeInTheDocument()
    expect(within(aivana).getByText('Partial fit.')).toBeInTheDocument()
    expect(within(gemini).getByText('gemini-3.5-flash')).toBeInTheDocument()
    expect(within(gemini).getByText('2.1 s')).toBeInTheDocument()
    expect(within(gemini).getByText('$0.00005')).toBeInTheDocument()
    expect(within(gemini).getByText('✗ Didn’t match')).toBeInTheDocument()
  })

  it('saves the run once both answers are rated', async () => {
    mockBenchmarkApi()
    const user = await runBenchmark()
    expect(screen.getByRole('button', { name: 'Rate both answers to save' })).toBeDisabled()

    await rateAndSave(user, 4, 2)
    expect(screen.getByRole('button', { name: 'Saved to results' })).toBeDisabled()

    const results = screen.getByRole('region', { name: 'Benchmark results' })
    const [avg] = within(results).getAllByRole('table')
    expect(within(avg).getByRole('row', { name: /Aivana MMI/ })).toHaveTextContent(
      'Aivana MMI (aivana-mmi)113.4 s0.000243 credits100%4.0',
    )
    expect(within(avg).getByRole('row', { name: /Gemini/ })).toHaveTextContent(
      'Gemini (gemini-3.5-flash)12.1 s$0.000050%2.0',
    )
    expect(JSON.parse(localStorage.getItem('mmi-benchmark-history')!)).toHaveLength(1)
  })

  it('keeps the results across visits until cleared', async () => {
    mockBenchmarkApi()
    const user = await runBenchmark()
    await rateAndSave(user, 5, 3)

    const { unmount } = render(<BenchmarkView />)
    expect(screen.getAllByRole('region', { name: 'Benchmark results' })).toHaveLength(2)
    unmount()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('region', { name: 'Benchmark results' })).not.toBeInTheDocument()
    expect(localStorage.getItem('mmi-benchmark-history')).toBe('[]')
  })

  it('leaves mock runs out of the averages and says the numbers are placeholders', async () => {
    mockBenchmarkApi([
      { ...AIVANA, mock: true },
      { ...BASELINE, mock: true },
    ])
    const user = await runBenchmark()
    expect(screen.getByRole('note')).toHaveTextContent('Mock mode')

    await rateAndSave(user, 3, 3)

    const [avg] = within(screen.getByRole('region', { name: 'Benchmark results' })).getAllByRole('table')
    expect(within(avg).getByRole('row', { name: /Aivana MMI/ })).toHaveTextContent('Aivana MMI (aivana-mmi)0————')
  })

  it('shows why a benchmark failed', async () => {
    mockBenchmarkApi(new Error('A benchmark is already running. Wait for it to finish.'))
    const user = userEvent.setup()
    render(<BenchmarkView />)
    await user.click(screen.getByRole('button', { name: 'Run benchmark' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A benchmark is already running')
  })
})
