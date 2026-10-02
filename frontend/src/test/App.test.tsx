import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

const JOB = {
  id: 'job_001',
  title: 'Software Engineer Intern',
  company: 'Example Company',
  location: 'Columbus, OH',
  description: 'Build backend services using Python and AWS.',
  url: 'https://example.com/job/001',
}

const QUESTION = {
  id: 'q1',
  question: 'Tell me about a challenging software project.',
  type: 'behavioral' as const,
}

/** Routes each API path to a canned response so tests never need a live backend. */
function mockApi(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/api/health': { status: 'ok', database: 'sqlite' },
    '/api/jobs/search': [JOB],
    '/api/jobs/fit-analysis': {
      summary: 'Overall fit summary.',
      strengths: ['Strong Python experience'],
      gaps: ['Limited AWS experience'],
      recommendations: ['Review basic AWS services'],
    },
    '/api/interview/questions': [QUESTION],
    '/api/interview/feedback': {
      summary: 'Overall feedback.',
      strengths: ['Clear explanation'],
      improvements: ['Add measurable results'],
    },
    ...overrides,
  }

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    void init
    const body = routes[url]
    if (body === undefined) throw new Error(`unmocked route: ${url}`)
    if (body instanceof Error) throw body
    if (body instanceof Promise) {
      const resolved = await body
      return { ok: true, status: 200, statusText: 'OK', json: async () => resolved } as Response
    }
    return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('shows backend status once health responds', async () => {
    mockApi()
    render(<App />)
    expect(await screen.findByText(/Backend: ok \(db: sqlite\)/)).toBeInTheDocument()
  })

  it('reports an unreachable backend instead of crashing', async () => {
    mockApi({ '/api/health': new Error('network down') })
    render(<App />)
    expect(await screen.findByText(/backend unreachable/)).toBeInTheDocument()
  })

  it('renders search results and then a fit analysis', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Software Engineer Intern')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Analyze fit' }))
    expect(await screen.findByText('Overall fit summary.')).toBeInTheDocument()
    expect(screen.getByText(/Strong Python experience/)).toBeInTheDocument()
  })

  it('shows Analyzing… and blocks other analyses while one runs', async () => {
    let finish!: (v: unknown) => void
    const pending = new Promise((resolve) => (finish = resolve))
    mockApi({
      '/api/jobs/search': [JOB, { ...JOB, id: 'job_002', title: 'Frontend Developer Intern' }],
      '/api/jobs/fit-analysis': pending,
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Search' }))
    const [first] = await screen.findAllByRole('button', { name: 'Analyze fit' })
    await user.click(first)

    expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Analyze fit' })).toBeDisabled()

    finish({ summary: 'Done.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('Done.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Analyze fit' })).toHaveLength(2)
    screen.getAllByRole('button', { name: 'Analyze fit' }).forEach((b) => expect(b).toBeEnabled())
  })

  it('sends the search request in the shared data format', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/jobs/search')
      expect(call).toBeDefined()
      expect(JSON.parse(String(call![1]?.body))).toEqual({
        role: 'Software Engineer Intern',
        location: 'Columbus, OH',
        remote: true,
      })
    })
  })

  it('surfaces a search error to the user', async () => {
    mockApi({ '/api/jobs/search': new Error('500 Internal Server Error') })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/500 Internal Server Error/)).toBeInTheDocument()
  })

  it('runs a question -> answer -> feedback round trip', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Mock Interview' }))
    expect(await screen.findByText(/Tell me about a challenging software project/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your answer'), 'I led a project that...')
    await user.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(await screen.findByText(/Overall feedback\./)).toBeInTheDocument()
  })

  it('keeps each question’s answer separate', async () => {
    mockApi({
      '/api/interview/questions': [
        QUESTION,
        { id: 'q2', question: 'How would you design a REST API for job search?', type: 'technical' },
      ],
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Mock Interview' }))
    const [first, second] = await screen.findAllByLabelText('Your answer')
    await user.type(first, 'Only for the first question')

    expect(first).toHaveValue('Only for the first question')
    expect(second).toHaveValue('')
  })
})
