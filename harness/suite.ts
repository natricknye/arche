import { readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { runTask } from "./run"

const root = resolve(import.meta.dir, "..")
const tasks = readdirSync(join(root, "tasks"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const rows = tasks.map((task) => {
  const good = runTask(task, "good")
  const bad = runTask(task, "bad")

  return {
    task,
    good: good.ok,
    bad: bad.ok,
    separated: good.ok && !bad.ok,
    ms: `${good.durationMs}/${bad.durationMs}`,
  }
})

console.table(
  rows.map((row) => ({
    task: row.task,
    good: row.good ? "PASS" : "FAIL",
    bad: row.bad ? "PASS" : "FAIL",
    verdict: row.separated ? "ok" : "MISMATCH",
    ms: row.ms,
  })),
)

const passed = rows.filter((row) => row.separated).length
console.log(`\n${passed}/${rows.length} tasks separated good from bad`)

if (passed !== rows.length) process.exit(1)
