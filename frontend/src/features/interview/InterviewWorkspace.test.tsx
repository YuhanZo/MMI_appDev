import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InterviewWorkspace from './InterviewWorkspace'

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

function mockInterviewApi(options: { failFeedback?: boolean; failSession?: boolean; slowFeedback?: boolean } = {}) {
  let sessionNumber = 0
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
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

async function startInterview(mode: 'behavioral' | 'technical') {
  const user = userEvent.setup()
  render(<InterviewWorkspace mode={mode} onTryOtherMode={vi.fn()} />)
  await user.type(screen.getByLabelText('Company'), 'Aivana')
  await user.type(screen.getByLabelText('Position / Job Title'), 'Engineer')
  await user.click(screen.getByRole('button', { name: 'Start Interview' }))
  return user
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('InterviewWorkspace', () => {
  it('opens a fixed behavioral setup without a mode switch', async () => {
    const fetchMock = mockInterviewApi()
    render(<InterviewWorkspace mode="behavioral" onTryOtherMode={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Behavioral Interview Setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Technical Interview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Interview' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
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
    await user.click(screen.getByRole('button', { name: 'Start Interview' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('500 Error')
    expect(screen.getByLabelText('Company')).toHaveValue('Aivana')
    expect(screen.getByLabelText('Position / Job Title')).toHaveValue('Engineer')
    expect(screen.getByRole('heading', { name: 'Behavioral Interview Setup' })).toBeInTheDocument()
  })

  it('returns to a cleared setup screen', async () => {
    mockInterviewApi()
    const user = await startInterview('technical')
    await screen.findByText('Technical question 1')
    await user.click(screen.getByRole('button', { name: 'Back to Interview Setup' }))

    expect(screen.getByRole('heading', { name: 'Technical Interview Setup' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Start Interview' }))

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
