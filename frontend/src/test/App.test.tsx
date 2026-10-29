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
  company_logo: '',
}

const QUESTION = {
  id: 'q1',
  question: 'Tell me about a challenging software project.',
  type: 'behavioral' as const,
}

async function openJobSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Job Search' }))
}

/** Routes each API path to a canned response so tests never need a live backend. */
function mockApi(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/api/health': { status: 'ok', database: 'sqlite' },
    '/api/jobs/search': [JOB],
    '/api/jobs/fit-analysis': {
      match_score: 78,
      summary: 'Overall fit summary.',
      strengths: ['Strong Python experience'],
      gaps: ['Limited AWS experience'],
      recommendations: ['Review basic AWS services'],
    },
    '/api/interview/sessions': {
      session_id: 'session-test',
      company: 'Aivana',
      position: 'Engineer',
      mode: 'behavioral',
      status: 'active',
      current_question_index: 0,
      questions: [
        QUESTION,
        { id: 'q2', question: 'Tell me about another project.', type: 'behavioral' },
      ],
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
    if (/\/api\/interview\/sessions\/[^/]+\/answers/.test(url)) {
      const request = JSON.parse(String(init?.body)) as { question_index: number }
      const interview = routes['/api/interview/sessions'] as {
        session_id: string
        questions: Array<{ id: string; question: string; type: 'behavioral' }>
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          session_id: interview.session_id,
          question_index: request.question_index,
          question_id: interview.questions[request.question_index].id,
          current_question_index: request.question_index + 1,
          next_question: interview.questions[request.question_index + 1] ?? null,
          score: 8,
          feedback: 'Overall feedback.',
          strengths: ['Clear explanation'],
          areas_to_improve: ['Add measurable results'],
          improved_answer: 'I led a project and measured the outcome.',
        }),
      } as Response
    }
    const body = routes[url]
    if (body === undefined) throw new Error(`unmocked route: ${url}`)
    if (body instanceof Error) throw body
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

  it('switches to dark mode and remembers the choice', async () => {
    mockApi()
    localStorage.clear()
    document.documentElement.dataset.theme = 'light'
    const user = userEvent.setup()
    render(<App />)

    const toggle = screen.getByRole('button', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('reports an unreachable backend instead of crashing', async () => {
    mockApi({ '/api/health': new Error('network down') })
    render(<App />)
    expect(await screen.findByText(/backend unreachable/)).toBeInTheDocument()
  })

  it('renders search results and opens the first job’s fit analysis', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))

    // The title appears in both the result card and the fit panel, so check the list specifically.
    const list = await screen.findByRole('list', { name: 'Job results' })
    expect(within(list).getByText('Software Engineer Intern')).toBeInTheDocument()

    // The top result is analyzed automatically, with no extra click.
    expect(await screen.findByText('Overall fit summary.')).toBeInTheDocument()
    expect(screen.getByText(/Strong Python experience/)).toBeInTheDocument()
  })

  it('shows the company logo when the posting has one', async () => {
    mockApi({ '/api/jobs/search': [{ ...JOB, company_logo: 'https://example.com/logo.png' }] })
    const user = userEvent.setup()
    const { container } = render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    await screen.findByRole('list', { name: 'Job results' })

    expect(container.querySelector('img.job-logo-img')).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('analyzes whichever job the user clicks', async () => {
    const second = { ...JOB, id: 'job_002', title: 'Data Analyst Intern', company: 'Other Company' }
    const fetchMock = mockApi({ '/api/jobs/search': [JOB, second] })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    const list = await screen.findByRole('list', { name: 'Job results' })
    const secondCard = within(list).getByRole('button', { name: /Data Analyst Intern/ })
    await user.click(secondCard)

    expect(secondCard).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'Data Analyst Intern' })).toBeInTheDocument()

    await waitFor(() => {
      const bodies = fetchMock.mock.calls
        .filter(([url]) => url === '/api/jobs/fit-analysis')
        .map(([, init]) => JSON.parse(String(init?.body)))
      expect(bodies[bodies.length - 1].job.id).toBe('job_002')
    })
  })

  it('opens a behavioral interview from a fit analysis', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    await user.click(await screen.findByRole('button', { name: 'Practice interview' }))

    expect(screen.getByRole('button', { name: 'Behavioral Interview' })).toHaveAttribute('aria-current', 'page')
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

  it('sends the chosen filters with the search', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.selectOptions(screen.getByLabelText('Work arrangement'), 'Hybrid')
    await user.selectOptions(screen.getByLabelText('Experience level'), 'Entry level')
    await user.selectOptions(screen.getByLabelText('Employment type'), 'Internship')
    await user.type(screen.getByLabelText('Industry (optional)'), 'Healthcare')
    await user.type(screen.getByLabelText('Minimum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Search jobs' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/jobs/search')
      expect(call).toBeDefined()
      expect(JSON.parse(String(call![1]?.body))).toMatchObject({
        work_arrangement: 'hybrid',
        experience_level: 'entry',
        employment_type: 'internship',
        industry: 'Healthcare',
        salary_min: 50000,
        salary_max: null,
      })
    })
  })

  it('blocks a salary range where min is above max', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.type(screen.getByLabelText('Minimum salary'), '90000')
    await user.type(screen.getByLabelText('Maximum salary'), '50000')
    await user.click(screen.getByRole('button', { name: 'Search jobs' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Minimum salary/)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/jobs/search')).toBe(false)
  })

  it('surfaces a search error to the user', async () => {
    mockApi({ '/api/jobs/search': new Error('500 Internal Server Error') })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(screen.getByRole('button', { name: 'Search jobs' }))
    expect(await screen.findByText(/500 Internal Server Error/)).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText(/Overall feedback\./)).toBeInTheDocument()
  })

  it('keeps each question’s answer separate', async () => {
    mockApi({
      '/api/interview/sessions': {
        session_id: 'session-test',
        company: 'Aivana',
        position: 'Engineer',
        mode: 'behavioral',
        status: 'active',
        current_question_index: 0,
        questions: [
          QUESTION,
          { id: 'q2', question: 'Tell me about another project.', type: 'behavioral' },
        ],
      },
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Behavioral Interview' }))
    const setup = screen.getByRole('region', { name: 'Behavioral Interview Setup' })
    await user.type(within(setup).getByLabelText('Company'), 'Aivana')
    await user.type(within(setup).getByLabelText('Position / Job Title'), 'Engineer')
    await user.click(within(setup).getByRole('button', { name: 'Start Interview' }))

    const first = await screen.findByLabelText('Your Answer')
    await user.type(first, 'Only for the first question')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    const second = await screen.findByLabelText('Your Answer')

    expect(second).toHaveValue('')
  })
})
