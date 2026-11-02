import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { changedPaths, validate } from "./paths"

const root = resolve(import.meta.dir, "..")

type Spec = {
  task: string
  patch: string
}

type Task = {
  command: string[]
}

export type CandidateResult = {
  candidate: string
  task: string
  ok: boolean
  exitCode: number
  durationMs: number
  output: string
  reason?: string
}

export function runCandidate(directory: string): CandidateResult {
  const dir = resolve(directory)
  const spec = JSON.parse(readFileSync(join(dir, "candidate.json"), "utf8")) as Spec
  const patchPath = join(dir, spec.patch)
  const patch = readFileSync(patchPath, "utf8")
  const scope = validate(changedPaths(patch), "task")

  if (!scope.ok) {
    return {
      candidate: dir,
      task: spec.task,
      ok: false,
      exitCode: 1,
      durationMs: 0,
      output: "",
      reason: scope.reason,
    }
  }

  const taskDir = join(root, "tasks", spec.task)
  const task = JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8")) as Task
  const work = mkdtempSync(join(tmpdir(), `arche-candidate-${spec.task}-`))
  const repo = join(work, "repo")
  const started = performance.now()

  try {
    cpSync(join(taskDir, "repo"), repo, { recursive: true })

    const init = Bun.spawnSync({ cmd: ["git", "init", "-q"], cwd: repo, stdout: "pipe", stderr: "pipe" })
    if (init.exitCode !== 0) throw new Error(init.stderr.toString())

    const applied = Bun.spawnSync({ cmd: ["git", "apply", patchPath], cwd: repo, stdout: "pipe", stderr: "pipe" })
    if (applied.exitCode !== 0) {
      return {
        candidate: dir,
        task: spec.task,
        ok: false,
        exitCode: applied.exitCode ?? 1,
        durationMs: Math.round(performance.now() - started),
        output: applied.stderr.toString(),
        reason: "patch did not apply",
      }
    }

    const run = Bun.spawnSync({ cmd: task.command, cwd: repo, stdout: "pipe", stderr: "pipe", timeout: 30_000 })
    const output = `${run.stdout.toString()}${run.stderr.toString()}`.trim()

    return {
      candidate: dir,
      task: spec.task,
      ok: run.exitCode === 0,
      exitCode: run.exitCode ?? 1,
      durationMs: Math.round(performance.now() - started),
      output,
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const directory = process.argv[2]

  if (!directory) {
    console.error("usage: bun harness/candidate.ts <candidate-dir>")
    process.exit(2)
  }

  const result = runCandidate(directory)
  console.log(result.output)
  console.log(`${result.task}: ${result.ok ? "PASS" : "FAIL"}${result.reason ? ` (${result.reason})` : ""} (${result.durationMs}ms)`)
  process.exit(result.ok ? 0 : 1)
}
