import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { runCandidate } from "./candidate"
import { buildPrompt, callModel, loadConfig } from "./mutator"

const task = process.argv[2]
const output = process.argv[3]

if (!task) {
  console.error("usage: bun harness/mutate.ts <task> [output-dir]")
  process.exit(2)
}

const root = resolve(import.meta.dir, "..")
const dir = resolve(output ?? join("candidates", `${task}-model`))
const config = loadConfig()
const prompt = buildPrompt(task)
const generation = await callModel(config, prompt)

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, "candidate.json"), `${JSON.stringify({ task, patch: "patch.diff" }, null, 2)}\n`)
writeFileSync(join(dir, "patch.diff"), generation.diff)

const runs = join(root, "runs")
mkdirSync(runs, { recursive: true })
writeFileSync(join(runs, `${task}-raw.txt`), generation.raw)

console.log(
  `model=${generation.model} prompt=${generation.usage.promptTokens} completion=${generation.usage.completionTokens} total=${generation.usage.totalTokens}`,
)

const result = runCandidate(dir)
console.log(result.output)
console.log(`${task}: ${result.ok ? "PASS" : "FAIL"}${result.reason ? ` (${result.reason})` : ""} (${result.durationMs}ms)`)
process.exit(result.ok ? 0 : 1)
