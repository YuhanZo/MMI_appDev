import { describe, expect, it } from 'vitest'
import { createCrossModeSessionState, createSetupResetState } from './sessionState'

describe('interview session state', () => {
  it('returns to a clean setup for the selected mode', () => {
    expect(createSetupResetState('technical')).toEqual({
      mode: 'technical',
      company: '',
      position: '',
      currentQuestion: 0,
      answers: {},
      feedback: {},
      stage: 'setup',
      answerType: 'text',
      language: 'Python',
      error: '',
    })
  })

  it('preserves role details and starts a clean cross-mode session', () => {
    expect(createCrossModeSessionState('Aivana', 'Engineer', 'behavioral')).toEqual({
      mode: 'behavioral',
      company: 'Aivana',
      position: 'Engineer',
      currentQuestion: 0,
      answers: {},
      feedback: {},
      stage: 'session',
      answerType: 'text',
      language: 'Python',
      error: '',
    })
  })
})
