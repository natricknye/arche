import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { runCandidate } from "./candidate"

test("applies the example candidate and passes the task", () => {
  const result = runCandidate(resolve(import.meta.dir, "..", "candidates/slugify-fix"))
  expect(result.ok).toBe(true)
})
