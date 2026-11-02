import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

export type Entry = {
  at: string
  candidate: string
  task: string
  ok: boolean
  durationMs: number
}

export function append(path: string, entry: Entry) {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(entry)}\n`)
}
