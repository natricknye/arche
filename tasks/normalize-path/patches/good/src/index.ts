export function normalizePath(input: string): string {
  const result: string[] = []

  for (const part of input.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      result.pop()
      continue
    }
    result.push(part)
  }

  return result.join("/")
}
