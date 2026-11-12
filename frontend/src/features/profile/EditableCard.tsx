import type { ReactNode } from 'react'
import { Icon } from '../../icons'
import type { SectionId } from './profileCompleteness'

/** A profile card with its own Edit button; Save and Cancel apply to this card only. */
export default function EditableCard({
  id,
  title,
  aside,
  editing,
  canEdit,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  id: SectionId
  title: string
  aside?: ReactNode
  editing: boolean
  canEdit: boolean // false while another card is being edited
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <section id={`profile-${id}`} className={`career-profile-card${editing ? ' editing' : ''}`} aria-labelledby={`profile-${id}-title`} tabIndex={-1}>
      <div className="career-profile-card-heading">
        <h2 id={`profile-${id}-title`}>{title}</h2>
        {aside}
        {!editing && (
          <button
            type="button"
            className="career-profile-edit"
            aria-label={`Edit ${title}`}
            title={canEdit ? `Edit ${title}` : 'Save or cancel the card you are editing first'}
            disabled={!canEdit}
            onClick={onEdit}
          >
            <Icon name="edit" size={18} />
          </button>
        )}
      </div>
      {children}
      {editing && (
        <div className="career-profile-card-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-filled" onClick={onSave}>
            Save
          </button>
        </div>
      )}
    </section>
  )
}
