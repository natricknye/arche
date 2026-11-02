import { expect, test } from "bun:test"
import { changedPaths, validate } from "./paths"

const patch = `diff --git a/agent/loop.ts b/agent/loop.ts
--- a/agent/loop.ts
+++ b/agent/loop.ts
@@ -1 +1 @@
-old
+new
`

test("reads paths from a diff", () => {
  expect(changedPaths(patch)).toEqual(["agent/loop.ts"])
})

test("allows agent files in self scope", () => {
  expect(validate(["agent/loop.ts"], "self")).toEqual({ ok: true })
})

test("rejects harness files in self scope", () => {
  const result = validate(["harness/run.ts"], "self")
  expect(result.ok).toBe(false)
})

test("rejects task files in self scope", () => {
  const result = validate(["tasks/slugify/repo/src/index.ts"], "self")
  expect(result.ok).toBe(false)
})

test("rejects workflow files in self scope", () => {
  const result = validate([".github/workflows/ci.yml"], "self")
  expect(result.ok).toBe(false)
})

test("rejects parent traversal", () => {
  const result = validate(["agent/../../secrets.txt"], "self")
  expect(result.ok).toBe(false)
})

test("allows task repo files in task scope", () => {
  expect(validate(["src/index.ts"], "task")).toEqual({ ok: true })
})
