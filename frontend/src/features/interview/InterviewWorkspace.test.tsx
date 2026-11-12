import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_CAREER_PROFILE, PROFILE_STORAGE_KEY } from '../profile/profileStorage'
import InterviewSummary from './InterviewSummary'
import InterviewWorkspace from './InterviewWorkspace'
import { startOfWeek } from './weeklyGoal'

const BEHAVIORAL_QUESTIONS = Array.from({ length: 5 }, (_, index) => ({
  id: `behavioral-${index + 1}`,
  question: `Behavioral question ${index + 1}`,
  type: 'behavioral' as const,
}))

const TECHNICAL_QUESTIONS = Array.from({ length: 5 }, (_, index) => ({
  id: `technical-${index + 1}`,
  question: `Technical question ${index + 1}`,
  type: 'technical' as const,
}))

const GENERATED_FEEDBACK = {
  score: 8,
  feedback: 'Clear example with good ownership.',
  strengths: ['Clear context'],
  areas_to_improve: ['Add a metric'],
  improved_answer: 'A stronger example answer.',
}

const SUMMARY = {
  session_id: 'session-behavioral-1',
  overall_evaluation: 'Strong prototype session.',
  strong_areas: ['Communication'],
  areas_to_improve: ['More metrics'],
  total_score: 40,
  average_score: 8,
  question_results: Array.from({ length: 5 }, (_, index) => ({
    question: `Behavioral question ${index + 1}`,
    answer: `Answer ${index + 1}`,
    score: 8,
    feedback: `Stored feedback ${index + 1}`,
  })),
  suggested_next_steps: ['Practice concise answers'],
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', json: async () => body } as Response
}

const ROLE = { id: 'role-1', title: 'Engineer', company: 'Aivana', location: 'Remote', description: '', url: '', company_logo: '', posted_at: '2 days ago' }
// JSearch also returns other companies' jobs; the setup leaves those out.
const OTHER_COMPANY = { ...ROLE, id: 'role-2', company: 'Other Company' }

function mockInterviewApi(
  options: {
    failFeedback?: boolean
    failSession?: boolean
    slowFeedback?: boolean
    roles?: unknown[] | Error
    weekCounts?: number[] // successive "this week" answers to the stats request
    total?: number
  } = {},
) {
  let sessionNumber = 0
  const weekCounts = [...(options.weekCounts ?? [2])]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/interview/stats?')) {
      const completed = weekCounts.length > 1 ? weekCounts.shift()! : weekCounts[0]
      return jsonResponse({ mode: new URL(url, 'http://x').searchParams.get('mode'), completed, total: options.total ?? 7 })
    }
    if (url === '/api/jobs/search') {
      if (options.roles instanceof Error) return jsonResponse({}, false)
      return jsonResponse(options.roles ?? [ROLE, OTHER_COMPANY])
    }
    if (url === '/api/interview/sessions') {
      if (options.failSession) return jsonResponse({}, false)
      sessionNumber += 1
      const body = JSON.parse(String(init?.body)) as {
        company: string
        position: string
        mode: 'behavioral' | 'technical'
      }
      const questions = body.mode === 'behavioral' ? BEHAVIORAL_QUESTIONS : TECHNICAL_QUESTIONS
      return jsonResponse({
        session_id: `session-${body.mode}-${sessionNumber}`,
        company: body.company,
        position: body.position,
        mode: body.mode,
        status: 'active',
        current_question_index: 0,
        questions,
      })
    }
    if (/\/api\/interview\/sessions\/[^/]+\/summary/.test(url)) {
      return jsonResponse(SUMMARY)
    }
    if (/\/api\/interview\/sessions\/[^/]+\/answers/.test(url)) {
      if (options.failFeedback) return jsonResponse({}, false)
      if (options.slowFeedback) await new Promise((resolve) => setTimeout(resolve, 25))
      const body = JSON.parse(String(init?.body)) as { question_index: number }
      const technical = url.includes('technical')
      const questions = technical ? TECHNICAL_QUESTIONS : BEHAVIORAL_QUESTIONS
      return jsonResponse({
        session_id: technical ? 'session-technical-1' : 'session-behavioral-1',
        question_index: body.question_index,
        question_id: `${technical ? 'technical' : 'behavioral'}-${body.question_index + 1}`,
        current_question_index: body.question_index + 1,
        next_question: questions[body.question_index + 1] ?? null,
        ...GENERATED_FEEDBACK,
      })
    }
    throw new Error(`unmocked route: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Looks up what was typed and starts the interview for the first role found. */
async function startForFoundRole(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Find this role' }))
  await user.click(await screen.findByRole('button', { name: 'Start interview for this role' }))
}

async function startInterview(mode: 'behavioral' | 'technical') {
  const user = userEvent.setup()
  render(<InterviewWorkspace mode={mode} onTryOtherMode={vi.fn()} />)
  await user.type(screen.getByLabelText('Company'), 'Aivana')
  await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
  await startForFoundRole(user)
  return user
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('InterviewWorkspace', () => {
  it('opens a fixed behavioral setup without a mode switch', async () => {
    const fetchMock = mockInterviewApi()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Behavioral Interview Setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Technical Interview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find this role' })).toBeDisabled()
    expect(screen.getByText('No Resume Uploaded')).toBeInTheDocument()
    // Only this week's count is loaded; nothing else until the role is looked up.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/interview\/stats\?mode=behavioral&since=/)
  })

  it('shows current profile resume status and sends resume text only when uploaded', async () => {
    const fetchMock = mockInterviewApi()
    const profile = {
      ...MOCK_CAREER_PROFILE,
      resumeText: 'Built a Python API and reduced latency by 30%.',
      resumeFileName: 'resume.pdf',
    }
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    const user = userEvent.setup()
    const { rerender } = render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)

    expect(screen.getByText('Resume Uploaded')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await startForFoundRole(user)

    const createCall = fetchMock.mock.calls.find(([url]) => url === '/api/interview/sessions')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      company: 'Aivana',
      position: 'Engineer',
      mode: 'behavioral',
      resume_text: 'Built a Python API and reduced latency by 30%.',
    })

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...profile, resumeText: '', resumeFileName: '' }))
    rerender(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Back to Interview Setup' }))
    expect(screen.getByText('No Resume Uploaded')).toBeInTheDocument()
  })

  it('renders resume-based feedback only when the summary contains it', () => {
    const { rerender } = render(
      <InterviewSummary
        mode="behavioral"
        summary={{ ...SUMMARY, resume_based_feedback: ['Emphasize the 30% latency improvement.'] }}
        onTryOtherMode={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Resume-Based Feedback' })).toBeInTheDocument()
    expect(screen.getByText('Emphasize the 30% latency improvement.')).toBeInTheDocument()

    rerender(<InterviewSummary mode="behavioral" summary={SUMMARY} onTryOtherMode={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: 'Resume-Based Feedback' })).not.toBeInTheDocument()
  })

  it('shows all five questions as pending before any answer is evaluated', async () => {
    mockInterviewApi()
    await startInterview('behavioral')

    const progress = await screen.findByRole('complementary', { name: 'Interview progress' })
    expect(within(progress).getByText('Question 1 of 5')).toBeInTheDocument()
    expect(within(progress).getAllByText('Pending')).toHaveLength(5)
    expect(within(progress).getByText('0/50')).toBeInTheDocument()
  })

  it('updates the completed question and total score after feedback returns', async () => {
    mockInterviewApi()
    const user = await startInterview('behavioral')

    await user.type(await screen.findByLabelText('Your Answer'), 'I helped the team align.')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByText('Behavioral question 2')

    const progress = screen.getByRole('complementary', { name: 'Interview progress' })
    expect(within(progress).getByText('Question 2 of 5')).toBeInTheDocument()
    expect(within(progress).getByText('8/10')).toBeInTheDocument()
    expect(within(progress).getAllByText('Pending')).toHaveLength(4)
    expect(within(progress).getByText('8/50')).toBeInTheDocument()
  })

  it('sends an answer, renders ordered chat feedback, and automatically shows the next question', async () => {
    const fetchMock = mockInterviewApi()
    const user = await startInterview('behavioral')

    expect(await screen.findByText('Behavioral question 1')).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(([url]) => url === '/api/interview/sessions')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      company: 'Aivana',
      position: 'Engineer',
      mode: 'behavioral',
    })
    await user.type(screen.getByLabelText('Your Answer'), 'I helped the team align.')
    expect(screen.queryByRole('button', { name: /Next Question|Previous/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Score: 8/10')).toBeInTheDocument()
    expect(screen.getByText('Clear example with good ownership.')).toBeInTheDocument()
    expect(screen.getByText('Behavioral question 2')).toBeInTheDocument()
    const conversation = screen.getByLabelText('Interview conversation').textContent ?? ''
    expect(conversation.indexOf('Behavioral question 1')).toBeLessThan(conversation.indexOf('I helped the team align.'))
    expect(conversation.indexOf('I helped the team align.')).toBeLessThan(conversation.indexOf('Clear example with good ownership.'))
    expect(conversation.indexOf('Clear example with good ownership.')).toBeLessThan(conversation.indexOf('Behavioral question 2'))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/answers'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      question_index: 0,
      answer: 'I helped the team align.',
      answer_type: 'text',
      language: null,
    })
  })

  it('supports technical code answers and language selection', async () => {
    const fetchMock = mockInterviewApi()
    const user = await startInterview('technical')

    expect(await screen.findByText('Technical question 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Code' }))
    await user.selectOptions(screen.getByLabelText('Programming Language'), 'JavaScript')
    await user.click(screen.getByLabelText('Code Answer'))
    await user.paste('const stack = []')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Score: 8/10')).toBeInTheDocument()
    expect(screen.getByText('const stack = []')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/answers'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      question_index: 0,
      answer: 'const stack = []',
      answer_type: 'code',
      language: 'JavaScript',
    })
  })

  it('preserves the answer and shows an alert when feedback fails', async () => {
    mockInterviewApi({ failFeedback: true })
    const user = await startInterview('behavioral')

    const answer = await screen.findByLabelText('Your Answer')
    await user.type(answer, 'Keep this answer')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('500 Error')
    expect(answer).toHaveValue('Keep this answer')
  })

  it('prevents duplicate sends while MMI feedback is loading', async () => {
    const fetchMock = mockInterviewApi({ slowFeedback: true })
    const user = await startInterview('behavioral')
    await user.type(await screen.findByLabelText('Your Answer'), 'One answer')

    const send = screen.getByRole('button', { name: 'Send' })
    const submitting = user.click(send)
    const evaluating = await screen.findByRole('button', { name: 'Evaluating...' })
    expect(evaluating).toBeDisabled()
    await user.click(evaluating)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/answers'))).toHaveLength(1)
    await submitting
    expect(await screen.findByText('Behavioral question 2')).toBeInTheDocument()
  })

  it('keeps setup values when question generation fails', async () => {
    mockInterviewApi({ failSession: true })
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)

    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await startForFoundRole(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('500 Error')
    expect(screen.getByLabelText('Company')).toHaveValue('Aivana')
    expect(screen.getByLabelText('Position / Job Title')).toHaveValue('Engineer')
    expect(screen.getByRole('region', { name: 'Behavioral Interview Setup' })).toBeInTheDocument()
  })

  it("shows this week's completed interviews against the goal, and counts a finished one", async () => {
    const fetchMock = mockInterviewApi({ weekCounts: [2, 3] })
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)

    const stat = screen.getByLabelText('Completed this week')
    await waitFor(() => expect(stat).toHaveTextContent('This week2/5'))
    expect(screen.getByLabelText('Solved in total')).toHaveTextContent('Solved7')
    const since = new URL(String(fetchMock.mock.calls[0][0]), 'http://x').searchParams.get('since')!
    expect(new Date(since).getTime()).toBe(startOfWeek().getTime())

    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await startForFoundRole(user)
    for (let index = 1; index <= 5; index += 1) {
      await user.type(await screen.findByLabelText('Your Answer'), `Answer ${index}`)
      await user.click(screen.getByRole('button', { name: 'Send' }))
    }
    await screen.findByRole('heading', { name: 'Interview Complete' })
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/interview/stats'))).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: 'Back to Interview Setup' }))
    expect(screen.getByLabelText('Completed this week')).toHaveTextContent('3/5')
  })

  it('marks the goal as met and shows a dash when the count is unavailable', async () => {
    mockInterviewApi({ weekCounts: [5] })
    const { unmount } = render(<InterviewWorkspace mode="technical" onTryOtherMode={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('5/5')).toHaveClass('met'))
    unmount()

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, false)))
    render(<InterviewWorkspace mode="technical" onTryOtherMode={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Completed this week')).toHaveTextContent('—'))
    expect(screen.getByLabelText('Solved in total')).toHaveTextContent('—')
  })

  it('starts the week on Monday in local time', () => {
    const wednesday = new Date(2026, 10, 11, 15, 30) // Wed 11 Nov 2026, 15:30
    expect(startOfWeek(wednesday)).toEqual(new Date(2026, 10, 9, 0, 0))
    const sunday = new Date(2026, 10, 15, 23, 59)
    expect(startOfWeek(sunday)).toEqual(new Date(2026, 10, 9, 0, 0))
  })

  it('lists the open roles found at that company and starts with the chosen one', async () => {
    const roles = [ROLE, { ...ROLE, id: 'role-3', title: 'Senior Engineer', location: 'Seattle, WA' }, OTHER_COMPANY]
    const fetchMock = mockInterviewApi({ roles })
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)
    await user.type(screen.getByLabelText('Company'), 'aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'engineer{Enter}') // Enter looks it up

    const list = await screen.findByRole('group', { name: /Found 2 open roles at Aivana/ })
    expect(within(list).getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual([
      'EngineerRemote · 2 days ago',
      'Senior EngineerSeattle, WA · 2 days ago',
    ])
    const search = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === '/api/jobs/search')![1]?.body))
    expect(search.job_functions).toEqual(['engineer at aivana'])

    await user.click(within(list).getByLabelText(/Senior Engineer/))
    await user.click(screen.getByRole('button', { name: 'Start interview for this role' }))
    await screen.findByText('Behavioral question 1')
    const session = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === '/api/interview/sessions')![1]?.body))
    expect(session).toMatchObject({ company: 'Aivana', position: 'Senior Engineer' }) // the posting's own names
  })

  it('does not start when no matching role is found', async () => {
    const fetchMock = mockInterviewApi({ roles: [OTHER_COMPANY] })
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)
    await user.type(screen.getByLabelText('Company'), 'microsoft')
    await user.type(screen.getByLabelText('Position / Job Title'), 'software')
    await user.click(screen.getByRole('button', { name: 'Find this role' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No open “software” roles found at “microsoft”')
    expect(screen.queryByRole('button', { name: 'Start interview for this role' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/interview/sessions')).toBe(false)
  })

  it('asks for a new lookup after what was typed changes', async () => {
    mockInterviewApi()
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)
    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await user.click(screen.getByRole('button', { name: 'Find this role' }))
    await screen.findByRole('button', { name: 'Start interview for this role' })

    await user.type(screen.getByLabelText('Position / Job Title'), 'ing')
    expect(screen.queryByRole('group', { name: /Found/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find this role' })).toBeEnabled()
  })

  it('explains when the lookup itself fails', async () => {
    mockInterviewApi({ roles: new Error('down') })
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)
    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await user.click(screen.getByRole('button', { name: 'Find this role' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't look up roles")
    expect(screen.getByRole('button', { name: 'Find this role' })).toBeEnabled() // can try again
  })

  it('returns to a cleared setup screen', async () => {
    mockInterviewApi()
    const user = await startInterview('technical')
    await screen.findByText('Technical question 1')
    await user.click(screen.getByRole('button', { name: 'Back to Interview Setup' }))

    expect(screen.getByRole('region', { name: 'Technical Interview Setup' })).toBeInTheDocument()
    expect(screen.getByLabelText('Company')).toHaveValue('')
    expect(screen.getByLabelText('Position / Job Title')).toHaveValue('')
  })

  it('completes five questions, shows the summary, and launches the other mode', async () => {
    const fetchMock = mockInterviewApi()
    const onTryOtherMode = vi.fn()
    const user = userEvent.setup()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={onTryOtherMode} />)

    await user.type(screen.getByLabelText('Company'), 'Aivana')
    await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
    await startForFoundRole(user)

    for (let index = 1; index <= 5; index += 1) {
      expect(await screen.findByText(`Behavioral question ${index}`)).toBeInTheDocument()
      await user.type(screen.getByLabelText('Your Answer'), `Answer ${index}`)
      await user.click(screen.getByRole('button', { name: 'Send' }))
    }

    expect(screen.getByRole('heading', { name: 'Interview Complete' })).toBeInTheDocument()
    expect(screen.getAllByText('Score: 8/10')).toHaveLength(5)
    expect(within(screen.getByRole('complementary', { name: 'Interview progress' })).getByText('40/50')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View Interview Summary' }))

    expect(await screen.findByText('Strong prototype session.')).toBeInTheDocument()
    expect(screen.getByText('40/50')).toBeInTheDocument()
    expect(screen.getByText('8/10')).toBeInTheDocument()
    expect(screen.getByText('Answer 1')).toBeInTheDocument()
    expect(screen.getByText('Stored feedback 1')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/interview/sessions/session-behavioral-1/summary',
      expect.objectContaining({ method: 'POST' }),
    )
    await user.click(screen.getByRole('button', { name: 'Try Technical Interview' }))
    expect(onTryOtherMode).toHaveBeenCalledWith('technical', 'Aivana', 'Engineer')
  })

  it('calls MMI session creation again when Generate 5 More Questions is clicked', async () => {
    const fetchMock = mockInterviewApi()
    const user = await startInterview('behavioral')

    for (let index = 1; index <= 5; index += 1) {
      await user.type(await screen.findByLabelText('Your Answer'), `Answer ${index}`)
      await user.click(screen.getByRole('button', { name: 'Send' }))
    }
    await user.click(await screen.findByRole('button', { name: 'Generate 5 More Questions' }))
    await screen.findByText('Behavioral question 1')

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/interview/sessions')).toHaveLength(2)
    const progress = screen.getByRole('complementary', { name: 'Interview progress' })
    expect(within(progress).getAllByText('Pending')).toHaveLength(5)
    expect(within(progress).getByText('0/50')).toBeInTheDocument()
  })
})

/** A stand-in for the browser's speech recognition; tests drive it by hand. */
class FakeRecognition {
  static last: FakeRecognition | null = null
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  stopped = false

  constructor() {
    FakeRecognition.last = this
  }

  start() {
    this.started = true
  }

  stop() {
    this.stopped = true
    this.onend?.()
  }

  abort() {
    this.stop()
  }

  /** Each pair is [transcript, isFinal]. */
  say(...parts: [string, boolean][]) {
    act(() => this.onresult?.({ results: parts.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })) }))
  }
}

describe('answering by voice', () => {
  afterEach(() => {
    FakeRecognition.last = null
  })

  it('types what is said into the answer, after what was already typed', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    mockInterviewApi()
    const user = await startInterview('behavioral')
    await user.type(await screen.findByLabelText('Your Answer'), 'In my internship,')

    await user.click(screen.getByRole('button', { name: 'Speak' }))
    const rec = FakeRecognition.last!
    expect(rec).toMatchObject({ started: true, lang: 'en-US', continuous: true, interimResults: true })
    expect(screen.getByRole('status')).toHaveTextContent('Listening…')

    rec.say(['I explained our cache', false]) // still being said: shown as it comes
    expect(screen.getByLabelText('Your Answer')).toHaveValue('In my internship, I explained our cache')
    rec.say(['I explained our caching design', true], [' to the sales team', false])
    expect(screen.getByLabelText('Your Answer')).toHaveValue(
      'In my internship, I explained our caching design to the sales team',
    )

    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(rec.stopped).toBe(true)
    expect(screen.getByRole('button', { name: 'Speak' })).toBeInTheDocument()
    expect(screen.queryByText('Listening…')).not.toBeInTheDocument()
  })

  it('stops listening when the answer is sent', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const fetchMock = mockInterviewApi()
    const user = await startInterview('behavioral')
    await screen.findByLabelText('Your Answer')

    await user.click(screen.getByRole('button', { name: 'Speak' }))
    FakeRecognition.last!.say(['I led the migration', true])
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(FakeRecognition.last!.stopped).toBe(true)
    await screen.findByText('Behavioral question 2')
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/answers'))
    expect(JSON.parse(String(call?.[1]?.body)).answer).toBe('I led the migration')
  })

  it('explains when the microphone is blocked', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    mockInterviewApi()
    const user = await startInterview('behavioral')
    await screen.findByLabelText('Your Answer')

    await user.click(screen.getByRole('button', { name: 'Speak' }))
    act(() => {
      FakeRecognition.last!.onerror?.({ error: 'not-allowed' })
      FakeRecognition.last!.onend?.()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone access was blocked')
    expect(screen.getByRole('button', { name: 'Speak' })).toBeEnabled() // can try again
  })

  it('is off where the browser has no speech recognition', async () => {
    mockInterviewApi()
    await startInterview('behavioral')
    await screen.findByLabelText('Your Answer')

    const speak = screen.getByRole('button', { name: 'Speak' })
    expect(speak).toBeDisabled()
    expect(speak).toHaveAttribute('title', expect.stringContaining("isn't supported in this browser"))
  })

  it('is not offered for code answers', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    mockInterviewApi()
    const user = await startInterview('technical')
    await screen.findByText('Technical question 1')
    expect(screen.getByRole('button', { name: 'Speak' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Code' }))
    expect(screen.queryByRole('button', { name: 'Speak' })).not.toBeInTheDocument()
  })
})
