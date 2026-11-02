import { expect, test } from "bun:test"
import { selectBest } from "./select"

test("picks the fastest passing candidate", () => {
  const best = selectBest([
    { candidate: "a", task: "t", ok: false, durationMs: 1 },
    { candidate: "b", task: "t", ok: true, durationMs: 50 },
    { candidate: "c", task: "t", ok: true, durationMs: 20 },
  ])

  expect(best?.candidate).toBe("c")
})

test("returns undefined when nothing passes", () => {
  const best = selectBest([{ candidate: "a", task: "t", ok: false, durationMs: 1 }])
  expect(best).toBeUndefined()
})
