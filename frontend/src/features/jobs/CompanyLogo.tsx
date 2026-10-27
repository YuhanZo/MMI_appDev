import { useState } from 'react'
import type { Job } from '../../types'

// Shows the company's logo, or its first letter if there's no logo or the image fails to load.
export default function CompanyLogo({ job }: { job: Job }) {
  const [failed, setFailed] = useState(false)

  if (job.company_logo && !failed) {
    return (
      <img
        className="job-logo job-logo-img"
        src={job.company_logo}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span className="job-logo" aria-hidden="true">
      {job.company.charAt(0)}
    </span>
  )
}
