import { expect, test } from "bun:test"
import { compare } from "../src/index"

test("minor version is numeric", () => {
  expect(compare("1.2.3", "1.10.0")).toBe(-1)
})

test("equal versions", () => {
  expect(compare("2.0.0", "2.0.0")).toBe(0)
})

test("patch version is numeric", () => {
  expect(compare("1.0.10", "1.0.2")).toBe(1)
})
