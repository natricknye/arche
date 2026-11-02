export function normalizePath(input: string): string {
  return input.replaceAll("\\", "/").replaceAll("//", "/")
}
