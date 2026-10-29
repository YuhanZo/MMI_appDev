import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { MOCK_CAREER_PROFILE } from '../features/profile/profileStorage'

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

/** The app opens on Home; job-search tests go to the Job Search view first, which searches with the default filters. */
async function openJobSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Job Search' }))
}

/** Opens a filter chip's popover by its heading. */
async function openFilter(user: ReturnType<typeof userEvent.setup>, heading: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${heading}:`) }))
  return screen.getByRole('dialog', { name: heading })
}

function searchBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/search').map(([, init]) => JSON.parse(String(init?.body)))
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
    // A function route answers each call separately (e.g. a different reply per call).
    const route = routes[url]
    const body = typeof route === 'function' ? route(init) : route
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

  it('renders search results and analyzes the top result', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

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

    expect(await screen.findByText('Analyzing your fit…')).toBeInTheDocument()
    const results = screen.getByRole('list', { name: 'Job results' })
    expect(within(results).getByRole('button', { pressed: true })).toBeInTheDocument()

    finish({ summary: 'Done.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('Done.')).toBeInTheDocument()
    expect(screen.queryByText('Analyzing your fit…')).not.toBeInTheDocument()
  })

  it('sends the saved profile with the fit analysis request', async () => {
    localStorage.setItem(
      'mmi-career-profile',
      JSON.stringify({ ...MOCK_CAREER_PROFILE, skills: ['Go', 'SQL'], experienceSummary: 'Two data internships.' }),
    )
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/jobs/fit-analysis')
      expect(call).toBeDefined()
      expect(JSON.parse(String(call![1]?.body)).user_profile).toEqual({
        skills: ['Go', 'SQL'],
        education: 'BS Computer Science, The Ohio State University, class of 2027',
        experience: 'Entry Level. Two data internships.',
      })
    })
    localStorage.clear()
  })

  it('starts a behavioral interview for the job from "Practice interview"', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await user.click(await screen.findByRole('button', { name: /Practice interview/ }))

    expect(await screen.findByText('Example Company · Software Engineer Intern')).toBeInTheDocument()
    expect(await screen.findByText(/Tell me about a challenging software project/)).toBeInTheDocument()
  })

  it('sends the search request in the shared data format', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)


    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/jobs/search')
      expect(call).toBeDefined()
      expect(JSON.parse(String(call![1]?.body))).toEqual({
        location: 'Columbus, OH',
        job_functions: ['Software Engineer Intern'],
        experience_levels: [],
        job_types: [],
        work_models: [],
      })
    })
  })

  it('shows the job, its posting link and details while the analysis is still running', async () => {
    mockApi({ '/api/jobs/fit-analysis': new Promise(() => {}) })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const panel = await screen.findByRole('complementary', { name: 'Fit analysis' })
    await within(panel).findByText('Analyzing your fit…')
    const title = within(panel).getByRole('link', { name: 'Software Engineer Intern' })
    expect(title).toHaveAttribute('href', JOB.url)
    expect(title).toHaveAttribute('target', '_blank')
    expect(within(panel).getByRole('link', { name: 'View posting' })).toHaveAttribute('href', JOB.url)
    expect(within(panel).getByRole('button', { name: /Practice interview/ })).toBeInTheDocument()

    const details = within(panel).getByText('About this job').closest('details')!
    expect(details).not.toHaveAttribute('open')
    await user.click(within(panel).getByText('About this job'))
    expect(details).toHaveAttribute('open')
    expect(within(details).getByText(JOB.description)).toBeVisible()
  })

  it('shows a plain title and no posting link when the posting has no URL', async () => {
    mockApi({ '/api/jobs/search': [{ ...JOB, url: '' }] })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const panel = await screen.findByRole('complementary', { name: 'Fit analysis' })
    expect(await within(panel).findByRole('heading', { name: 'Software Engineer Intern' })).toBeInTheDocument()
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument()
  })

  it('surfaces a search error to the user', async () => {
    mockApi({ '/api/jobs/search': new Error('500 Internal Server Error') })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

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

    expect(
      await screen.findByText("Couldn't analyze this job: Error: Aivana returned an invalid response (request req_42)"),
    ).toBeInTheDocument()
  })

  it('falls back to the status line when the error body is not JSON', async () => {
    mockApi({ '/api/jobs/fit-analysis': new HttpReply(502, 'Bad Gateway') })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    expect(await screen.findByText("Couldn't analyze this job: Error: 502 Bad Gateway")).toBeInTheDocument()
  })

  it('shows the company logo when the posting has one', async () => {
    mockApi({ '/api/jobs/search': [{ ...JOB, company_logo: 'https://example.com/logo.png' }] })
    const user = userEvent.setup()
    const { container } = render(<App />)
    await openJobSearch(user)

    await screen.findByRole('list', { name: 'Job results' })

    expect(container.querySelector('img.job-logo-img')).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('analyzes whichever job the user clicks', async () => {
    const second = { ...JOB, id: 'job_002', title: 'Data Analyst Intern', company: 'Other Company' }
    const fetchMock = mockApi({ '/api/jobs/search': [JOB, second] })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

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

  it('reuses a finished analysis instead of asking Aivana again', async () => {
    const second = { ...JOB, id: 'job_002', title: 'Data Analyst Intern', company: 'Other Company' }
    const fetchMock = mockApi({ '/api/jobs/search': [JOB, second] })
    const fitCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/fit-analysis').length
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const list = await screen.findByRole('list', { name: 'Job results' })
    await screen.findByText('Overall fit summary.') // first job analyzed automatically
    await user.click(within(list).getByRole('button', { name: /Data Analyst Intern/ }))
    await waitFor(() => expect(fitCalls()).toBe(2))

    await user.click(within(list).getByRole('button', { name: /Software Engineer Intern/ }))
    expect(await screen.findByText('Overall fit summary.')).toBeInTheDocument()
    expect(fitCalls()).toBe(2) // shown from the earlier result, no new request
  })

  it('joins an analysis already running for the same job instead of starting another', async () => {
    let finish!: (v: unknown) => void
    const fetchMock = mockApi({ '/api/jobs/fit-analysis': new Promise((resolve) => (finish = resolve)) })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const list = await screen.findByRole('list', { name: 'Job results' })
    await screen.findByText('Analyzing your fit…')
    await user.click(within(list).getByRole('button', { name: /Software Engineer Intern/ }))
    await user.click(within(list).getByRole('button', { name: /Software Engineer Intern/ }))

    finish({ summary: 'One answer.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('One answer.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/fit-analysis')).toHaveLength(1)
  })

  it("ignores a slow answer for the old profile once the profile changed", async () => {
    localStorage.clear()
    const replies: Array<(v: unknown) => void> = []
    mockApi({ '/api/jobs/fit-analysis': () => new Promise((resolve) => replies.push(resolve)) })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const list = await screen.findByRole('list', { name: 'Job results' })
    await waitFor(() => expect(replies).toHaveLength(1)) // analysis for the old profile, still running

    localStorage.setItem('mmi-career-profile', JSON.stringify({ ...MOCK_CAREER_PROFILE, skills: ['Go'] }))
    await user.click(within(list).getByRole('button', { name: /Software Engineer Intern/ }))
    // One analysis at a time: the new-profile analysis waits for the old one.
    expect(await screen.findByText('Waiting for the current analysis to finish…')).toBeInTheDocument()
    expect(replies).toHaveLength(1)

    replies[0]({ summary: 'For the old profile.', strengths: [], gaps: [], recommendations: [] })
    await waitFor(() => expect(replies).toHaveLength(2)) // the queued analysis starts
    expect(screen.queryByText('For the old profile.')).not.toBeInTheDocument() // stale: ignored

    replies[1]({ summary: 'For the new profile.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('For the new profile.')).toBeInTheDocument()
    expect(screen.queryByText('For the old profile.')).not.toBeInTheDocument()
    localStorage.clear()
  })

  it('analyzes again when a job with the same id comes back with new content', async () => {
    let searches = 0
    const fetchMock = mockApi({
      '/api/jobs/search': () => [{ ...JOB, description: searches++ === 0 ? 'Old description.' : 'Updated description.' }],
    })
    const fitBodies = () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/fit-analysis').map(([, init]) => JSON.parse(String(init?.body)))
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    await waitFor(() => expect(fitBodies()).toHaveLength(1))
    await user.click(within(await openFilter(user, 'Location')).getByRole('button', { name: 'Confirm' })) // same id, new description
    await waitFor(() => expect(fitBodies()).toHaveLength(2))
    expect(fitBodies()[1].job.description).toBe('Updated description.')
  })

  it('runs one analysis at a time and then analyzes only the last job clicked', async () => {
    const jobs = [JOB, { ...JOB, id: 'job_002', title: 'Data Analyst Intern' }, { ...JOB, id: 'job_003', title: 'QA Intern' }]
    const replies: Array<(v: unknown) => void> = []
    const fetchMock = mockApi({
      '/api/jobs/search': jobs,
      '/api/jobs/fit-analysis': () => new Promise((resolve) => replies.push(resolve)),
    })
    const fitJobs = () =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/fit-analysis').map(([, init]) => JSON.parse(String(init?.body)).job.id)
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const list = await screen.findByRole('list', { name: 'Job results' })
    await waitFor(() => expect(replies).toHaveLength(1)) // job_001 analyzing
    await user.click(within(list).getByRole('button', { name: /Data Analyst Intern/ }))
    await user.click(within(list).getByRole('button', { name: /QA Intern/ }))

    expect(screen.getByText('Waiting for the current analysis to finish…')).toBeInTheDocument()
    expect(fitJobs()).toEqual(['job_001']) // nothing else started yet

    replies[0]({ summary: 'First.', strengths: [], gaps: [], recommendations: [] })
    await waitFor(() => expect(fitJobs()).toEqual(['job_001', 'job_003'])) // job_002 skipped
    replies[1]({ summary: 'Last clicked.', strengths: [], gaps: [], recommendations: [] })
    expect(await screen.findByText('Last clicked.')).toBeInTheDocument()
  })

  it.each([
    ['the per-minute limit', 'rate_limit_exceeded', 'per-minute request limit reached'],
    ['the concurrency limit', null, 'Too many requests are running at once for this account. Retry when one finishes.'],
  ])('explains %s and lets the user retry', async (_label, code, message) => {
    let calls = 0
    const fit = { summary: 'After retry.', strengths: [], gaps: [], recommendations: [] }
    mockApi({
      '/api/jobs/fit-analysis': () =>
        calls++ === 0 ? new HttpReply(502, 'Bad Gateway', { detail: { message, code, request_id: 'req_9' } }) : fit,
    })
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Aivana is busy right now')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('After retry.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('analyzes again after the profile changes', async () => {
    localStorage.clear()
    const fetchMock = mockApi()
    const fitCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/jobs/fit-analysis').length
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const list = await screen.findByRole('list', { name: 'Job results' })
    await waitFor(() => expect(fitCalls()).toBe(1))

    localStorage.setItem('mmi-career-profile', JSON.stringify({ ...MOCK_CAREER_PROFILE, skills: ['Go'] }))
    await user.click(within(list).getByRole('button', { name: /Software Engineer Intern/ }))
    await waitFor(() => expect(fitCalls()).toBe(2))
    localStorage.clear()
  })

  it('searches again with the filters chosen in each chip', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)
    await waitFor(() => expect(searchBodies(fetchMock)).toHaveLength(1))

    let dialog = await openFilter(user, 'Experience Level')
    await user.click(within(dialog).getByLabelText('Intern/New Grad'))
    await user.click(within(dialog).getByLabelText('Entry Level'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    dialog = await openFilter(user, 'Work Model')
    await user.click(within(dialog).getByLabelText('Hybrid'))
    await user.click(within(dialog).getByLabelText('Onsite'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(searchBodies(fetchMock)).toHaveLength(3))
    expect(searchBodies(fetchMock)[2]).toMatchObject({
      experience_levels: ['intern', 'entry'],
      work_models: ['onsite', 'hybrid'], // in option order, not click order
      job_types: [],
    })
    expect(screen.getByRole('button', { name: 'Experience Level: Intern/New Grad (+1)' })).toHaveAttribute(
      'title',
      'Intern/New Grad, Entry Level',
    )
  })

  it('adds and removes job functions, and needs at least one', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)

    const dialog = await openFilter(user, 'Job Function')
    await user.type(within(dialog).getByLabelText('Enter a job function'), 'Backend Engineer{Enter}')
    await user.type(within(dialog).getByLabelText('Enter a job function'), 'Python Engineer') // added on Confirm
    await user.click(within(dialog).getByRole('button', { name: 'Remove Software Engineer Intern' }))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(searchBodies(fetchMock)).toHaveLength(2))
    expect(searchBodies(fetchMock)[1].job_functions).toEqual(['Backend Engineer', 'Python Engineer'])
    expect(screen.getByRole('button', { name: 'Job Function: Backend Engineer (+1)' })).toBeInTheDocument()

    const again = await openFilter(user, 'Job Function')
    await user.click(within(again).getByRole('button', { name: 'Remove Backend Engineer' }))
    await user.click(within(again).getByRole('button', { name: 'Remove Python Engineer' }))
    expect(within(again).getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })

  it('drops unconfirmed changes when the popover is closed with Escape', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<App />)
    await openJobSearch(user)
    await waitFor(() => expect(searchBodies(fetchMock)).toHaveLength(1))

    let dialog = await openFilter(user, 'Job Type')
    await user.click(within(dialog).getByLabelText('Internship'))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Job Type: Any' })).toHaveFocus()
    dialog = await openFilter(user, 'Job Type')
    expect(within(dialog).getByLabelText('Internship')).not.toBeChecked()
    expect(searchBodies(fetchMock)).toHaveLength(1)
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
