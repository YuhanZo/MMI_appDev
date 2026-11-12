import { useState } from 'react'
import * as api from '../../api'
import type { InterviewMode, Job } from '../../types'

const MAX_ROLES = 5

interface InterviewSetupProps {
  mode: InterviewMode
  company: string
  position: string
  hasResume: boolean
  starting: boolean
  onCompanyChange: (value: string) => void
  onPositionChange: (value: string) => void
  onStart: (company: string, position: string) => void
}

type Lookup =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; roles: Job[] }
  | { status: 'none' }
  | { status: 'error'; message: string }

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** "Microsoft Corporation" is Microsoft; "Microsoftie Labs" isn't a match for "Soft". */
function sameCompany(listed: string, typed: string): boolean {
  const a = normalize(listed)
  const b = normalize(typed)
  return b.length >= 2 && (a === b || a.startsWith(b) || b.startsWith(a))
}

/** The title shares a real word with what was typed ("software" matches "Software Engineer"). */
function relatedTitle(title: string, typed: string): boolean {
  const words = typed.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3)
  const lower = title.toLowerCase()
  return words.length > 0 && words.some((w) => lower.includes(w))
}

// Practice starts from a real opening: what was typed is looked up first (JSearch, via
// the job search endpoint), and the interview uses the chosen posting's own company and
// title. If nothing matches, the user has to change what they typed.
export default function InterviewSetup({
  mode,
  company,
  position,
  hasResume,
  starting,
  onCompanyChange,
  onPositionChange,
  onStart,
}: InterviewSetupProps) {
  const label = mode === 'behavioral' ? 'Behavioral' : 'Technical'
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const [chosen, setChosen] = useState<string | null>(null)
  const ready = company.trim().length > 0 && position.trim().length > 0

  async function findRoles() {
    const typedCompany = company.trim()
    const typedPosition = position.trim()
    setLookup({ status: 'searching' })
    try {
      const results = await api.searchJobs({
        location: '',
        job_functions: [`${typedPosition} at ${typedCompany}`],
        experience_levels: [],
        job_types: [],
        work_models: [],
      })
      const roles = results
        .filter((job) => sameCompany(job.company, typedCompany) && relatedTitle(job.title, typedPosition))
        .slice(0, MAX_ROLES)
      setChosen(roles[0]?.id ?? null)
      setLookup(roles.length > 0 ? { status: 'found', roles } : { status: 'none' })
    } catch (e) {
      setLookup({ status: 'error', message: `Couldn't look up roles: ${String(e)}` })
    }
  }

  // Changing what was typed makes the last lookup stale.
  function edit(change: (value: string) => void, value: string) {
    change(value)
    setLookup({ status: 'idle' })
    setChosen(null)
  }

  const role = lookup.status === 'found' ? lookup.roles.find((r) => r.id === chosen) : undefined

  return (
    <section className="interview-panel interview-setup-panel" aria-label={`${label} Interview Setup`}>
      <div className={`interview-resume-status${hasResume ? ' uploaded' : ''}`} aria-label="Resume status">
        <strong>{hasResume ? 'Resume Uploaded' : 'No Resume Uploaded'}</strong>
        <span>
          {hasResume
            ? 'Questions will be personalized using your uploaded resume.'
            : 'Upload a resume from Profile to personalize your interview.'}
        </span>
      </div>
      <form
        className="interview-setup-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && lookup.status !== 'searching') void findRoles()
        }}
      >
        <div className="interview-field">
          <label htmlFor={`${mode}-company`}>Company</label>
          <input
            id={`${mode}-company`}
            value={company}
            onChange={(event) => edit(onCompanyChange, event.target.value)}
            placeholder="Example: Microsoft"
          />
        </div>
        <div className="interview-field">
          <label htmlFor={`${mode}-position`}>Position / Job Title</label>
          <input
            id={`${mode}-position`}
            value={position}
            onChange={(event) => edit(onPositionChange, event.target.value)}
            placeholder="Example: Software Engineer Intern"
          />
        </div>
        {/* Lets Enter in either field run the lookup. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>

      {lookup.status === 'found' ? (
        <fieldset className="interview-roles">
          <legend>
            Found {lookup.roles.length} open {lookup.roles.length === 1 ? 'role' : 'roles'} at {lookup.roles[0].company}.
            Pick one to practice for:
          </legend>
          {lookup.roles.map((r) => (
            <label key={r.id} className={chosen === r.id ? 'selected' : ''}>
              <input
                type="radio"
                name={`${mode}-role`}
                checked={chosen === r.id}
                onChange={() => setChosen(r.id)}
              />
              <span>
                <strong>{r.title}</strong>
                <span className="interview-role-meta">
                  {[r.location, r.posted_at].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : lookup.status === 'none' ? (
        <p className="interview-role-none" role="alert">
          No open “{position.trim()}” roles found at “{company.trim()}”. Check the spelling, or try a more specific
          title such as “Software Engineer Intern”.
        </p>
      ) : lookup.status === 'error' ? (
        <p className="error" role="alert">
          {lookup.message}
        </p>
      ) : null}

      <div className="interview-actions">
        {role ? (
          <button
            className="interview-primary-button"
            type="button"
            disabled={starting}
            onClick={() => onStart(role.company, role.title)}
          >
            {starting ? 'Generating Questions...' : 'Start interview for this role'}
          </button>
        ) : (
          <button
            className="interview-primary-button"
            type="button"
            disabled={!ready || lookup.status === 'searching'}
            onClick={() => void findRoles()}
          >
            {lookup.status === 'searching' ? 'Looking for this role…' : 'Find this role'}
          </button>
        )}
      </div>
    </section>
  )
}
