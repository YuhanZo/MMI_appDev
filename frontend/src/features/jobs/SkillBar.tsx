import type { CSSProperties } from 'react'
import './SkillBar.css'

type SkillBarProps = {
  matched?: string[]
  missing?: string[]
}

export default function SkillBar({ matched = [], missing = [] }: SkillBarProps) {
  const total = matched.length + missing.length
  if (total === 0) return null

  const percent = Math.round((matched.length / total) * 100)
  const ringStyle = { '--skill-pct': percent } as CSSProperties

  return (
    <section className="skillbar" aria-label="Skill fit">
      <div className="skillbar-head">
        {/* The key changes with the result, so the fill animation replays for each job */}
        <div
          key={`${percent}-${matched.join('|')}`}
          className="skillbar-ring"
          style={ringStyle}
          role="img"
          aria-label={`${percent}% skill fit: ${matched.length} of ${total} job skills`}
        >
          <span className="skillbar-ring-value" aria-hidden="true">
            <span className="skillbar-ring-number" />
            <span className="skillbar-ring-label">fit</span>
          </span>
        </div>
        <div>
          <h3 className="skillbar-title">Skill fit</h3>
          <p className="skillbar-count">
            You have {matched.length} of {total} skills this job asks for
          </p>
        </div>
      </div>

      <div className="skillbar-lists">
        {matched.length > 0 && (
          <div>
            <h4 className="skillbar-heading">You have</h4>
            <ul className="skillbar-chips">
              {matched.map((skill) => (
                <li key={skill} className="skillbar-chip is-matched">
                  <span aria-hidden="true">{'\u2713'}</span> {skill}
                </li>
              ))}
            </ul>
          </div>
        )}
        {missing.length > 0 && (
          <div>
            <h4 className="skillbar-heading">To build</h4>
            <ul className="skillbar-chips">
              {missing.map((skill) => (
                <li key={skill} className="skillbar-chip is-missing">
                  <span aria-hidden="true">+</span> {skill}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}