import { type DragEvent, useRef, useState } from 'react'
import { Icon } from '../../icons'
import type { CareerProfile } from './profileStorage'

/** Upload by dropping a file or choosing one; shows the parsed file and the text fit analysis reads. */
export default function ResumeCard({
  profile,
  uploading,
  note,
  error,
  onUpload,
  onRemove,
}: {
  profile: CareerProfile
  uploading: boolean
  note: string
  error: string
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hasResume = profile.resumeText !== ''

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && !uploading) onUpload(file)
  }

  return (
    <section
      id="profile-resume"
      className="career-profile-card career-profile-resume"
      aria-labelledby="profile-resume-title"
      aria-busy={uploading}
      tabIndex={-1}
    >
      <div className="career-profile-card-heading">
        <h2 id="profile-resume-title">Resume</h2>
      </div>

      {hasResume && (
        <div className="career-profile-resume-file">
          <Icon name="file" size={22} />
          <div>
            <strong>{profile.resumeFileName || 'Resume'}</strong>
            <span>
              <span className="career-profile-ready">Ready</span> · used in fit analysis ·{' '}
              {profile.resumeText.length.toLocaleString()} characters of text
            </span>
          </div>
          <button type="button" className="btn-outline" disabled={uploading} onClick={onRemove}>
            Remove
          </button>
        </div>
      )}

      <div
        className={`career-profile-drop${dragging ? ' dragging' : ''}`}
        data-testid="resume-drop"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={24} />
        <p>
          {uploading ? 'Reading your resume…' : hasResume ? 'Drop a new file here to replace it, or' : 'Drop your resume here, or'}
        </p>
        <button type="button" className="btn-filled" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {hasResume ? 'Choose a new file' : 'Choose a file'}
        </button>
        <p className="career-profile-drop-hint">PDF, Word (.docx) or .txt · up to 5 MB</p>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Resume file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = '' // so the same file can be picked again
          }}
        />
      </div>

      {note && (
        <p className="career-profile-resume-note" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {hasResume && (
        <details className="career-profile-resume-text">
          <summary>Show the text fit analysis reads</summary>
          <pre>{profile.resumeText}</pre>
        </details>
      )}
    </section>
  )
}
