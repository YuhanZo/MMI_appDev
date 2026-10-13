import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import ProfileView from './ProfileView'
import { PROFILE_STORAGE_KEY } from './profileStorage'

beforeEach(() => localStorage.clear())

describe('ProfileView', () => {
  it('shows all profile cards using mock data', () => {
    render(<ProfileView />)

    expect(screen.getByRole('heading', { name: 'About Me' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skills & Experience' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Preferences' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Priorities' })).toBeInTheDocument()
    expect(screen.getByText('The Ohio State University')).toBeInTheDocument()
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Career Growth')).toBeInTheDocument()
  })

  it('edits skills, experience, preferences, and priorities and saves them locally', async () => {
    const user = userEvent.setup()
    const view = render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    await user.clear(screen.getByLabelText('University'))
    await user.type(screen.getByLabelText('University'), 'Ohio State')
    await user.type(screen.getByLabelText('Add a skill'), 'TypeScript')
    await user.click(screen.getByRole('button', { name: 'Add Skill' }))
    await user.click(screen.getByRole('button', { name: 'Remove Java' }))
    await user.clear(screen.getByLabelText('Experience Summary'))
    await user.type(screen.getByLabelText('Experience Summary'), 'Built accessible React applications.')
    await user.clear(screen.getByLabelText('Target Role'))
    await user.type(screen.getByLabelText('Target Role'), 'Frontend Engineer')
    await user.click(screen.getByRole('radio', { name: 'Remote' }))
    await user.click(screen.getByRole('checkbox', { name: 'Salary' }))
    await user.click(screen.getByRole('checkbox', { name: 'Location' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(screen.queryByLabelText('University')).not.toBeInTheDocument()
    expect(screen.getByText('Ohio State')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.queryByText('Java')).not.toBeInTheDocument()
    expect(screen.getByText('Built accessible React applications.')).toBeInTheDocument()
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Remote')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toContain('Frontend Engineer')

    view.unmount()
    render(<ProfileView />)
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('prevents selecting more than three career priorities', async () => {
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))

    expect(screen.getByRole('checkbox', { name: 'Location' })).toBeDisabled()
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Salary' }))
    expect(screen.getByRole('checkbox', { name: 'Location' })).toBeEnabled()
  })

  it('discards draft changes when editing is cancelled', async () => {
    const user = userEvent.setup()
    render(<ProfileView />)

    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    await user.clear(screen.getByLabelText('Target Role'))
    await user.type(screen.getByLabelText('Target Role'), 'Discarded Role')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.queryByText('Discarded Role')).not.toBeInTheDocument()
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull()
  })
})
