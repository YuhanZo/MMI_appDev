import { render, screen, waitFor, within } from '@testing-library/react'
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
  id: 'behavioral-1',
  question: 'Tell me about a challenging software project.',
  type: 'behavioral' as const,
}

const TECHNICAL_QUESTION = {
  id: 'technical-1',
  question: 'How would you design a REST API for job search?',
  type: 'technical' as const,
}

/** A non-2xx reply; `body` undefined means the body isn't JSON. */
class HttpReply {
  status: number
  statusText: string
  body?: unknown

  constructor(status: number, statusText: string, body?: unknown) {
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

/** The app opens on Home; job-search tests go to the Job Search view first. */
async function openJobSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Job Search' }))
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
    '/api/interview/questions': [QUESTION, TECHNICAL_QUESTION],
    '/api/interview/questions?mode=behavioral': [QUESTION],
    '/api/interview/questions?mode=technical': [TECHNICAL_QUESTION],
    '/api/interview/feedback': {
      summary: 'Overall feedback.',
      strengths: ['Clear explanation'],
      improvements: ['Add measurable results'],
    },
    '/api/interview/detailed-feedback': {
      mode: 'behavioral',
      ai_feedback: 'Overall feedback.',
      strengths: ['Clear explanation'],
      areas_to_improve: ['Add measurable results'],
      star_structure: 'Use a clearer result.',
      improved_answer: 'I led a project and measured the outcome.',
    },
    ...overrides,
  }

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    void init
    const body = routes[url]
    if (body === undefined) throw new Error(`unmocked route: ${url}`)
    if (body instanceof Error) throw body
    if (body instanceof HttpReply) {
      const json = async () => {
        if (body.body === undefined) throw new SyntaxError('Unexpected token <')
        return body.body
      }
      return { ok: false, status: body.status, statusText: body.statusText, json } as Response
    }
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
  localStorage.clear()
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

  it('renders search results and analyzes the top result', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    const results = await screen.findByRole('list', { name: 'Job results' })
    expect(within(results).getByText('Software Engineer Intern')).toBeInTheDocument()

    // The top result is analyzed right away.
    expect(await screen.findByText('Overall fit summary.')).toBeInTheDocument()
    expect(screen.getByText(/Strong Python experience/)).toBeInTheDocument()
  })

  it('shows "Analyzing your fit…" and marks the selected card while the analysis runs', async () => {
    let finish!: (v: unknown) => void
    const pending = new Promise((resolve) => (finish = resolve))
    mockApi({ '/api/jobs/fit-analysis': pending })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    expect(await screen.findByText('Analyzing your fit…')).toBeInTheDocument()
    const results = screen.getByRole('list', { name: 'Job results' })
    expect(within(results).getByRole('button', { pressed: true })).toBeInTheDocument()

    finish({ summary: 'Done.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('Done.')).toBeInTheDocument()
    expect(screen.queryByText('Analyzing your fit…')).not.toBeInTheDocument()
  })

  it('sends the search request in the shared data format', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/jobs/search')
      expect(call).toBeDefined()
      expect(JSON.parse(String(call![1]?.body))).toEqual({
        role: 'Software Engineer Intern',
        location: 'Columbus, OH',
        work_arrangement: 'any',
        experience_level: 'any',
        employment_type: 'any',
        salary_min: null,
        salary_max: null,
        industry: '',
      })
    })
  })

  it('surfaces a search error to the user', async () => {
    mockApi({ '/api/jobs/search': new Error('500 Internal Server Error') })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    expect(await screen.findByText(/Search failed: .*500 Internal Server Error/)).toBeInTheDocument()
  })

  it('shows the backend error message and request id when fit analysis fails', async () => {
    mockApi({
      '/api/jobs/fit-analysis': new HttpReply(502, 'Bad Gateway', {
        detail: { message: 'Aivana returned an invalid response', code: 'invalid_response', request_id: 'req_42' },
      }),
    })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    expect(
      await screen.findByText("Couldn't analyze this job: Error: Aivana returned an invalid response (request req_42)"),
    ).toBeInTheDocument()
  })

  it('falls back to the status line when the error body is not JSON', async () => {
    mockApi({ '/api/jobs/fit-analysis': new HttpReply(502, 'Bad Gateway') })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    expect(await screen.findByText("Couldn't analyze this job: Error: 502 Bad Gateway")).toBeInTheDocument()
  })

  it('runs a question -> answer -> feedback round trip', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Behavioral Interview' }))
    const setup = screen.getByRole('region', { name: 'Behavioral Interview Setup' })
    await user.type(within(setup).getByLabelText('Company'), 'Aivana')
    await user.type(within(setup).getByLabelText('Position / Job Title'), 'Engineer')
    await user.click(within(setup).getByRole('button', { name: 'Start Interview' }))
    expect(await screen.findByText(/Tell me about a challenging software project/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your Answer'), 'I led a project that...')
    await user.click(screen.getByRole('button', { name: 'Submit Answer' }))

    expect(await screen.findByText(/Overall feedback\./)).toBeInTheDocument()
  })

  it('opens the technical setup from its navigation item', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Technical Interview' }))
    expect(screen.getByRole('heading', { name: 'Technical Interview Setup' })).toBeInTheDocument()
  })

  it('opens the enhanced profile from the existing account menu', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'My Profile' }))

    expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skills & Experience' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Preferences' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Priorities' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument()
  })
})
