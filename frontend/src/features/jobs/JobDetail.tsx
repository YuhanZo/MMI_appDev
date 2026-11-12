import { useState } from 'react'
import { Icon, type IconName } from '../../icons'
import type { Job } from '../../types'
import CompanyLogo from './CompanyLogo'
import FitPanel from './FitPanel'
import type { JobSearchState } from './useJobSearch'

const WORK_MODEL_LABELS = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' } as const

// Long descriptions start folded so the page's key facts stay in view.
const FOLD_AT = 600

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** A job's own page: what it is at a glance, the full description, and your fit. */
export default function JobDetail({
  job,
  js,
  backLabel,
  onBack,
  saved,
  onToggleSave,
  onPracticeInterview,
}: {
  job: Job
  js: JobSearchState
  backLabel: string
  onBack: () => void
  saved: boolean
  onToggleSave: () => void
  onPracticeInterview: (job: Job) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [shareNote, setShareNote] = useState('')

  const workModel = job.work_model ? WORK_MODEL_LABELS[job.work_model] : ''
  const facts: { icon: IconName; label: string; text: string }[] = [
    { icon: 'money', label: 'Pay', text: job.salary ?? '' },
    { icon: 'place', label: 'Location', text: [workModel, job.location].filter(Boolean).join(' · ') },
    { icon: 'work', label: 'Job type', text: job.employment_type ?? '' },
  ]
  const glance = facts.filter((g) => g.text !== '')
  const long = job.description.length > FOLD_AT
  const posted = [job.posted_at && `Posted ${job.posted_at}`, job.publisher && `via ${job.publisher}`]
    .filter(Boolean)
    .join(' · ')

  // The system share sheet where the browser has one; otherwise copy the link.
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: job.title, text: `${job.title} at ${job.company}`, url: job.url })
        return
      }
      await navigator.clipboard.writeText(job.url)
      setShareNote('Link copied')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // share sheet closed
      setShareNote("Couldn't share this job")
    }
  }

  return (
    <article className="job-page" aria-labelledby="job-page-title">
      <button type="button" className="job-back" onClick={onBack}>
        <Icon name="back" size={18} />
        {backLabel}
      </button>

      <header className="job-page-head">
        <div className="job-page-company">
          <CompanyLogo job={job} />
          <div>
            <p className="job-page-company-name">{job.company}</p>
            {job.employer_website && (
              <a href={job.employer_website} target="_blank" rel="noreferrer">
                {hostname(job.employer_website)}
              </a>
            )}
          </div>
        </div>
        <h2 id="job-page-title">{job.title}</h2>
        {posted && <p className="job-page-posted">{posted}</p>}

        <div className="job-page-actions">
          {job.url && (
            <a className="btn-filled" href={job.url} target="_blank" rel="noreferrer">
              <Icon name="open" size={16} />
              Apply externally
            </a>
          )}
          <button type="button" className="btn-outline" aria-pressed={saved} onClick={onToggleSave}>
            <Icon name={saved ? 'bookmark' : 'bookmarkOutline'} size={18} />
            {saved ? 'Saved' : 'Save'}
          </button>
          {job.url && (
            <button type="button" className="btn-outline" onClick={() => void share()}>
              <Icon name="share" size={18} />
              Share
            </button>
          )}
          <button type="button" className="btn-outline" onClick={() => onPracticeInterview(job)}>
            <Icon name="mic" size={18} />
            Practice interview
          </button>
          {shareNote && (
            <span className="job-share-note" role="status">
              {shareNote}
            </span>
          )}
        </div>
      </header>

      <div className="job-page-body">
        <div className="job-page-main">
          {glance.length > 0 && (
            <section className="job-section" aria-labelledby="job-glance-title">
              <h3 id="job-glance-title">At a glance</h3>
              <ul className="job-glance">
                {glance.map((g) => (
                  <li key={g.label}>
                    <Icon name={g.icon} size={18} />
                    <span className="visually-hidden">{g.label}: </span>
                    {g.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {job.description && (
            <section className="job-section" aria-labelledby="job-description-title">
              <h3 id="job-description-title">Job description</h3>
              <p className={`job-description${long && !expanded ? ' folded' : ''}`}>{job.description}</p>
              {long && (
                <button type="button" className="job-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </section>
          )}

          {job.benefits && job.benefits.length > 0 && (
            <section className="job-section" aria-labelledby="job-offers-title">
              <h3 id="job-offers-title">What this job offers</h3>
              <ul className="job-offers">
                {job.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <FitPanel js={js} />
      </div>
    </article>
  )
}
