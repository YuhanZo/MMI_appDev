import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewHistoryItem } from '../../types'
import ProfileOverview from './ProfileOverview'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function mockHistory(reply: InterviewHistoryItem[] | 'error') {
  const fetchMock = vi.fn(async (url: string) => {
    if (!url.startsWith('/api/interview/history?since=')) throw new Error(`unmocked route: ${url}`)
    if (reply === 'error') return new Response('{}', { status: 500 })
    return new Response(JSON.stringify(reply), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const daysAgo = (n: number, scores: number[] = []): InterviewHistoryItem => {
  const at = new Date()
  at.setHours(12, 0, 0, 0)
  at.setDate(at.getDate() - n)
  return { started_at: at.toISOString(), mode: 'behavioral', answered: scores.length, completed: false, scores }
}

describe('ProfileOverview', () => {
  it('shows who the student is, their practice streaks and their scores', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 15, 18, 0))
    mockHistory([daysAgo(2, [6, 8]), daysAgo(1, [4]), daysAgo(0), daysAgo(0)])
    render(<ProfileOverview onEdit={() => {}} />)

    expect(within(screen.getByRole('region', { name: 'About you' })).getByText('Demo User')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '4 practice sessions in 2026' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Current streak' })).getByText('3 days')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Best streak' })).getByText('3 days')).toBeInTheDocument()
    expect(screen.getByText('Avg 6.0/10')).toBeInTheDocument()
    expect(screen.getByText('3 answers')).toBeInTheDocument()
  })

  it('opens the full profile from Edit Profile', async () => {
    mockHistory([])
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<ProfileOverview onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('No scores yet')).toBeInTheDocument()
  })

  it('says so when the history cannot be loaded', async () => {
    mockHistory('error')
    render(<ProfileOverview onEdit={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your practice history")
  })
})
