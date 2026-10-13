import { render, screen, waitFor } from '@testing-library/react'
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

const BEHAVIORAL_FEEDBACK = {
  mode: 'behavioral',
  ai_feedback: 'Clear example with good ownership.',
  strengths: ['Clear context'],
  areas_to_improve: ['Add a metric'],
  star_structure: 'Situation and Task are clear.',
  improved_answer: 'A stronger example answer.',
}

const TECHNICAL_FEEDBACK = {
  mode: 'technical',
  assessment: 'Likely Correct',
  explanation: 'A stack is appropriate.',
  missing_points: ['Handle empty input'],
  time_complexity: 'O(n)',
  space_complexity: 'O(n)',
  suggested_solution: 'Push opening brackets and match closing brackets.',
}

const SUMMARY = {
  overall_performance: 'Strong prototype session.',
  strong_areas: ['Communication'],
  areas_to_improve: ['More metrics'],
  question_results: Array.from({ length: 5 }, (_, index) => ({
    question: `Question ${index + 1}`,
    result: `Result ${index + 1}`,
  })),
  suggested_next_steps: ['Practice concise answers'],
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', json: async () => body } as Response
}

function mockInterviewApi(options: { failFeedback?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/interview/questions?mode=behavioral') return jsonResponse(BEHAVIORAL_QUESTIONS)
    if (url === '/api/interview/questions?mode=technical') return jsonResponse(TECHNICAL_QUESTIONS)
    if (url === '/api/interview/summary?mode=behavioral' || url === '/api/interview/summary?mode=technical') {
      return jsonResponse(SUMMARY)
    }
    if (url === '/api/interview/detailed-feedback') {
      if (options.failFeedback) return jsonResponse({}, false)
      const body = JSON.parse(String(init?.body)) as { question_id: string }
      return jsonResponse(body.question_id.startsWith('behavioral') ? BEHAVIORAL_FEEDBACK : TECHNICAL_FEEDBACK)
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/interview/questions?mode=behavioral', expect.anything()))
  })

  it('starts a behavioral session and sends the detailed feedback request', async () => {
    const fetchMock = mockInterviewApi()
    const user = await startInterview('behavioral')

    expect(await screen.findByText('Behavioral question 1')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Your Answer'), 'I helped the team align.')
    await user.click(screen.getByRole('button', { name: 'Submit Answer' }))

    expect(await screen.findByText('Situation and Task are clear.')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/interview/detailed-feedback')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      question_id: 'behavioral-1',
      answer: 'I helped the team align.',
      answer_type: 'text',
      language: null,
      company: 'Aivana',
      position: 'Engineer',
    })
  })

  it('keeps answers when navigating between questions', async () => {
    mockInterviewApi()
    const user = await startInterview('behavioral')

    const answer = await screen.findByLabelText('Your Answer')
    await user.type(answer, 'Answer for question one')
    await user.click(screen.getByRole('button', { name: 'Next Question' }))
    expect(await screen.findByText('Behavioral question 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByLabelText('Your Answer')).toHaveValue('Answer for question one')
  })

  it('supports technical code answers and language selection', async () => {
    mockInterviewApi()
    const user = await startInterview('technical')

    expect(await screen.findByText('Technical question 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Code' }))
    await user.selectOptions(screen.getByLabelText('Programming Language'), 'JavaScript')
    await user.click(screen.getByLabelText('Code Answer'))
    await user.paste('const stack = []')
    await user.click(screen.getByRole('button', { name: 'Submit Answer' }))

    expect(await screen.findAllByText('O(n)')).toHaveLength(2)
    expect(screen.getByText(/Push opening brackets/)).toBeInTheDocument()
  })

  it('preserves the answer and shows an alert when feedback fails', async () => {
    mockInterviewApi({ failFeedback: true })
    const user = await startInterview('behavioral')

    const answer = await screen.findByLabelText('Your Answer')
    await user.type(answer, 'Keep this answer')
    await user.click(screen.getByRole('button', { name: 'Submit Answer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('500 Error')
    expect(answer).toHaveValue('Keep this answer')
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
      await user.click(screen.getByRole('button', { name: index === 5 ? 'Finish Interview' : 'Next Question' }))
    }

    expect(screen.getByRole('heading', { name: 'Interview Complete' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View Interview Summary' }))

    expect(await screen.findByText('Strong prototype session.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/interview/summary?mode=behavioral', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Try Technical Interview' }))
    expect(onTryOtherMode).toHaveBeenCalledWith('technical', 'Aivana', 'Engineer')
  })
})
