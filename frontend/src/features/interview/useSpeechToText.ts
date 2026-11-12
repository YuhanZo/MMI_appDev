import { useEffect, useRef, useState } from 'react'

// The browser's own speech recognition (Web Speech API): Chrome, Edge and Safari have
// it, Firefox doesn't. Only the parts used here are typed.
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const BLOCKED = 'Microphone access was blocked. Allow it in your browser to answer by voice.'

/** What was typed, then what was said, separated by a space. */
function join(typed: string, spoken: string): string {
  const said = spoken.trim()
  if (!said) return typed
  return typed.trim() ? `${typed.replace(/\s+$/, '')} ${said}` : said
}

/**
 * Dictation into an answer: while listening, `onChange` gets the text that was there
 * when listening started plus everything said so far (unfinished words included, so
 * the text appears as the user speaks).
 */
export function useSpeechToText(onChange: (text: string) => void) {
  const supported = recognitionConstructor() !== undefined
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)

  function start(typed: string) {
    const Ctor = recognitionConstructor()
    if (!Ctor || recognition.current) return
    const r = new Ctor()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    r.onresult = (event) => {
      // Rebuilt from all results each time: finished phrases, then the one in progress.
      const results = Array.from(event.results)
      const spoken = results.map((result) => result[0].transcript).join('')
      onChange(join(typed, spoken))
    }
    r.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError(BLOCKED)
      else if (event.error === 'no-speech') setError("Didn't hear anything. Try again.")
      else if (event.error !== 'aborted') setError(`Voice input stopped (${event.error}).`)
    }
    r.onend = () => {
      recognition.current = null
      setListening(false)
    }
    setError('')
    recognition.current = r
    setListening(true)
    r.start()
  }

  function stop() {
    recognition.current?.stop()
  }

  // Leaving the page mid-dictation shouldn't keep the microphone on.
  useEffect(() => () => recognition.current?.abort(), [])

  return { supported, listening, error, start, stop }
}
