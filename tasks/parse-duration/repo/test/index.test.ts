import { expect, test } from "bun:test"
import { parseDuration } from "../src/index"

test("hours and minutes", () => {
  expect(parseDuration("1h30m")).toBe(5400)
})

test("seconds only", () => {
  expect(parseDuration("45s")).toBe(45)
})

test("hours only", () => {
  expect(parseDuration("2h")).toBe(7200)
})
