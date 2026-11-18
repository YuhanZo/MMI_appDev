import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../../api'
import { Icon } from '../../icons'
import type { InterviewHistoryItem } from '../../types'
import {
  activityLevel,
  bandOf,
  dayKey,
  SCORE_BANDS,
  scoreSummary,
  sessionsByDay,
  streaks,
  yearWeeks,
} from './practiceActivity'
import { loadCareerProfile } from './profileStorage'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function ActivityCalendar({ year, days, today }: { year: number; days: Map<string, number>; today: string }) {
  const weeks = useMemo(() => yearWeeks(year), [year])
  // When the year doesn't fit, start scrolled to its end, where the recent weeks are.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [year])
  return (
    <div className="activity-calendar-scroll" ref={scroller}>
      <div className="activity-calendar" style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {/* Month names above the week where each month starts */}
        <span />
        {weeks.map((week, i) => {
          const firstOfMonth = week.find((d) => d?.getDate() === 1)
          return (
            <span key={i} className="activity-month">
              {firstOfMonth ? MONTHS[firstOfMonth.getMonth()] : ''}
            </span>
          )
        })}
        {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
          <div key={weekday} className="activity-row">
            <span className="activity-weekday">{weekday % 2 === 1 ? ['', 'Mon', '', 'Wed', '', 'Fri', ''][weekday] : ''}</span>
            {weeks.map((week, i) => {
              const day = week[weekday]
              if (!day) return <span key={i} />
              const key = dayKey(day)
              const count = days.get(key) ?? 0
              const label = `${plural(count, 'session')} on ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              return (
                <span
                  key={i}
                  className={`activity-cell level-${activityLevel(count)}${key > today ? ' future' : ''}`}
                  title={label}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The profile's front page: who the student is, how regularly they practice
 * interviews and how their answers score, with the full career profile one click away.
 */
export default function ProfileOverview({ onEdit }: { onEdit: () => void }) {
  const [profile] = useState(loadCareerProfile)
  const [today] = useState(() => new Date()) // fixed while the page is open
  const [history, setHistory] = useState<InterviewHistoryItem[] | null>(null)
  const [error, setError] = useState(false)
  const [year, setYear] = useState(() => today.getFullYear())

  useEffect(() => {
    let cancelled = false
    api
      .getInterviewHistory()
      .then((items) => !cancelled && setHistory(items))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  const days = useMemo(() => sessionsByDay(history ?? []), [history])
  const { current, best } = useMemo(() => streaks(days, today), [days, today])
  const scores = useMemo(() => scoreSummary(history ?? []), [history])
  const years = useMemo(() => {
    const found = new Set([today.getFullYear(), ...[...days.keys()].map((k) => Number(k.slice(0, 4)))])
    return [...found].sort((a, b) => b - a)
  }, [days, today])
  const inYear = [...days.entries()].filter(([k]) => k.startsWith(`${year}-`))
  const yearSessions = inYear.reduce((sum, [, n]) => sum + n, 0)

  const school = [profile.university, profile.graduationYear && `Class of ${profile.graduationYear}`].filter(Boolean).join(' · ')
  const tallest = Math.max(1, ...scores.bands)
  const marked = scores.average === null ? -1 : bandOf(scores.average)

  return (
    <div className="profile-overview">
      <h1 className="visually-hidden">My Profile</h1>

      <div className="profile-overview-side">
        <section className="profile-overview-card profile-identity" aria-label="About you">
          <div className="profile-identity-top">
            <span className="avatar profile-identity-avatar" aria-hidden="true">
              {profile.initials}
            </span>
            <div>
              <p className="profile-identity-name">{profile.name || 'Your name'}</p>
              {profile.major && <p className="profile-identity-meta">{profile.major}</p>}
            </div>
          </div>
          {(school || profile.preferredLocation) && (
            <div className="profile-identity-details">
              {school && <p className="profile-identity-meta">{school}</p>}
              {profile.preferredLocation && (
                <p className="profile-identity-meta profile-identity-place">
                  <Icon name="place" size={16} />
                  {profile.preferredLocation}
                </p>
              )}
            </div>
          )}
          <button type="button" className="profile-edit-btn" onClick={onEdit}>
            <Icon name="edit" size={16} />
            Edit Profile
          </button>
        </section>

        <div className="profile-streaks">
          <section className="profile-overview-card profile-streak" aria-label="Current streak">
            <p className="profile-streak-label">Current Streak</p>
            <p className="profile-streak-value current">
              <Icon name="flame" size={20} />
              {plural(current, 'day')}
            </p>
          </section>
          <section className="profile-overview-card profile-streak" aria-label="Best streak">
            <p className="profile-streak-label">Best Streak</p>
            <p className="profile-streak-value best">
              <Icon name="trophy" size={20} />
              {plural(best, 'day')}
            </p>
          </section>
        </div>

        <section className="profile-overview-card profile-scores" aria-label="Interview scores">
          <div className="profile-scores-head">
            <p className="profile-scores-average">
              <Icon name="chart" size={18} />
              {scores.average === null ? 'No scores yet' : `Avg ${scores.average.toFixed(1)}/10`}
            </p>
            <span className="profile-scores-count">{plural(scores.answers, 'answer')}</span>
          </div>
          <div className="profile-score-bars" role="img" aria-label={`Answers by score: ${SCORE_BANDS.map((b, i) => `${b}: ${scores.bands[i]}`).join(', ')}`}>
            {SCORE_BANDS.map((band, i) => (
              <div key={band} className="profile-score-band">
                <span
                  className={`profile-score-bar${i === marked ? ' marked' : ''}`}
                  style={{ height: `${Math.max(6, (scores.bands[i] / tallest) * 100)}%` }}
                />
                <span className="profile-score-label">{band}</span>
              </div>
            ))}
          </div>
          <p className="profile-overview-note">Scores from the feedback on each interview answer.</p>
        </section>
      </div>

      <div className="profile-overview-main">
        <section className="profile-overview-card profile-activity" aria-label="Practice activity">
          <div className="profile-activity-head">
            <h2>
              <Icon name="pulse" size={20} />
              {plural(yearSessions, 'practice session')} in {year}
            </h2>
            <dl className="profile-activity-stats">
              <div><dt>Active days</dt><dd>{inYear.length}</dd></div>
              <div><dt>Current streak</dt><dd>{plural(current, 'day')}</dd></div>
              <div><dt>Max streak</dt><dd>{plural(best, 'day')}</dd></div>
            </dl>
            <select aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="profile-overview-note" role="alert">Couldn't load your practice history. Is the backend running?</p>
          ) : history === null ? (
            <p className="profile-overview-note">Loading your practice…</p>
          ) : (
            <ActivityCalendar year={year} days={days} today={dayKey(today)} />
          )}
          <div className="profile-activity-foot">
            <p className="profile-overview-note">Each interview you start counts. Days follow your time zone.</p>
            <span className="activity-legend" aria-hidden="true">
              Less
              {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`activity-cell level-${level}`} />)}
              More
            </span>
          </div>
        </section>

      </div>
    </div>
  )
}
