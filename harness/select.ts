export type Scored = {
  candidate: string
  task: string
  ok: boolean
  durationMs: number
}

export function selectBest(results: Scored[]): Scored | undefined {
  return results
    .filter((result) => result.ok)
    .sort((a, b) => a.durationMs - b.durationMs)[0]
}
