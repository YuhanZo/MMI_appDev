import type { ModelRun } from '../../types'

const STORAGE_KEY = 'mmi-benchmark-history'

export interface RatedRun extends Pick<ModelRun, 'system' | 'model' | 'mock' | 'latency_ms' | 'cost' | 'cost_unit' | 'format_ok'> {
  rating: number // 1-5
}

export interface BenchmarkEntry {
  at: string // ISO time
  job: string
  runs: RatedRun[]
}

// Kept in this browser only; storage can be blocked, so failures just mean no history.
export function loadHistory(): BenchmarkEntry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function saveHistory(history: BenchmarkEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Storage blocked: the table still shows this visit's runs.
  }
}

export interface Averages {
  runs: number
  latencyS: number | null
  cost: number | null // average over the runs that reported a cost
  costUnit: ModelRun['cost_unit']
  formatRate: number // 0-1
  rating: number
}

/** Per-model averages, leaving out mock runs (their numbers are placeholders). */
export function averages(history: BenchmarkEntry[], system: ModelRun['system']): Averages | null {
  const runs = history.flatMap((e) => e.runs).filter((r) => r.system === system && !r.mock)
  if (runs.length === 0) return null
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const costs = runs.map((r) => r.cost).filter((c): c is number => c !== null)
  return {
    runs: runs.length,
    latencyS: mean(runs.map((r) => r.latency_ms / 1000)),
    cost: mean(costs),
    costUnit: runs[0].cost_unit,
    formatRate: runs.filter((r) => r.format_ok).length / runs.length,
    rating: mean(runs.map((r) => r.rating)) ?? 0,
  }
}
