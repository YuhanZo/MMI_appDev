import { Icon } from '../../icons'
import { completenessItems, completenessPercent, SECTIONS, type SectionId } from './profileCompleteness'
import type { CareerProfile } from './profileStorage'

/** The sticky left column: who the student is, what they're looking for, and what's left to fill in. */
export default function IdentityCard({
  profile,
  onGoTo,
}: {
  profile: CareerProfile
  onGoTo: (section: SectionId, edit: boolean) => void
}) {
  const percent = completenessPercent(profile)
  const missing = completenessItems(profile).filter((i) => !i.done)
  const school = [profile.university, profile.graduationYear && `Class of ${profile.graduationYear}`]
    .filter(Boolean)
    .join(' · ')
  const lookingFor = [profile.targetRole, profile.workArrangement, profile.preferredLocation].filter(Boolean)

  return (
    <aside className="career-profile-identity-card" aria-label="Profile overview">
      <span className="avatar career-profile-avatar" aria-hidden="true">
        {profile.initials}
      </span>
      <p className="career-profile-name">{profile.name}</p>
      <p className="career-profile-meta">{profile.major}</p>
      {school && <p className="career-profile-meta">{school}</p>}
      {profile.preferredLocation && (
        <p className="career-profile-meta career-profile-location">
          <Icon name="place" size={16} />
          {profile.preferredLocation}
        </p>
      )}

      {lookingFor.length > 0 && (
        <div className="career-profile-looking">
          <p className="career-profile-side-label">Looking for</p>
          <ul aria-label="Looking for">
            {lookingFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="career-profile-completeness">
        <p className="career-profile-side-label" id="profile-complete-label">
          Profile {percent}% complete
        </p>
        <div
          className="career-profile-meter"
          role="progressbar"
          aria-labelledby="profile-complete-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        {missing.length > 0 ? (
          <ul className="career-profile-missing" aria-label="Still missing">
            {missing.map((item) => (
              <li key={item.todo}>
                <button type="button" onClick={() => onGoTo(item.section, item.section !== 'resume')}>
                  + {item.todo} <span>(+{item.weight}%)</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="career-profile-done">
            <Icon name="check" size={16} />
            Your profile is complete.
          </p>
        )}
      </div>

      <nav className="career-profile-nav" aria-label="Profile sections">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => onGoTo(s.id, false)}>
            {s.title}
          </button>
        ))}
      </nav>
    </aside>
  )
}
