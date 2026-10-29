import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'

/** "Backend Engineer (+2)" for three choices; '' for none. */
function summarize(labels: string[]): string {
  if (labels.length === 0) return ''
  return labels.length === 1 ? labels[0] : `${labels[0]} (+${labels.length - 1})`
}

interface FilterChipProps<T> {
  heading: string
  value: T
  // Chosen values as shown to the user; empty means "any" and the chip shows the heading.
  labels: string[]
  disabled?: boolean
  canConfirm?: (draft: T) => boolean
  onConfirm: (value: T) => void
  children: (draft: T, setDraft: (next: T) => void) => ReactNode
}

// A filter as a chip with a popover. Edits stay a draft until Confirm; Esc or a click
// outside closes the popover and drops them.
export default function FilterChip<T>({
  heading,
  value,
  labels,
  disabled,
  canConfirm = () => true,
  onConfirm,
  children,
}: FilterChipProps<T>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const wrap = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLButtonElement>(null)
  const summary = summarize(labels)

  function close() {
    setOpen(false)
    chip.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function toggle() {
    if (!open) setDraft(value)
    setOpen(!open)
  }

  function confirm(e: FormEvent) {
    e.preventDefault()
    if (!canConfirm(draft)) return
    onConfirm(draft)
    close()
  }

  return (
    <div className="chip-wrap" ref={wrap}>
      <button
        ref={chip}
        type="button"
        className={`chip${summary ? ' active' : ''}`}
        aria-label={`${heading}: ${summary || 'Any'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={labels.join(', ') || undefined}
        disabled={disabled}
        onClick={toggle}
      >
        <span className="chip-text">{summary || heading}</span>
        <span className="chip-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <form
          className="chip-popover"
          role="dialog"
          aria-label={heading}
          onSubmit={confirm}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
        >
          <p className="chip-heading">{heading}</p>
          {children(draft, setDraft)}
          <button type="submit" className="chip-confirm" disabled={!canConfirm(draft)}>
            Confirm
          </button>
        </form>
      )}
    </div>
  )
}

/** Checkboxes for a multi-select filter, kept in option order. */
export function CheckboxList<V extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: V; label: string }[]
  selected: V[]
  onChange: (next: V[]) => void
}) {
  function toggle(value: V) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    onChange(options.map((o) => o.value).filter((v) => next.includes(v)))
  }

  return (
    <div className="chip-options">
      {options.map((o) => (
        <label key={o.value} className="chip-option">
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** Free-text tags: Enter (or leaving the field) adds what was typed. */
export function TagInput({
  tags,
  max,
  placeholder,
  onChange,
}: {
  tags: string[]
  max: number
  placeholder: string
  onChange: (next: string[]) => void
}) {
  const [text, setText] = useState('')
  const full = tags.length >= max

  function add() {
    const tag = text.trim()
    setText('')
    if (tag && !full && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...tags, tag])
  }

  return (
    <>
      {tags.length > 0 && (
        <ul className="chip-tags">
          {tags.map((tag) => (
            <li key={tag} className="chip-tag">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="chip-input"
        aria-label={placeholder}
        placeholder={full ? `Up to ${max}` : placeholder}
        value={text}
        disabled={full}
        onChange={(e) => setText(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
    </>
  )
}
