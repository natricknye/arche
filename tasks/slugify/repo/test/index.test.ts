import { expect, test } from "bun:test"
import { slugify } from "../src/index"

test("lowercases and joins words", () => {
  expect(slugify("Hello World!")).toBe("hello-world")
})

test("collapses separators and trims", () => {
  expect(slugify("  A  B  ")).toBe("a-b")
})

test("drops symbols", () => {
  expect(slugify("C++ & Rust")).toBe("c-rust")
})
