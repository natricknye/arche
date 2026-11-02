import { readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { append } from "./archive"
import { runCandidate } from "./candidate"
import { selectBest } from "./select"

const root = resolve(import.meta.dir, "..")
const pool = join(root, "candidates")
const archive = join(root, "runs", "archive.jsonl")

const directories = readdirSync(pool, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(pool, entry.name))
  .sort()

const results = directories.map(runCandidate)

for (const result of results) {
  append(archive, {
    at: new Date().toISOString(),
    candidate: result.candidate,
    task: result.task,
    ok: result.ok,
    durationMs: result.durationMs,
  })
}

const label = (path: string) => path.split(/[\\/]/).at(-1)

console.table(
  results.map((result) => ({
    candidate: label(result.candidate),
    task: result.task,
    result: result.ok ? "PASS" : "FAIL",
    ms: result.durationMs,
    note: result.reason ?? "",
  })),
)

const tasks = [...new Set(results.map((result) => result.task))].sort()
let winners = 0

for (const task of tasks) {
  const best = selectBest(results.filter((result) => result.task === task))
  console.log(best ? `${task}: ${label(best.candidate)}` : `${task}: no passing candidate`)
  if (best) winners++
}

if (!winners) process.exit(1)
