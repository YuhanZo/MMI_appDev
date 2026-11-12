import '@fontsource/outfit/latin-300.css'
import { useEffect, useState } from 'react'

const MS_PER_CHARACTER = 45

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A heading that types itself out once, with a blinking caret. The full text takes its
 * space from the start, so nothing below jumps while it types; screen readers get the
 * whole sentence at once, and users who prefer reduced motion see it without the effect.
 */
export default function TypingTitle({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0))

  useEffect(() => {
    if (shown >= text.length) return
    const timer = setTimeout(() => setShown((n) => n + 1), MS_PER_CHARACTER)
    return () => clearTimeout(timer)
  }, [shown, text])

  return (
    <h1 className={`typing-title${className ? ` ${className}` : ''}`} aria-label={text}>
      <span className="typing-space" aria-hidden="true">
        {text}
      </span>
      <span className="typing-text" aria-hidden="true">
        {text.slice(0, shown)}
        <span className="typing-caret" />
      </span>
    </h1>
  )
}
