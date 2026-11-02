import { expect, test } from "bun:test"
import { buildPrompt, extractDiff, loadConfig } from "./mutator"

test("extracts a fenced diff", () => {
  const text = "here\n```diff\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-a\n+b\n```\n"
  expect(extractDiff(text)?.startsWith("--- a/src/index.ts")).toBe(true)
})

test("extracts an unfenced diff", () => {
  const text = "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-a\n+b\n"
  expect(extractDiff(text)?.startsWith("--- a/src/index.ts")).toBe(true)
})

test("returns undefined for prose", () => {
  expect(extractDiff("I cannot do that.")).toBeUndefined()
})

test("builds a prompt with the task source and tests", () => {
  const prompt = buildPrompt("slugify")
  expect(prompt).toContain("export function slugify")
  expect(prompt).toContain("lowercases and joins words")
})

test("loads defaults around an API key", () => {
  const config = loadConfig({ ARCHE_API_KEY: "test" })
  expect(config.baseURL).toBe("https://api.deepseek.com")
  expect(config.model).toBe("deepseek-chat")
})
