import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

export type Result = {
  task: string
  patch: string
  ok: boolean
  exitCode: number
  durationMs: number
  output: string
}

type Spec = {
  id: string
  command: string[]
}

export function runTask(task: string, patch: string): Result {
  const taskDir = join(root, "tasks", task)
  const spec = JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8")) as Spec
  const work = mkdtempSync(join(tmpdir(), `arche-${task}-`))
  const repo = join(work, "repo")
  const started = performance.now()

  try {
    cpSync(join(taskDir, "repo"), repo, { recursive: true })
    cpSync(join(taskDir, "patches", patch), repo, { recursive: true })

    const proc = Bun.spawnSync({
      cmd: spec.command,
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    })

    const output = `${proc.stdout.toString()}${proc.stderr.toString()}`.trim()

    return {
      task,
      patch,
      ok: proc.exitCode === 0,
      exitCode: proc.exitCode ?? 1,
      durationMs: Math.round(performance.now() - started),
      output,
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const [task, patch] = process.argv.slice(2)

  if (!task || !patch) {
    console.error("usage: bun harness/run.ts <task> <good|bad>")
    process.exit(2)
  }

  const result = runTask(task, patch)
  console.log(result.output)
  console.log(`${task}/${patch}: ${result.ok ? "PASS" : "FAIL"} (${result.durationMs}ms)`)
  process.exit(result.ok ? 0 : 1)
}
