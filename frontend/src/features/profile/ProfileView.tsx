import { useState, type KeyboardEvent } from 'react'
import * as api from '../../api'
import EditableCard from './EditableCard'
import IdentityCard from './IdentityCard'
import type { SectionId } from './profileCompleteness'
import {
  CAREER_PRIORITIES,
  WORK_ARRANGEMENTS,
  loadCareerProfile,
  saveCareerProfile,
  type CareerPriority,
  type CareerProfile,
} from './profileStorage'
import ResumeCard from './ResumeCard'
import './profile.css'

const MAX_PRIORITIES = 3

function cloneProfile(profile: CareerProfile): CareerProfile {
  return { ...profile, skills: [...profile.skills], priorities: [...profile.priorities] }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="career-profile-detail">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

// Two columns: an overview on the left (identity, what the student is looking for,
// how complete the profile is) and one card per section on the right. Each card is
// edited on its own; only one card is open for editing at a time, so nothing
// unsaved is lost by opening another.
export default function ProfileView() {
  const [profile, setProfile] = useState(loadCareerProfile)
  const [draft, setDraft] = useState<CareerProfile>(() => cloneProfile(profile))
  const [editing, setEditing] = useState<SectionId | null>(null)
  const [newSkill, setNewSkill] = useState('')

  const [uploading, setUploading] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [resumeNote, setResumeNote] = useState('')

  function update<K extends keyof CareerProfile>(field: K, value: CareerProfile[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function startEditing(section: SectionId) {
    setDraft(cloneProfile(profile))
    setNewSkill('')
    setEditing(section)
  }

  function cancelEditing() {
    setDraft(cloneProfile(profile))
    setNewSkill('')
    setEditing(null)
  }

  function saveChanges() {
    const saved = cloneProfile(draft)
    saveCareerProfile(saved)
    setProfile(saved)
    setEditing(null)
    setNewSkill('')
  }

  /** Scrolls to a section; from the "still missing" list it also opens that card for editing. */
  function goTo(section: SectionId, edit: boolean) {
    if (edit && editing === null) startEditing(section)
    const card = document.getElementById(`profile-${section}`)
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    card?.focus({ preventScroll: true })
  }

  // The resume is saved as soon as it's uploaded or removed, without Save. A card
  // being edited keeps its other unsaved changes and picks up the new resume.
  function applyResume(resumeText: string, resumeFileName: string) {
    const saved = { ...cloneProfile(profile), resumeText, resumeFileName }
    saveCareerProfile(saved)
    setProfile(saved)
    setDraft((current) => ({ ...current, resumeText, resumeFileName }))
  }

  async function uploadResume(file: File) {
    setUploading(true)
    setResumeError('')
    setResumeNote('')
    try {
      const result = await api.uploadResume(file)
      applyResume(result.text, result.filename)
      if (result.truncated) {
        setResumeNote('Your resume is long, so only the first part of its text was kept.')
      }
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  function removeResume() {
    applyResume('', '')
    setResumeError('')
    setResumeNote('')
  }

  function addSkill() {
    const skill = newSkill.trim()
    if (!skill || draft.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) return
    update('skills', [...draft.skills, skill])
    setNewSkill('')
  }

  function onSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addSkill()
    }
  }

  function togglePriority(priority: CareerPriority) {
    if (draft.priorities.includes(priority)) {
      update('priorities', draft.priorities.filter((item) => item !== priority))
    } else if (draft.priorities.length < MAX_PRIORITIES) {
      update('priorities', [...draft.priorities, priority])
    }
  }

  const card = (id: SectionId) => ({
    id,
    editing: editing === id,
    canEdit: editing === null,
    onEdit: () => startEditing(id),
    onSave: saveChanges,
    onCancel: cancelEditing,
  })

  return (
    <div className="career-profile-page">
      <div className="career-profile-heading">
        <h1>My Profile</h1>
      </div>

      <div className="career-profile-layout">
        <IdentityCard profile={profile} onGoTo={goTo} />

        <div className="career-profile-sections">
          <EditableCard {...card('about')} title="About Me">
            {editing === 'about' ? (
              <div className="career-profile-form-grid">
                <label>Name<input value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
                <label>Major<input value={draft.major} onChange={(e) => update('major', e.target.value)} /></label>
                <label>University<input value={draft.university} onChange={(e) => update('university', e.target.value)} /></label>
                <label>Graduation Year<input value={draft.graduationYear} onChange={(e) => update('graduationYear', e.target.value)} /></label>
                <label>Experience Level
                  <select value={draft.experienceLevel} onChange={(e) => update('experienceLevel', e.target.value)}>
                    <option>Student</option><option>Entry Level</option><option>Mid Level</option><option>Senior Level</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="career-profile-details">
                <Detail label="Name" value={profile.name} />
                <Detail label="Major" value={profile.major} />
                <Detail label="University" value={profile.university} />
                <Detail label="Graduation Year" value={profile.graduationYear} />
                <Detail label="Experience Level" value={profile.experienceLevel} />
              </div>
            )}
          </EditableCard>

          <EditableCard {...card('skills')} title="Skills & Experience">
            <ul className="career-profile-skills" aria-label="Skills">
              {(editing === 'skills' ? draft : profile).skills.map((skill) => (
                <li className="career-profile-skill" key={skill}>
                  {skill}
                  {editing === 'skills' && (
                    <button type="button" aria-label={`Remove ${skill}`} onClick={() => update('skills', draft.skills.filter((item) => item !== skill))}>×</button>
                  )}
                </li>
              ))}
            </ul>
            {editing === 'skills' ? (
              <>
                <div className="career-profile-add-skill">
                  <label className="visually-hidden" htmlFor="new-profile-skill">Add a skill</label>
                  <input id="new-profile-skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={onSkillKeyDown} placeholder="Add a skill" />
                  <button type="button" className="btn-outline" onClick={addSkill}>Add Skill</button>
                </div>
                <label className="career-profile-full-field">Experience Summary<textarea rows={5} value={draft.experienceSummary} onChange={(e) => update('experienceSummary', e.target.value)} /></label>
              </>
            ) : (
              <p className="career-profile-summary">{profile.experienceSummary || 'No experience summary yet.'}</p>
            )}
          </EditableCard>

          <EditableCard {...card('preferences')} title="Career Preferences">
            {editing === 'preferences' ? (
              <div className="career-profile-form-grid">
                <label>Target Role<input value={draft.targetRole} onChange={(e) => update('targetRole', e.target.value)} /></label>
                <label>Preferred Location<input value={draft.preferredLocation} onChange={(e) => update('preferredLocation', e.target.value)} /></label>
                <label>Salary Range<input value={draft.salaryRange} onChange={(e) => update('salaryRange', e.target.value)} /></label>
                <fieldset className="career-profile-arrangements"><legend>Work Arrangement</legend><div>{WORK_ARRANGEMENTS.map((option) => <label key={option} className={draft.workArrangement === option ? 'selected' : ''}><input type="radio" name="work-arrangement" value={option} checked={draft.workArrangement === option} onChange={() => update('workArrangement', option)} />{option}</label>)}</div></fieldset>
              </div>
            ) : (
              <div className="career-profile-details">
                <Detail label="Target Role" value={profile.targetRole} />
                <Detail label="Preferred Location" value={profile.preferredLocation} />
                <Detail label="Salary Range" value={profile.salaryRange} />
                <Detail label="Work Arrangement" value={profile.workArrangement} />
              </div>
            )}
          </EditableCard>

          <EditableCard
            {...card('priorities')}
           
            title="Career Priorities"
            aside={editing === 'priorities' && <span className="career-profile-count">{draft.priorities.length} of {MAX_PRIORITIES} selected</span>}
          >
            {editing === 'priorities' ? (
              <>
                <p className="career-profile-helper">Choose up to three priorities for your next opportunity.</p>
                <div className="career-profile-priorities">
                  {CAREER_PRIORITIES.map((priority) => {
                    const checked = draft.priorities.includes(priority)
                    return (
                      <label key={priority} className={checked ? 'selected' : ''}>
                        <input type="checkbox" checked={checked} disabled={!checked && draft.priorities.length >= MAX_PRIORITIES} onChange={() => togglePriority(priority)} />
                        {priority}
                      </label>
                    )
                  })}
                </div>
              </>
            ) : profile.priorities.length > 0 ? (
              <ul className="career-profile-priorities" aria-label="Career priorities">
                {profile.priorities.map((priority) => <li key={priority}>{priority}</li>)}
              </ul>
            ) : (
              <p className="career-profile-summary">No priorities picked yet.</p>
            )}
          </EditableCard>

          <ResumeCard
            profile={profile}
            uploading={uploading}
            note={resumeNote}
            error={resumeError}
            onUpload={(file) => void uploadResume(file)}
            onRemove={removeResume}
          />
        </div>
      </div>
    </div>
  )
}
