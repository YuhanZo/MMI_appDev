import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileView from './ProfileView'
import { MOCK_CAREER_PROFILE, PROFILE_STORAGE_KEY } from './profileStorage'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Answers POST /api/profile/resume with `reply`, or an error status. */
function mockResumeApi(reply: { filename: string; text: string; truncated: boolean } | { status: number; message: string }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url !== '/api/profile/resume') throw new Error(`unmocked route: ${url}`)
    if ('status' in reply) {
      return new Response(JSON.stringify({ detail: { message: reply.message, code: 'bad_resume' } }), { status: reply.status })
    }
    return new Response(JSON.stringify(reply), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const card = (title: string) => screen.getByRole('region', { name: title })
const overview = () => screen.getByRole('complementary', { name: 'Profile overview' })

describe('ProfileView', () => {
  it('shows an overview with what the student is looking for and how complete the profile is', () => {
    render(<ProfileView />)

    expect(within(overview()).getByText('Demo User')).toBeInTheDocument()
    expect(within(overview()).getByText('The Ohio State University · Class of 2027')).toBeInTheDocument()
    const lookingFor = within(overview()).getByRole('list', { name: 'Looking for' })
    expect(within(lookingFor).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Software Engineer',
      'Hybrid',
      'Columbus, OH',
    ])
    expect(within(overview()).getByRole('progressbar', { name: 'Profile 75% complete' })).toHaveAttribute('aria-valuenow', '75')
    expect(within(overview()).getByRole('button', { name: '+ Upload your resume (+25%)' })).toBeInTheDocument()

    for (const title of ['About Me', 'Skills & Experience', 'Career Preferences', 'Career Priorities', 'Resume']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('edits one card at a time and saves only when that card is saved', async () => {
    const user = userEvent.setup()
    const view = render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Skills & Experience' }))
    expect(screen.getByRole('button', { name: 'Edit Career Preferences' })).toBeDisabled() // one card at a time

    await user.type(screen.getByLabelText('Add a skill'), 'TypeScript')
    await user.click(screen.getByRole('button', { name: 'Add Skill' }))
    await user.click(screen.getByRole('button', { name: 'Remove Java' }))
    await user.clear(screen.getByLabelText('Experience Summary'))
    await user.type(screen.getByLabelText('Experience Summary'), 'Built accessible React applications.')
    await user.click(within(card('Skills & Experience')).getByRole('button', { name: 'Save' }))

    const skills = within(card('Skills & Experience')).getByRole('list', { name: 'Skills' })
    expect(within(skills).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Python', 'React', 'TypeScript'])
    expect(screen.getByText('Built accessible React applications.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Career Preferences' })).toBeEnabled()

    view.unmount()
    render(<ProfileView />)
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('updates the overview after saving preferences', async () => {
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Career Preferences' }))
    await user.clear(screen.getByLabelText('Target Role'))
    await user.type(screen.getByLabelText('Target Role'), 'Frontend Engineer')
    await user.click(screen.getByRole('radio', { name: 'Remote' }))
    await user.click(within(card('Career Preferences')).getByRole('button', { name: 'Save' }))

    expect(within(card('Career Preferences')).getByText('Frontend Engineer')).toBeInTheDocument()
    expect(within(overview()).getByRole('list', { name: 'Looking for' })).toHaveTextContent('Frontend EngineerRemoteColumbus, OH')
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toContain('Frontend Engineer')
  })

  it('discards a card’s changes when it is cancelled', async () => {
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Career Preferences' }))
    await user.clear(screen.getByLabelText('Target Role'))
    await user.type(screen.getByLabelText('Target Role'), 'Discarded Role')
    await user.click(within(card('Career Preferences')).getByRole('button', { name: 'Cancel' }))

    expect(screen.getAllByText('Software Engineer').length).toBeGreaterThan(0)
    expect(screen.queryByText('Discarded Role')).not.toBeInTheDocument()
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull()
  })

  it('allows at most three career priorities', async () => {
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Career Priorities' }))
    expect(screen.getByRole('checkbox', { name: 'Location' })).toBeDisabled()
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Salary' }))
    expect(screen.getByRole('checkbox', { name: 'Location' })).toBeEnabled()
  })

  it('opens the right card from the "still missing" list', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...MOCK_CAREER_PROFILE, skills: ['Python'] }))
    const user = userEvent.setup()
    render(<ProfileView />)

    expect(within(overview()).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
    await user.click(within(overview()).getByRole('button', { name: '+ Add at least 3 skills (+15%)' }))
    expect(screen.getByLabelText('Add a skill')).toBeInTheDocument()
    expect(card('Skills & Experience')).toHaveFocus()
  })

  it('uploads a chosen resume, shows it as ready and completes the profile', async () => {
    mockResumeApi({ filename: 'resume.pdf', text: 'Jane Doe\nPython developer', truncated: false })
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.upload(screen.getByLabelText('Resume file'), new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' }))

    const resume = card('Resume')
    expect(await within(resume).findByText('resume.pdf')).toBeInTheDocument()
    expect(within(resume).getByText('Ready')).toBeInTheDocument()
    expect(within(resume).getByRole('button', { name: 'Choose a new file' })).toBeInTheDocument()
    expect(within(overview()).getByText('Your profile is complete.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)!).resumeText).toBe('Jane Doe\nPython developer')

    await user.click(within(resume).getByText('Show the text fit analysis reads'))
    expect(within(resume).getByText(/Python developer/)).toBeVisible()
  })

  it('uploads a resume dropped on the drop area', async () => {
    const fetchMock = mockResumeApi({ filename: 'cv.docx', text: 'CV text', truncated: true })
    render(<ProfileView />)

    const drop = screen.getByTestId('resume-drop')
    const file = new File(['docx'], 'cv.docx')
    fireEvent.dragOver(drop, { dataTransfer: { files: [file] } })
    expect(drop).toHaveClass('dragging')
    fireEvent.drop(drop, { dataTransfer: { files: [file] } })

    expect(await within(card('Resume')).findByText('cv.docx')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(drop).not.toHaveClass('dragging')
    expect(screen.getByRole('status')).toHaveTextContent('only the first part of its text was kept')
  })

  it('shows why a resume could not be read, and removes an uploaded one', async () => {
    mockResumeApi({ status: 422, message: 'No text was found in this file.' })
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...MOCK_CAREER_PROFILE, resumeText: 'Old', resumeFileName: 'old.pdf' }))
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.upload(screen.getByLabelText('Resume file'), new File(['   '], 'blank.txt', { type: 'text/plain' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No text was found in this file.')
    expect(within(card('Resume')).getByText('old.pdf')).toBeInTheDocument() // still the old one

    await user.click(within(card('Resume')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(within(card('Resume')).queryByText('old.pdf')).not.toBeInTheDocument())
    expect(within(overview()).getByRole('button', { name: '+ Upload your resume (+25%)' })).toBeInTheDocument()
  })
})
