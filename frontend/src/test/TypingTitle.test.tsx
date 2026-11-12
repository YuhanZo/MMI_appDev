import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TypingTitle from '../TypingTitle'

const typed = (container: HTMLElement) => container.querySelector('.typing-text')!.textContent

/** Each character's timer starts after the previous one shows, so step one at a time. */
function typeCharacters(count: number) {
  for (let i = 0; i < count; i++) act(() => vi.advanceTimersByTime(45))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TypingTitle', () => {
  it('types the text out a character at a time, but reads as the whole sentence', () => {
    vi.useFakeTimers()
    const { container } = render(<TypingTitle text="Hi there" />)

    expect(screen.getByRole('heading', { name: 'Hi there' })).toBeInTheDocument()
    expect(typed(container)).toBe('')
    typeCharacters(2)
    expect(typed(container)).toBe('Hi')
    typeCharacters(20)
    expect(typed(container)).toBe('Hi there')
    // The full text always holds the space, so nothing below moves while it types.
    expect(container.querySelector('.typing-space')).toHaveTextContent('Hi there')
  })

  it('shows the whole text at once for users who prefer reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    const { container } = render(<TypingTitle text="Hi there" />)
    expect(typed(container)).toBe('Hi there')
  })
})
