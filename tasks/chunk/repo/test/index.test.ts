import { expect, test } from "bun:test"
import { chunk } from "../src/index"

test("splits evenly", () => {
  expect(chunk([1, 2, 3, 4], 2)).toEqual([
    [1, 2],
    [3, 4],
  ])
})

test("keeps the remainder", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
})

test("handles empty input", () => {
  expect(chunk([], 3)).toEqual([])
})
