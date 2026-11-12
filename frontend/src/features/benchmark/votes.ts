import type { ModelReply } from '../../types'

export type Vote = 'a' | 'b' | 'tie' | 'bad'

/** How often each model won, and how many rounds were ties or both bad. */
export interface Tally {
  aivana: number
  baseline: number
  tie: number
  bad: number
  baselineName: string // the baseline as last shown, e.g. "Gemini"; '' before any vote
}

const KEY = 'mmi-benchmark-votes'
export const EMPTY_TALLY: Tally = { aivana: 0, baseline: 0, tie: 0, bad: 0, baselineName: '' }

/** "Aivana MMI", or the baseline's provider read from its model id. */
export function systemName(reply: Pick<ModelReply, 'system' | 'model'>): string {
  if (reply.system === 'aivana') return 'Aivana MMI'
  if (reply.model.startsWith('gemini')) return 'Gemini'
  if (/^(gpt|o\d)/.test(reply.model)) return 'OpenAI'
  return 'General model'
}

// Kept in this browser only; storage can be blocked, so failures just mean no tally.
export function loadTally(): Tally {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved && typeof saved === 'object' ? { ...EMPTY_TALLY, ...saved } : EMPTY_TALLY
  } catch {
    return EMPTY_TALLY
  }
}

export function saveTally(tally: Tally): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tally))
  } catch {
    // Storage blocked: the tally still counts for this visit.
  }
}

/** Adds a vote; `shown` is the replies in the order they were shown as A and B. */
export function addVote(tally: Tally, vote: Vote, shown: [ModelReply, ModelReply]): Tally {
  const key = vote === 'a' ? shown[0].system : vote === 'b' ? shown[1].system : vote
  const baseline = shown.find((r) => r.system === 'baseline')
  return { ...tally, [key]: tally[key] + 1, baselineName: baseline ? systemName(baseline) : tally.baselineName }
}

export const totalVotes = (t: Tally) => t.aivana + t.baseline + t.tie + t.bad
