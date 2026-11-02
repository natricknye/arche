import { expect, test } from "bun:test"
import { normalizePath } from "../src/index"

test("resolves parent segments", () => {
  expect(normalizePath("a\\b\\..\\c")).toBe("a/c")
})

test("drops current segments", () => {
  expect(normalizePath("./a/./b")).toBe("a/b")
})

test("collapses duplicate separators", () => {
  expect(normalizePath("a//b")).toBe("a/b")
})
