import { useState, type KeyboardEvent } from 'react'
import {
  CAREER_PRIORITIES,
  WORK_ARRANGEMENTS,
  loadCareerProfile,
  saveCareerProfile,
  type CareerPriority,
  type CareerProfile,
} from './profileStorage'
import './profile.css'

function cloneProfile(profile: CareerProfile): CareerProfile {
  return { ...profile, skills: [...profile.skills], priorities: [...profile.priorities] }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="career-profile-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function ProfileView() {
  const [profile, setProfile] = useState(loadCareerProfile)
  const [draft, setDraft] = useState<CareerProfile>(() => cloneProfile(profile))
  const [editing, setEditing] = useState(false)
  const [newSkill, setNewSkill] = useState('')

  function update<K extends keyof CareerProfile>(field: K, value: CareerProfile[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function startEditing() {
    setDraft(cloneProfile(profile))
    setNewSkill('')
    setEditing(true)
  }

  function cancelEditing() {
    setDraft(cloneProfile(profile))
    setNewSkill('')
    setEditing(false)
  }

  function saveChanges() {
    const saved = cloneProfile(draft)
    saveCareerProfile(saved)
    setProfile(saved)
    setEditing(false)
    setNewSkill('')
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
    } else if (draft.priorities.length < 3) {
      update('priorities', [...draft.priorities, priority])
    }
  }

  const shown = editing ? draft : profile

  return (
    <div className="career-profile-page">
      <div className="career-profile-heading">
        <div>
          <p className="career-profile-eyebrow">Career profile</p>
          <h1>My Profile</h1>
          <p className="career-profile-intro">Keep your background and career goals in one place.</p>
        </div>
        <div className="career-profile-actions">
          {editing ? (
            <>
              <button type="button" className="btn-outline" onClick={cancelEditing}>Cancel</button>
              <button type="button" className="btn-filled" onClick={saveChanges}>Save Changes</button>
            </>
          ) : (
            <button type="button" className="btn-filled" onClick={startEditing}>Edit Profile</button>
          )}
        </div>
      </div>

      <div className="career-profile-grid">
        <section className="career-profile-card career-profile-about" aria-labelledby="about-me-title">
          <div className="career-profile-card-heading">
            <div>
              <p className="career-profile-card-kicker">Personal details</p>
              <h2 id="about-me-title">About Me</h2>
            </div>
            <span className="avatar career-profile-avatar">{shown.initials}</span>
          </div>
          {editing ? (
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
            <>
              <div className="career-profile-identity"><strong>{profile.name}</strong><span>{profile.major}</span></div>
              <div className="career-profile-details">
                <Detail label="University" value={profile.university} />
                <Detail label="Graduation Year" value={profile.graduationYear} />
                <Detail label="Experience Level" value={profile.experienceLevel} />
              </div>
            </>
          )}
        </section>

        <section className="career-profile-card" aria-labelledby="skills-experience-title">
          <div className="career-profile-card-heading"><div><p className="career-profile-card-kicker">Your toolkit</p><h2 id="skills-experience-title">Skills &amp; Experience</h2></div></div>
          <div className="career-profile-skills">
            {shown.skills.map((skill) => (
              <span className="career-profile-skill" key={skill}>{skill}{editing && <button type="button" aria-label={`Remove ${skill}`} onClick={() => update('skills', draft.skills.filter((item) => item !== skill))}>×</button>}</span>
            ))}
          </div>
          {editing && (
            <div className="career-profile-add-skill">
              <label className="visually-hidden" htmlFor="new-profile-skill">Add a skill</label>
              <input id="new-profile-skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={onSkillKeyDown} placeholder="Add a skill" />
              <button type="button" className="btn-outline" onClick={addSkill}>Add Skill</button>
            </div>
          )}
          {editing ? (
            <label className="career-profile-full-field">Experience Summary<textarea rows={5} value={draft.experienceSummary} onChange={(e) => update('experienceSummary', e.target.value)} /></label>
          ) : <p className="career-profile-summary">{profile.experienceSummary}</p>}
        </section>

        <section className="career-profile-card" aria-labelledby="career-preferences-title">
          <div className="career-profile-card-heading"><div><p className="career-profile-card-kicker">What you want next</p><h2 id="career-preferences-title">Career Preferences</h2></div></div>
          {editing ? (
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
        </section>

        <section className="career-profile-card" aria-labelledby="career-priorities-title">
          <div className="career-profile-card-heading"><div><p className="career-profile-card-kicker">What matters most</p><h2 id="career-priorities-title">Career Priorities</h2></div>{editing && <span className="career-profile-count">{draft.priorities.length} of 3 selected</span>}</div>
          <p className="career-profile-helper">Choose up to three priorities for your next opportunity.</p>
          <div className="career-profile-priorities">
            {CAREER_PRIORITIES.map((priority) => {
              const checked = shown.priorities.includes(priority)
              return editing ? (
                <label key={priority} className={checked ? 'selected' : ''}><input type="checkbox" checked={checked} disabled={!checked && draft.priorities.length >= 3} onChange={() => togglePriority(priority)} />{priority}</label>
              ) : checked ? <span key={priority}>{priority}</span> : null
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
