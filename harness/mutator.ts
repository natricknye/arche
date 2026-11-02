import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

export type Config = {
  apiKey: string
  baseURL: string
  model: string
}

export type Usage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type Generation = {
  diff: string
  raw: string
  model: string
  usage: Usage
}

type ChatResponse = {
  model?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export function readEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {}

  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const index = trimmed.indexOf("=")
      if (index === -1) continue

      values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
    }
  } catch {
    return {}
  }

  return values
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const file = env.ARCHE_ENV_FILE ? readEnvFile(env.ARCHE_ENV_FILE) : {}
  const values = { ...file, ...env }
  const apiKey = values.ARCHE_API_KEY

  if (!apiKey) throw new Error("ARCHE_API_KEY is not set")

  return {
    apiKey,
    baseURL: values.ARCHE_BASE_URL ?? "https://api.deepseek.com",
    model: values.ARCHE_MODEL ?? "deepseek-chat",
  }
}

export function buildPrompt(task: string): string {
  const dir = join(root, "tasks", task)
  const source = readFileSync(join(dir, "repo", "src", "index.ts"), "utf8").trim()
  const tests = readFileSync(join(dir, "repo", "test", "index.test.ts"), "utf8").trim()

  return [
    "Fix the TypeScript file so the tests pass.",
    "Return only a unified diff against src/index.ts.",
    "Do not edit the tests. Do not add dependencies. Do not use code fences.",
    "",
    "src/index.ts:",
    source,
    "",
    "tests:",
    tests,
  ].join("\n")
}

export function extractDiff(text: string): string | undefined {
  const fenced = text.match(/```(?:diff)?[ \t]*\r?\n([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.search(/^(diff --git |--- )/m)

  if (start === -1) return undefined

  return `${body.slice(start).trim()}\n`
}

export async function callModel(config: Config, prompt: string): Promise<Generation> {
  const endpoint = `${config.baseURL.replace(/\/$/, "")}/chat/completions`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: "system", content: "You edit code. You return unified diffs only." },
        { role: "user", content: prompt },
      ],
    }),
  })

  const data = (await response.json()) as ChatResponse

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(data)}`)
  }

  const raw = data.choices?.[0]?.message?.content ?? ""
  const diff = extractDiff(raw)

  if (!diff) throw new Error("model did not return a unified diff")

  return {
    diff,
    raw,
    model: data.model ?? config.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  }
}
